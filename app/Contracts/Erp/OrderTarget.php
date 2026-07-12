<?php

declare(strict_types=1);

namespace App\Contracts\Erp;

use App\Models\Order;
use App\Models\User;
use App\Services\Erp\Data\PushedOrder;

/**
 * The order-write surface of an {@see ErpProvider}: everything the application
 * sends INTO the external accounting system.
 *
 * Implementations translate our neutral domain models into provider-specific
 * payloads. Transient failures must throw so the queued caller can retry;
 * permanent failures (e.g. a rejected payload) should also throw and let the
 * caller exhaust its retries.
 */
interface OrderTarget
{
    /**
     * Ensure the B2B client exists as a counterparty in the external system and
     * return its external id. Implementations build the provider-specific
     * counterparty payload from the user's company details.
     */
    public function createCounterparty(User $user): string;

    /**
     * Push a placed order to the external system and return its external
     * reference. The client's resolved counterparty id is passed in so the
     * implementation does not re-read it.
     *
     * Line prices on the order are snapshots in kopecks (minor units) and must
     * be forwarded as-is.
     */
    public function pushOrder(Order $order, string $counterpartyExternalId): PushedOrder;

    /**
     * Fetch the current fulfilment-state name of an external order, or null when
     * the order no longer exists or carries no state.
     */
    public function orderState(string $externalOrderId): ?string;
}
