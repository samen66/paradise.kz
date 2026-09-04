<?php

declare(strict_types=1);

namespace App\Services\Local;

use App\Contracts\Erp\OrderTarget;
use App\Models\Order;
use App\Models\User;
use App\Services\Erp\Data\PushedOrder;
use RuntimeException;

/**
 * The "no external accounting system" order target.
 *
 * Orders live only in this application: they are placed by
 * {@see \App\Services\Orders\OrderPlacementService}, drawn down from the local
 * FIFO ledger, and worked through their statuses in the admin panel. There is
 * nowhere to push them to.
 *
 * Every method throws rather than silently succeeding: a caller reaching this
 * class means a push path was left wired up by mistake, and a loud failure in
 * the queue is far better than orders quietly marked `synced` against an
 * external system that does not exist.
 */
class LocalOrderTarget implements OrderTarget
{
    public function supportsCounterparties(): bool
    {
        return false;
    }

    public function createCounterparty(User $user): string
    {
        throw new RuntimeException(self::message());
    }

    public function pushOrder(Order $order, string $counterpartyExternalId): PushedOrder
    {
        throw new RuntimeException(self::message());
    }

    public function orderState(string $externalOrderId): ?string
    {
        throw new RuntimeException(self::message());
    }

    private static function message(): string
    {
        return 'Внешняя учётная система не подключена (ERP_PROVIDER=local): заказы обрабатываются только в админке.';
    }
}
