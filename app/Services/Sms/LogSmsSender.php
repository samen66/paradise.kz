<?php

declare(strict_types=1);

namespace App\Services\Sms;

use App\Contracts\Sms\SmsSender;
use Illuminate\Support\Facades\Log;

/**
 * Local-development driver: SMS ends up in the log instead of a phone.
 */
class LogSmsSender implements SmsSender
{
    public function send(string $phone, string $message): void
    {
        Log::info("SMS to {$phone}: {$message}");
    }
}
