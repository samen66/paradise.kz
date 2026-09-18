<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Models\GoodsReceipt;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Posts a goods receipt: turns each of its lines into a FIFO cost layer and a
 * stock movement through the {@see FifoInventoryService}, then locks the
 * document as posted. Posting is idempotent-guarded — a receipt posts once.
 */
class GoodsReceiptService
{
    public function __construct(private readonly FifoInventoryService $inventory) {}

    /**
     * @throws RuntimeException When the receipt is already posted or has no lines.
     */
    public function post(GoodsReceipt $receipt, ?User $user = null): GoodsReceipt
    {
        $posted = DB::transaction(function () use ($receipt, $user): GoodsReceipt {
            // Re-read under a row lock: a second tab (or Filament next to the
            // admin app) holding a stale draft must not receive the stock twice.
            $locked = GoodsReceipt::query()->lockForUpdate()->findOrFail($receipt->id);

            if ($locked->isPosted()) {
                throw new RuntimeException('Приёмка уже проведена.');
            }

            $locked->load('items.product', 'store');

            if ($locked->items->isEmpty()) {
                throw new RuntimeException('Нельзя провести пустую приёмку.');
            }

            foreach ($locked->items as $item) {
                $this->inventory->receive(
                    product: $item->product,
                    store: $locked->store,
                    quantity: (float) $item->quantity,
                    unitCost: (int) $item->unit_cost,
                    document: $locked,
                    user: $user,
                );
            }

            $locked->forceFill([
                'status' => GoodsReceipt::STATUS_POSTED,
                'received_at' => $locked->received_at ?? now(),
                'posted_at' => now(),
                'user_id' => $locked->user_id ?? $user?->id,
            ])->save();

            return $locked;
        });

        $receipt->setRawAttributes($posted->getAttributes(), true);

        return $receipt;
    }
}
