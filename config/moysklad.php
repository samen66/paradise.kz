<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | MoySklad JSON API (remap 1.2)
    |--------------------------------------------------------------------------
    |
    | MoySklad is the source of truth for products, stock and prices. We only
    | mirror that data locally. See docs/moysklad-integration-notes.md.
    |
    */

    'base_url' => env('MOYSKLAD_BASE_URL', 'https://api.moysklad.ru/api/remap/1.2'),

    // Bearer access token (POST /security/token once, then store it here).
    'token' => env('MOYSKLAD_TOKEN'),

    // Optional Basic Auth fallback used only to obtain a token.
    'login' => env('MOYSKLAD_LOGIN'),
    'password' => env('MOYSKLAD_PASSWORD'),

    // meta.href fetched once from GET /entity/organization. Warehouses are no
    // longer a single static config value — each order carries its own
    // Store (mirrored from GET /entity/store), see App\Models\Store.
    'organization_href' => env('MOYSKLAD_ORGANIZATION_HREF'),

    // priceType.id of the wholesale/B2B price (GET /context/companysettings/pricetype).
    'b2b_price_type_id' => env('MOYSKLAD_B2B_PRICE_TYPE_ID'),

    // Default VAT percent applied to order positions (Kazakhstan = 12).
    'vat_percent' => (int) env('MOYSKLAD_VAT_PERCENT', 12),

    // Shared secret used to verify incoming webhook calls (query param / header).
    'webhook_secret' => env('MOYSKLAD_WEBHOOK_SECRET'),

    /*
    |--------------------------------------------------------------------------
    | Webhook subscriptions
    |--------------------------------------------------------------------------
    |
    | The set of MoySklad webhooks the `moysklad:webhooks` command keeps
    | registered. `callback_url` is the public endpoint MoySklad POSTs to; the
    | command appends `?secret=<webhook_secret>` automatically. `entity` are
    | regular entity webhooks (POST /entity/webhook); `stock` is the special
    | stock-change webhook (POST /entity/webhookstock) whose payload carries a
    | ready-to-fetch report URL.
    |
    */

    'webhooks' => [
        // Falls back to <app.url>/api/moysklad/webhook inside the command.
        'callback_url' => env('MOYSKLAD_WEBHOOK_URL'),

        'entity' => [
            ['entityType' => 'product', 'action' => 'CREATE'],
            ['entityType' => 'product', 'action' => 'UPDATE'],
            ['entityType' => 'product', 'action' => 'DELETE'],

            // A new or renamed warehouse should appear for clients instantly,
            // not only on the next 15-min fallback sync.
            ['entityType' => 'store', 'action' => 'CREATE'],
            ['entityType' => 'store', 'action' => 'UPDATE'],

            // Order fulfilment state changes flow back onto orders.external_state.
            // Only UPDATE: our own CREATE is suppressed via DisableByPrefix.
            ['entityType' => 'customerorder', 'action' => 'UPDATE'],
        ],

        'stock' => [
            'enabled' => true,
            // 'all' (aggregate) or 'bystore' — we mirror per warehouse.
            'report_type' => 'bystore',
        ],
    ],

    'http' => [
        'timeout' => (int) env('MOYSKLAD_HTTP_TIMEOUT', 30),
        'retries' => (int) env('MOYSKLAD_HTTP_RETRIES', 3),
        'page_limit' => 1000, // API hard max per page.
    ],

];
