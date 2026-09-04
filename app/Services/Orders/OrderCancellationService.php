<?php

declare(strict_types=1);

namespace App\Services\Orders;

use App\Models\Order;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Cancels an order and puts its goods back on the shelf.
 *
 * Placing an order draws stock down through the FIFO ledger
 * ({@see \App\Services\Inventory\FifoInventoryService::issue()}). Cancelling has
 * to undo exactly that, or every cancellation quietly eats inventory: the units
 * are gone from the warehouse but no longer owed to anyone.
 *
 * The return is reconstructed from the ledger itself rather than from the order
 * lines. Each sale movement recorded against this order carries the unit cost of
 * the layer it consumed, so returning movement-by-movement restores both the
 * quantity AND the original cost basis. Rebuilding from `order_items` would put
 * the goods back at the wrong cost (the sale price is not the cost price) and
 * quietly corrupt margin reporting.
 *
 * Returns are written as {@see StockMovement::TYPE_RETURN}, so the ledger keeps
 * "goods we bought" and "goods a customer gave back" distinguishable.
 */
class OrderCancellationService
{
    public function __construct(
        private readonly FifoInventoryService $inventory,
    ) {}

    /** Statuses from which an order can still be taken back. */
    private const CANCELLABLE = [
        Order::STATUS_PENDING,
        Order::STATUS_CONFIRMED,
    ];

    /**
     * @param  User|null  $actor  Who cancelled — recorded on the stock movements.
     *
     * @throws ValidationException When the order is in a status that cannot be cancelled.
     */
    public function cancel(Order $order, ?User $actor = null): Order
    {
        if (! in_array($order->status, self::CANCELLABLE, true)) {
            throw ValidationException::withMessages([
                'status' => [$order->status === Order::STATUS_CANCELLED
                    ? 'Заказ уже отменён.'
                    : 'Этот заказ уже нельзя отменить.'],
            ]);
        }

        return DB::transaction(function () use ($order, $actor): Order {
            $this->restoreStock($order, $actor);

            $order->update(['status' => Order::STATUS_CANCELLED]);

            return $order->refresh();
        });
    }

    /**
     * Put back every unit this order took out, layer by layer.
     *
     * Guarded against double-return: if a return has already been written
     * against this order, the stock is back and only the status needs changing.
     */
    private function restoreStock(Order $order, ?User $actor): void
    {
        $movements = StockMovement::query()
            ->with('product')
            ->where('documentable_type', $order->getMorphClass())
            ->where('documentable_id', $order->getKey())
            ->get();

        if ($movements->contains(fn (StockMovement $m): bool => $m->type === StockMovement::TYPE_RETURN)) {
            return;
        }

        $order->loadMissing('store');

        if ($order->store === null) {
            return;
        }

        $sales = $movements->where('type', StockMovement::TYPE_SALE);

        foreach ($sales as $sale) {
            $quantity = abs((float) $sale->qty_delta);

            if ($quantity <= 0) {
                continue;
            }

            $this->inventory->receive(
                product: $sale->product,
                store: $order->store,
                quantity: $quantity,
                unitCost: (int) $sale->unit_cost,
                document: $order,
                user: $actor,
                type: StockMovement::TYPE_RETURN,
            );
        }
    }
}
