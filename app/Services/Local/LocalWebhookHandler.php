<?php

declare(strict_types=1);

namespace App\Services\Local;

use App\Contracts\Erp\WebhookHandler;
use Illuminate\Http\Request;

/**
 * The "no external accounting system" webhook handler.
 *
 * Nothing calls us, so every request is rejected at verification. The webhook
 * route itself is removed from routes/api.php; this exists so the container
 * binding stays resolvable and any leftover caller fails closed (401) rather
 * than open.
 */
class LocalWebhookHandler implements WebhookHandler
{
    public function verify(Request $request): bool
    {
        return false;
    }

    public function isDuplicate(Request $request): bool
    {
        return false;
    }

    public function dispatch(Request $request): void
    {
        // No external system to receive notifications from.
    }
}
