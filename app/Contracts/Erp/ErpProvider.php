<?php

declare(strict_types=1);

namespace App\Contracts\Erp;

use App\Contracts\Catalog\CatalogSource;

/**
 * An external accounting / ERP system the application integrates with.
 *
 * A provider bundles the three integration surfaces behind one swappable unit:
 *   - {@see CatalogSource}  — read the catalog (products, folders, stores, stock),
 *   - {@see OrderTarget}    — push placed orders and mirror their state back,
 *   - {@see WebhookHandler} — receive change notifications.
 *
 * MoySklad is the current implementation. The active provider is resolved from
 * config('erp.provider'); every mirrored row records the provider {@see key()}
 * in its `source` column so rows from multiple providers can coexist.
 */
interface ErpProvider
{
    /**
     * Stable provider identifier persisted on every mirrored row's `source`
     * column (e.g. "moysklad").
     */
    public function key(): string;

    /**
     * The catalog read surface (products, folders, warehouses, stock, images).
     */
    public function catalog(): CatalogSource;

    /**
     * The order write surface (push orders, counterparties, order state).
     */
    public function orders(): OrderTarget;

    /**
     * The inbound webhook surface (verify + dispatch targeted sync jobs).
     */
    public function webhooks(): WebhookHandler;
}
