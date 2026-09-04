<?php

declare(strict_types=1);

namespace App\Services\Local;

use App\Contracts\Catalog\CatalogSource;
use App\Contracts\Erp\ErpProvider;
use App\Contracts\Erp\OrderTarget;
use App\Contracts\Erp\WebhookHandler;

/**
 * The default provider: paradise.kz runs standalone, with no external ERP.
 *
 * The catalog is authored in the admin panel and stock is owned by the local
 * FIFO ledger, so all three integration surfaces are inert — reads return
 * nothing, writes throw. Selected via config('erp.provider') = 'local'.
 *
 * Rows created locally carry `source = 'local'`, so a future ERP import can be
 * added alongside them without an identity clash (identity is source +
 * external_id).
 */
class LocalErpProvider implements ErpProvider
{
    public function __construct(
        private readonly LocalCatalogSource $catalog,
        private readonly LocalOrderTarget $orders,
        private readonly LocalWebhookHandler $webhooks,
    ) {}

    public function key(): string
    {
        return 'local';
    }

    public function catalog(): CatalogSource
    {
        return $this->catalog;
    }

    public function orders(): OrderTarget
    {
        return $this->orders;
    }

    public function webhooks(): WebhookHandler
    {
        return $this->webhooks;
    }
}
