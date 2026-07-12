<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Contracts\Erp\WebhookHandler;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Receives ERP webhook callbacks and enqueues targeted sync jobs.
 *
 * The ERP calls this endpoint directly, so it sits outside auth:sanctum; the
 * active provider's {@see WebhookHandler} verifies the request (shared secret),
 * dedupes retries and dispatches jobs. It must answer 200/204 fast — we only
 * validate, dedupe and enqueue, never sync inline.
 */
class MoySkladWebhookController extends Controller
{
    public function __invoke(Request $request, WebhookHandler $handler): JsonResponse|Response
    {
        if (! $handler->verify($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        // The ERP reuses the same requestId when retrying; skip already-seen ones.
        if ($handler->isDuplicate($request)) {
            return response()->noContent();
        }

        $handler->dispatch($request);

        return response()->noContent();
    }
}
