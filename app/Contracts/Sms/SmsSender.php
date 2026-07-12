<?php

declare(strict_types=1);

namespace App\Contracts\Sms;

/**
 * Outbound SMS transport. Same swappable-provider pattern as Contracts\Erp:
 * the concrete driver is picked by config('sms.driver') in SmsServiceProvider.
 */
interface SmsSender
{
    /**
     * @param  string  $phone  E.164 (+7XXXXXXXXXX) — normalize before calling.
     *
     * @throws \RuntimeException When the provider rejects the message.
     */
    public function send(string $phone, string $message): void;
}
