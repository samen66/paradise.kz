<?php

declare(strict_types=1);

namespace App\Services\MoySklad;

use App\Contracts\Erp\WebhookHandler;
use App\Jobs\Catalog\DeactivateProductJob;
use App\Jobs\Catalog\SyncSingleProductJob;
use App\Jobs\Catalog\SyncStockJob;
use App\Jobs\Catalog\SyncStoresJob;
use App\Jobs\Erp\SyncOrderStatusJob;
use App\Services\MoySklad\Webhook\WebhookEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * MoySklad implementation of the {@see WebhookHandler} contract.
 *
 * Two payload shapes arrive on the same URL:
 *  - entity webhooks: `{ events: [{ meta:{type,href}, action }] }`
 *  - stock webhooks:  `{ stockType, reportType, reportUrl }`
 *
 * @see docs/moysklad-integration-notes.md §9
 */
class MoySkladWebhookHandler implements WebhookHandler
{
    /** How long a processed requestId is remembered to drop MoySklad retries. */
    private const DEDUPE_TTL_MINUTES = 10;

    public function verify(Request $request): bool
    {
        $expected = config('moysklad.webhook_secret');

        // No secret configured → skip the check so local dev works.
        if (blank($expected)) {
            return true;
        }

        $provided = $request->query('secret') ?? $request->header('X-Webhook-Secret');

        return is_string($provided) && hash_equals((string) $expected, $provided);
    }

    public function isDuplicate(Request $request): bool
    {
        $requestId = $request->query('requestId');

        if (! is_string($requestId) || $requestId === '') {
            return false;
        }

        // Cache::add is atomic: returns false when the key already exists.
        return ! Cache::add(
            "moysklad:webhook:{$requestId}",
            true,
            now()->addMinutes(self::DEDUPE_TTL_MINUTES),
        );
    }

    public function dispatch(Request $request): void
    {
        if ($request->has('stockType')) {
            $this->dispatchStockSync($request);

            return;
        }

        foreach (WebhookEvent::collect($request->input('events')) as $event) {
            match (true) {
                $event->entityType === 'product' && $event->action === 'DELETE' => DeactivateProductJob::dispatch($event->entityId),
                $event->entityType === 'product' => SyncSingleProductJob::dispatch($event->entityId),
                // A new/renamed warehouse: re-mirror all stores (few, idempotent).
                $event->entityType === 'store' => SyncStoresJob::dispatch(),
                // Order fulfilment state changed inside MoySklad.
                $event->entityType === 'customerorder' => SyncOrderStatusJob::dispatch($event->entityId),
                default => null,
            };
        }
    }

    private function dispatchStockSync(Request $request): void
    {
        // reportUrl carries the exact delta window, e.g.
        // ".../report/stock/bystore/current?changedSince=2026-06-30 12:00:00".
        $reportUrl = $request->input('reportUrl');
        $changedSince = is_string($reportUrl) ? $this->changedSinceFromUrl($reportUrl) : null;

        SyncStockJob::dispatch($changedSince);
    }

    private function changedSinceFromUrl(string $reportUrl): ?string
    {
        $query = parse_url($reportUrl, PHP_URL_QUERY);

        if (! is_string($query)) {
            return null;
        }

        parse_str($query, $params);
        $changedSince = $params['changedSince'] ?? null;

        return is_string($changedSince) && $changedSince !== '' ? $changedSince : null;
    }
}
