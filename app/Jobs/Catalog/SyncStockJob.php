<?php

declare(strict_types=1);

namespace App\Jobs\Catalog;

use App\Contracts\Catalog\CatalogSource;
use App\Models\ProductExternalMapping;
use App\Models\ProductStoreStock;
use App\Models\Store;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Collection;

/**
 * Mirror the ERP's current free-stock, broken down per warehouse, into
 * `product_store_stock`, then recompute each touched product's aggregate
 * `products.stock` as the sum across all its warehouses.
 *
 * The ERP is the source of truth (AGENTS.md #1). Stock arrives keyed by the
 * product/store external ids; rows whose product or store isn't locally known
 * are skipped.
 */
class SyncStockJob implements ShouldQueue
{
    use Queueable;

    /** Rows to buffer before flushing an upsert batch. */
    private const CHUNK_SIZE = 500;

    /**
     * @param  string|null  $changedSince  "Y-m-d H:i:s" (≤24h back) for a delta sync.
     */
    public function __construct(
        private readonly ?string $changedSince = null,
    ) {}

    /**
     * Stock webhooks fire every 1–5 minutes and the full cron sync runs too, so
     * collapse concurrent runs: while one stock sync holds the lock, overlapping
     * dispatches are dropped (the next delta/cron run covers their changes).
     *
     * @return array<int, object>
     */
    public function middleware(): array
    {
        return [(new WithoutOverlapping('erp-stock-sync'))->dontRelease()->expireAfter(180)];
    }

    public function handle(CatalogSource $source): void
    {
        $rows = $source->stockByStore($this->changedSince);

        if ($rows === []) {
            return;
        }

        $sourceKey = $source->key();
        $productIds = ProductExternalMapping::query()->where('source', $sourceKey)->pluck('product_id', 'external_id');
        $storeIds = Store::query()->where('source', $sourceKey)->pluck('id', 'external_id');

        $touchedProductIds = [];

        foreach (array_chunk($rows, self::CHUNK_SIZE) as $chunk) {
            $touchedProductIds += $this->upsertChunk($chunk, $productIds, $storeIds);
        }

        if ($touchedProductIds !== []) {
            $this->recomputeAggregateStock(array_values($touchedProductIds));
        }
    }

    /**
     * @param  array<int, array{externalProductId: string, externalStoreId: string, stock: float}>  $chunk
     * @param  Collection<string, int>  $productIds
     * @param  Collection<string, int>  $storeIds
     * @return array<int, int> Local product ids touched by this chunk.
     */
    private function upsertChunk(array $chunk, $productIds, $storeIds): array
    {
        $batch = [];
        $touched = [];

        foreach ($chunk as $row) {
            $productId = $productIds[$row['externalProductId']] ?? null;
            $storeId = $storeIds[$row['externalStoreId']] ?? null;

            if ($productId === null || $storeId === null) {
                continue;
            }

            $batch[] = [
                'product_id' => $productId,
                'store_id' => $storeId,
                'stock' => $row['stock'],
            ];
            $touched[$productId] = $productId;
        }

        if ($batch !== []) {
            ProductStoreStock::query()->upsert($batch, ['product_id', 'store_id'], ['stock']);
        }

        return $touched;
    }

    /**
     * Delegates to {@see FifoInventoryService::recomputeAggregateStock()} so the
     * aggregate is rolled up by exactly one statement everywhere in the app.
     *
     * @param  array<int, int>  $productIds
     */
    private function recomputeAggregateStock(array $productIds): void
    {
        foreach (array_chunk($productIds, self::CHUNK_SIZE) as $chunk) {
            FifoInventoryService::recomputeAggregateStock($chunk);
        }
    }
}
