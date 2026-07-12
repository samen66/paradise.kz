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
        if ($receipt->isPosted()) {
            throw new RuntimeException('Приёмка уже проведена.');
        }

        $receipt->loadMissing('items.product', 'store');

        if ($receipt->items->isEmpty()) {
            throw new RuntimeException('Нельзя провести пустую приёмку.');
        }

        return DB::transaction(function () use ($receipt, $user): GoodsReceipt {
            foreach ($receipt->items as $item) {
                $this->inventory->receive(
                    product: $item->product,
                    store: $receipt->store,
                    quantity: (float) $item->quantity,
                    unitCost: (int) $item->unit_cost,
                    document: $receipt,
                    user: $user,
                );
            }

            $receipt->forceFill([
                'status' => GoodsReceipt::STATUS_POSTED,
                'received_at' => $receipt->received_at ?? now(),
                'posted_at' => now(),
                'user_id' => $receipt->user_id ?? $user?->id,
            ])->save();

            return $receipt;
        });
    }
}
