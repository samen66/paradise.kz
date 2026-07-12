<?php

declare(strict_types=1);

namespace App\Services\Sms;

use App\Contracts\Sms\SmsSender;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * mobizon.kz transport (the common SMS gateway for Kazakhstan). API docs:
 * https://help.mobizon.kz/help/api-docs — code 0 in the envelope means queued.
 */
class MobizonSmsSender implements SmsSender
{
    public function send(string $phone, string $message): void
    {
        $response = Http::asForm()
            ->post(rtrim(config()->string('sms.mobizon.base_url'), '/').'/service/message/sendsmsmessage', [
                'apiKey' => config('sms.mobizon.api_key'),
                // Mobizon expects digits without the leading plus.
                'recipient' => ltrim($phone, '+'),
                'text' => $message,
            ]);

        if (! $response->ok() || (int) $response->json('code', -1) !== 0) {
            throw new RuntimeException(
                'Mobizon rejected the SMS: '.($response->json('message') ?? $response->body()),
            );
        }
    }
}
