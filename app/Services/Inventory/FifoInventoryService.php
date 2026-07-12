<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Models\Batch;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * The system of record for on-hand stock and cost.
 *
 * Every quantity change is written to the append-only {@see StockMovement} ledger.
 * Receipts create FIFO cost layers ({@see Batch}); issues consume them oldest-first
 * and return the cost of goods sold. product_store_stock is kept as a cached
 * projection (on-hand quantity + weighted-average cost) of the remaining layers.
 */
class FifoInventoryService
{
    /** Quantities are stored to 3 decimals; compare with half-a-milliunit slack. */
    private const EPSILON = 0.0005;

    /**
     * Receive stock into a warehouse as a new FIFO layer and record the movement.
     *
     * @param  float  $quantity  Units received (> 0).
     * @param  int  $unitCost  Purchase cost per unit, in kopecks (>= 0).
     * @param  Model|null  $document  The document that caused the receipt (e.g. a goods receipt).
     */
    public function receive(
        Product $product,
        Store $store,
        float $quantity,
        int $unitCost,
        ?Model $document = null,
        ?User $user = null,
    ): Batch {
        if ($quantity <= 0) {
            throw new InvalidArgumentException('Количество прихода должно быть больше нуля.');
        }

        if ($unitCost < 0) {
            throw new InvalidArgumentException('Себестоимость не может быть отрицательной.');
        }

        $quantity = round($quantity, 3);

        return DB::transaction(function () use ($product, $store, $quantity, $unitCost, $document, $user): Batch {
            $batch = Batch::create([
                'product_id' => $product->id,
                'store_id' => $store->id,
                'unit_cost' => $unitCost,
                'qty_in' => $quantity,
                'qty_left' => $quantity,
                'received_at' => now(),
            ]);

            $balanceAfter = $this->refreshProjection($product, $store);

            $this->recordMovement(
                store: $store,
                product: $product,
                batch: $batch,
                quantityDelta: $quantity,
                type: StockMovement::TYPE_RECEIPT,
                unitCost: $unitCost,
                balanceAfter: $balanceAfter,
                document: $document,
                user: $user,
            );

            return $batch;
        });
    }

    /**
     * Issue stock out of a warehouse, consuming FIFO layers oldest-first.
     *
     * @param  float  $quantity  Units to issue (> 0).
     * @param  string  $type  A {@see StockMovement} TYPE_* constant (defaults to a sale).
     * @return int Cost of goods sold, in kopecks.
     *
     * @throws InsufficientStockException When the warehouse holds less than $quantity.
     */
    public function issue(
        Product $product,
        Store $store,
        float $quantity,
        string $type = StockMovement::TYPE_SALE,
        ?Model $document = null,
        ?User $user = null,
    ): int {
        if ($quantity <= 0) {
            throw new InvalidArgumentException('Количество списания должно быть больше нуля.');
        }

        $quantity = round($quantity, 3);

        return DB::transaction(function () use ($product, $store, $quantity, $type, $document, $user): int {
            $layers = Batch::query()
                ->where('product_id', $product->id)
                ->where('store_id', $store->id)
                ->where('qty_left', '>', 0)
                ->orderBy('received_at')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            $available = round($layers->sum(static fn (Batch $batch): float => (float) $batch->qty_left), 3);

            if ($available + self::EPSILON < $quantity) {
                throw new InsufficientStockException($product, $store, $quantity, $available);
            }

            $balance = $available;
            $remaining = $quantity;
            $costOfGoodsSold = 0;

            foreach ($layers as $layer) {
                if ($remaining <= self::EPSILON) {
                    break;
                }

                $taken = round(min($remaining, (float) $layer->qty_left), 3);

                $layer->qty_left = round((float) $layer->qty_left - $taken, 3);
                $layer->save();

                $balance = round($balance - $taken, 3);
                $unitCost = (int) $layer->unit_cost;

                $this->recordMovement(
                    store: $store,
                    product: $product,
                    batch: $layer,
                    quantityDelta: -$taken,
                    type: $type,
                    unitCost: $unitCost,
                    balanceAfter: $balance,
                    document: $document,
                    user: $user,
                );

                $costOfGoodsSold += (int) round($taken * $unitCost);
                $remaining = round($remaining - $taken, 3);
            }

            $this->refreshProjection($product, $store);

            return $costOfGoodsSold;
        });
    }

    /**
     * On-hand quantity for a product at a warehouse, read from the projection.
     */
    public function onHand(Product $product, Store $store): float
    {
        return (float) (ProductStoreStock::query()
            ->where('product_id', $product->id)
            ->where('store_id', $store->id)
            ->value('stock') ?? 0);
    }

    /**
     * Recompute the cached on-hand quantity and weighted-average cost for a
     * product at a warehouse from its remaining FIFO layers.
     *
     * @return float The recomputed on-hand quantity.
     */
    private function refreshProjection(Product $product, Store $store): float
    {
        $layers = Batch::query()
            ->where('product_id', $product->id)
            ->where('store_id', $store->id)
            ->where('qty_left', '>', 0)
            ->get(['qty_left', 'unit_cost']);

        $onHand = 0.0;
        $costValue = 0.0;

        foreach ($layers as $layer) {
            $qtyLeft = (float) $layer->qty_left;
            $onHand += $qtyLeft;
            $costValue += $qtyLeft * (int) $layer->unit_cost;
        }

        $onHand = round($onHand, 3);
        $averageCost = $onHand > 0 ? (int) round($costValue / $onHand) : null;

        ProductStoreStock::query()->updateOrCreate(
            ['product_id' => $product->id, 'store_id' => $store->id],
            ['stock' => $onHand, 'avg_cost' => $averageCost],
        );

        return $onHand;
    }

    private function recordMovement(
        Store $store,
        Product $product,
        Batch $batch,
        float $quantityDelta,
        string $type,
        int $unitCost,
        float $balanceAfter,
        ?Model $document,
        ?User $user,
    ): void {
        StockMovement::create([
            'store_id' => $store->id,
            'product_id' => $product->id,
            'batch_id' => $batch->id,
            'qty_delta' => $quantityDelta,
            'type' => $type,
            'unit_cost' => $unitCost,
            'balance_after' => $balanceAfter,
            'documentable_type' => $document?->getMorphClass(),
            'documentable_id' => $document?->getKey(),
            'user_id' => $user?->id,
        ]);
    }
}
