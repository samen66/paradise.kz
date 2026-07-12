<?php

declare(strict_types=1);

namespace App\Providers;

use App\Contracts\Catalog\CatalogSource;
use App\Contracts\Erp\ErpProvider;
use App\Contracts\Erp\OrderTarget;
use App\Contracts\Erp\WebhookHandler;
use Illuminate\Support\ServiceProvider;
use InvalidArgumentException;

/**
 * Wires the active ERP provider (config erp.provider) and exposes its three
 * surfaces — {@see CatalogSource}, {@see OrderTarget}, {@see WebhookHandler} —
 * as container bindings. Sync jobs, the order pipeline and the webhook
 * controller depend on these contracts, never on a concrete provider, so the
 * whole integration is swapped by changing one config value.
 */
class ErpServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ErpProvider::class, function (): ErpProvider {
            $key = (string) config('erp.provider');
            $providers = (array) config('erp.providers');

            if (! isset($providers[$key])) {
                throw new InvalidArgumentException("Unknown ERP provider [{$key}]. Register it in config/erp.php.");
            }

            return $this->app->make($providers[$key]);
        });

        $this->app->singleton(CatalogSource::class, fn (): CatalogSource => $this->app->make(ErpProvider::class)->catalog());
        $this->app->singleton(OrderTarget::class, fn (): OrderTarget => $this->app->make(ErpProvider::class)->orders());
        $this->app->singleton(WebhookHandler::class, fn (): WebhookHandler => $this->app->make(ErpProvider::class)->webhooks());
    }
}
