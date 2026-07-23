<?php

namespace App\Providers;

use App\Models\Order;
use App\Observers\OrderObserver;
use App\Services\MoySklad\MoySkladClient;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(MoySkladClient::class, function (): MoySkladClient {
            return new MoySkladClient(
                baseUrl: (string) config('moysklad.base_url'),
                token: config('moysklad.token'),
                timeout: (int) config('moysklad.http.timeout'),
                maxRetries: (int) config('moysklad.http.retries'),
                pageLimit: (int) config('moysklad.http.page_limit'),
            );
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Order::observe(OrderObserver::class);
    }
}
