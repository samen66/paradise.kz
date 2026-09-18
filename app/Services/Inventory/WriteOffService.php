<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Models\StockMovement;
use App\Models\User;
use App\Models\WriteOff;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Posts a write-off: every line leaves the warehouse through the FIFO layers
 * as a `write_off` movement, all lines or none.
 */
class WriteOffService
{
    public function __construct(private readonly FifoInventoryService $inventory) {}

    /**
     * @throws RuntimeException When the write-off is already posted or has no lines.
     * @throws InsufficientStockException When a line exceeds on-hand stock (nothing is written).
     */
    public function post(WriteOff $writeOff, ?User $user = null): WriteOff
    {
        $posted = DB::transaction(function () use ($writeOff, $user): WriteOff {
            // Re-read under a row lock: two concurrent "post" clicks must not
            // both see a draft and issue the stock twice.
            $locked = WriteOff::query()->lockForUpdate()->findOrFail($writeOff->id);

            if ($locked->isPosted()) {
                throw new RuntimeException('Списание уже проведено.');
            }

            $locked->load('items.product', 'store');

            if ($locked->items->isEmpty()) {
                throw new RuntimeException('Нельзя провести пустое списание.');
            }

            foreach ($locked->items as $item) {
                $this->inventory->issue(
                    product: $item->product,
                    store: $locked->store,
                    quantity: (float) $item->quantity,
                    type: StockMovement::TYPE_WRITE_OFF,
                    document: $locked,
                    user: $user,
                );
            }

            $locked->forceFill([
                'status' => WriteOff::STATUS_POSTED,
                'posted_at' => now(),
                'user_id' => $locked->user_id ?? $user?->id,
            ])->save();

            return $locked;
        });

        $writeOff->setRawAttributes($posted->getAttributes(), true);

        return $writeOff;
    }
}
