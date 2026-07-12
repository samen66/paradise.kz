<?php

declare(strict_types=1);

namespace App\Providers;

use App\Contracts\Sms\SmsSender;
use Illuminate\Support\ServiceProvider;
use InvalidArgumentException;

/**
 * Wires the active SMS driver (config sms.driver) behind the {@see SmsSender}
 * contract — same swappable-provider pattern as {@see ErpServiceProvider}.
 * Singleton so tests resolving the `array` driver see the messages the app
 * sent.
 */
class SmsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(SmsSender::class, function (): SmsSender {
            $key = config()->string('sms.driver');
            $drivers = config()->array('sms.drivers');

            if (! isset($drivers[$key])) {
                throw new InvalidArgumentException("Unknown SMS driver [{$key}]. Register it in config/sms.php.");
            }

            return $this->app->make($drivers[$key]);
        });
    }
}
