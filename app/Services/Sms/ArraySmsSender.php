<?php

declare(strict_types=1);

namespace App\Services\Sms;

use App\Contracts\Sms\SmsSender;

/**
 * Test driver: collects sent messages in memory so tests can assert on them.
 * Registered as a singleton by SmsServiceProvider, so resolving the contract
 * in a test returns the same instance the app wrote to.
 */
class ArraySmsSender implements SmsSender
{
    /** @var list<array{phone: string, message: string}> */
    public array $sent = [];

    public function send(string $phone, string $message): void
    {
        $this->sent[] = ['phone' => $phone, 'message' => $message];
    }

    public function lastMessageFor(string $phone): ?string
    {
        foreach (array_reverse($this->sent) as $entry) {
            if ($entry['phone'] === $phone) {
                return $entry['message'];
            }
        }

        return null;
    }
}
