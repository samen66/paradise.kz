<?php

declare(strict_types=1);

namespace App\Jobs\Erp;

use App\Contracts\Erp\OrderTarget;
use App\Models\Order;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Mirror an ERP order's fulfilment state back onto the local order, triggered by
 * an order UPDATE webhook.
 *
 * Only orders we pushed are matched (by `external_order_id`); orders created
 * directly inside the ERP have no local row and are ignored. Echo from our own
 * writes is suppressed upstream by the provider's order target.
 */
class SyncOrderStatusJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly string $externalOrderId,
    ) {}

    public function handle(OrderTarget $orders): void
    {
        $order = Order::query()
            ->where('external_order_id', $this->externalOrderId)
            ->first();

        // Not an order we track (created directly in the ERP) — nothing to do.
        if ($order === null) {
            return;
        }

        $state = $orders->orderState($this->externalOrderId);

        if ($state === null) {
            return;
        }

        $order->update(['external_state' => $state]);
    }
}
