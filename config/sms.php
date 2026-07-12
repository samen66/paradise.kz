<?php

declare(strict_types=1);

use App\Services\Sms\ArraySmsSender;
use App\Services\Sms\LogSmsSender;
use App\Services\Sms\MobizonSmsSender;

return [

    /*
    |--------------------------------------------------------------------------
    | SMS driver
    |--------------------------------------------------------------------------
    |
    | Which App\Contracts\Sms\SmsSender implementation to bind. `log` writes
    | messages to the log (local dev), `array` collects them in memory (tests),
    | `mobizon` sends real SMS through mobizon.kz.
    |
    */

    'driver' => env('SMS_DRIVER', 'log'),

    'drivers' => [
        'log' => LogSmsSender::class,
        'array' => ArraySmsSender::class,
        'mobizon' => MobizonSmsSender::class,
    ],

    'mobizon' => [
        'api_key' => env('MOBIZON_API_KEY'),
        'base_url' => env('MOBIZON_BASE_URL', 'https://api.mobizon.kz'),
    ],

];
