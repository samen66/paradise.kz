<?php

declare(strict_types=1);

namespace App\Services\MoySklad;

use App\Contracts\Catalog\CatalogSource;
use App\Contracts\Erp\ErpProvider;
use App\Contracts\Erp\OrderTarget;
use App\Contracts\Erp\WebhookHandler;

/**
 * MoySklad implementation of the {@see ErpProvider} contract. Bundles the
 * MoySklad catalog source, order target and webhook handler behind one unit so
 * the whole integration can be swapped via config('erp.provider').
 */
class MoySkladErpProvider implements ErpProvider
{
    public function __construct(
        private readonly MoySkladService $catalog,
        private readonly MoySkladOrderTarget $orders,
        private readonly MoySkladWebhookHandler $webhooks,
    ) {}

    public function key(): string
    {
        return 'moysklad';
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
