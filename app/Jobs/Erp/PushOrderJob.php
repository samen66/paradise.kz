<?php

declare(strict_types=1);

namespace App\Jobs\Erp;

use App\Contracts\Erp\OrderTarget;
use App\Models\Order;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Push a placed order to the active ERP via the {@see OrderTarget} contract.
 *
 * Flow & failure handling:
 *   - Guards (non-transient): if the client has no ERP counterparty, or the
 *     order has no warehouse, there is nothing to push to — mark the order
 *     `failed` with a clear error and return WITHOUT throwing (a retry would
 *     never succeed).
 *   - Otherwise hand the order to the provider. Line prices are ALREADY in
 *     kopecks (the per-client snapshot in order_items.price), forwarded as-is.
 *   - On success, store external_order_id/number, set status `synced`, pushed_at.
 *   - On any provider error we record status `failed` + the message and RETHROW
 *     so the queue retries up to $tries with backoff. A persistent error simply
 *     exhausts the retries and the order stays `failed` for an admin to re-push.
 *
 * @see docs/moysklad-integration-notes.md (section 8)
 */
class PushOrderJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(
        public readonly Order $order,
    ) {}

    /**
     * Seconds to wait between retries (exponential-ish).
     *
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(OrderTarget $orders): void
    {
        $order = $this->order->fresh(['items', 'user', 'store']);

        if ($order === null) {
            return;
        }

        $counterpartyId = $order->user->external_counterparty_id;

        if (blank($counterpartyId)) {
            // Non-transient: nothing to retry against. Fail fast, no exception.
            $order->update([
                'status' => Order::STATUS_FAILED,
                'error' => 'client is not linked to an ERP counterparty',
            ]);

            return;
        }

        if ($order->store === null) {
            // Non-transient: nothing to retry against. Fail fast, no exception.
            $order->update([
                'status' => Order::STATUS_FAILED,
                'error' => 'order has no warehouse',
            ]);

            return;
        }

        try {
            $pushed = $orders->pushOrder($order, (string) $counterpartyId);
        } catch (Throwable $e) {
            $order->update([
                'status' => Order::STATUS_FAILED,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }

        $order->update([
            'status' => Order::STATUS_SYNCED,
            'source' => (string) config('erp.provider'),
            'external_order_id' => $pushed->externalId,
            'external_number' => $pushed->number,
            'error' => null,
            'pushed_at' => now(),
        ]);
    }
}
