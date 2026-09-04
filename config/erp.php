<?php

declare(strict_types=1);

use App\Services\Local\LocalErpProvider;
use App\Services\MoySklad\MoySkladErpProvider;

return [

    /*
    |--------------------------------------------------------------------------
    | ERP / accounting provider
    |--------------------------------------------------------------------------
    |
    | The external accounting system the application mirrors its catalog from and
    | pushes orders to. The whole integration is written against the
    | App\Contracts\Erp\ErpProvider contract (catalog reads, order writes,
    | webhooks), so the provider can be swapped — or new ones added — without
    | touching the sync jobs, order pipeline or controllers.
    |
    | The default is `local`: paradise.kz runs standalone. The catalog is
    | authored in the admin panel and stock is owned by the local FIFO ledger
    | (App\Services\Inventory\FifoInventoryService), which is the single source
    | of truth for on-hand quantities. The local provider's reads return nothing
    | and its writes throw, so no sync job or push path can silently do work.
    |
    | Every mirrored row records its originating `source` (the provider key) so
    | rows from different providers can coexist (unique per source +
    | external_id) — which is what makes adding an ERP back a config change
    | rather than a migration.
    |
    */

    'provider' => env('ERP_PROVIDER', 'local'),

    /**
     * Map of provider key => ErpProvider implementation. The active provider is
     * resolved from the `provider` value above. Register new integrations here.
     */
    'providers' => [
        'local' => LocalErpProvider::class,

        // Legacy. No longer selected by anything at runtime — kept registered
        // only so the existing MoySklad test suite can opt back in explicitly
        // while the integration is being retired. Remove together with
        // app/Services/MoySklad and tests/{Feature,Unit}/MoySklad (task D4).
        'moysklad' => MoySkladErpProvider::class,
    ],

];
