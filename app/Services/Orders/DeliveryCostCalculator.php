<?php

declare(strict_types=1);

namespace App\Services\Orders;

use App\Models\CatalogSetting;

/**
 * The single source of truth for delivery pricing: a flat admin-configured
 * fee, waived once the subtotal reaches the free-delivery threshold. Used by
 * both order placement and the cart pre-validation endpoint so the number a
 * customer sees in the cart always matches what checkout charges.
 */
class DeliveryCostCalculator
{
    /**
     * @param  int  $subtotal  Kopecks.
     * @return int Kopecks.
     */
    public function costFor(int $subtotal): int
    {
        $settings = CatalogSetting::current();
        $freeFrom = $settings->free_delivery_from;

        if ($freeFrom !== null && $subtotal >= $freeFrom) {
            return 0;
        }

        return (int) ($settings->delivery_price ?? 0);
    }
}
