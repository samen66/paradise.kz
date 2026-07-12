<?php

declare(strict_types=1);

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
    | MoySklad is the default. Every mirrored row records its originating
    | `source` (the provider key) so rows from different providers can coexist
    | (unique per source + external_id).
    |
    */

    'provider' => env('ERP_PROVIDER', 'moysklad'),

    /**
     * Map of provider key => ErpProvider implementation. The active provider is
     * resolved from the `provider` value above. Register new integrations here.
     */
    'providers' => [
        'moysklad' => MoySkladErpProvider::class,
    ],

];
