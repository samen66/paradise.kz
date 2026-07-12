<?php

declare(strict_types=1);

namespace App\Contracts\Erp;

use Illuminate\Http\Request;

/**
 * The inbound-webhook surface of an {@see ErpProvider}.
 *
 * The external system calls one shared, unauthenticated endpoint; the active
 * provider's handler verifies the request and dispatches the appropriate
 * (provider-neutral) sync jobs. Handlers must answer fast — only validate,
 * dedupe and enqueue, never sync inline.
 */
interface WebhookHandler
{
    /**
     * Verify the request is genuinely from the external system (shared secret,
     * signature, ...). Return false to reject with 401.
     */
    public function verify(Request $request): bool;

    /**
     * Whether this request has already been processed (retry/duplicate). Lets
     * the controller answer 2xx without re-dispatching jobs.
     */
    public function isDuplicate(Request $request): bool;

    /**
     * Translate the payload into targeted sync jobs and dispatch them. Must not
     * perform the sync inline.
     */
    public function dispatch(Request $request): void;
}
