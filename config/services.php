<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'kaspi' => [
        'payment_base_url' => env('KASPI_PAYMENT_BASE_URL', 'https://kaspi.kz/pay'),
        'webhook_secret' => env('KASPI_WEBHOOK_SECRET'),
        'merchant_id' => env('KASPI_MERCHANT_ID'),
    ],

    'whatsapp' => [
        'api_url' => env('WHATSAPP_API_URL'),
        'api_key' => env('WHATSAPP_API_KEY'),
        'instance_id' => env('WHATSAPP_INSTANCE_ID'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // TODO: Replace with real Kaspi Pay merchant API integration.
    // When ready, POST to Kaspi merchant API and return redirect URL from their response.
    'kaspi' => [
        'payment_base_url' => env('KASPI_PAYMENT_BASE_URL', 'https://kaspi.kz/pay/mock'),
    ],

];
