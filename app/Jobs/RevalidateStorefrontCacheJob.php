<?php

declare(strict_types=1);

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Fires a POST to the Next.js on-demand revalidation endpoint so that cached
 * pages (catalog, product detail, home) are purged after admin edits. Queued
 * to avoid blocking the Filament save response.
 */
class RevalidateStorefrontCacheJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /** Give the storefront 10 s to respond before giving up. */
    public int $tries = 3;

    public int $backoff = 5;

    /**
     * @param  string|list<string>  $tags  Cache tag(s) to purge.
     */
    public function __construct(
        private readonly string|array $tags,
    ) {}

    public function handle(): void
    {
        $baseUrl = config('services.storefront.url');
        $secret = config('services.storefront.revalidation_secret');

        if (! $baseUrl || ! $secret) {
            Log::warning('RevalidateStorefrontCacheJob: STOREFRONT_URL or STOREFRONT_REVALIDATION_SECRET not set, skipping.');

            return;
        }

        $tags = is_array($this->tags) ? $this->tags : [$this->tags];

        foreach ($tags as $tag) {
            $response = Http::timeout(10)
                ->post(rtrim($baseUrl, '/').'/api/revalidate', [
                    'tag' => $tag,
                    'secret' => $secret,
                ]);

            if ($response->successful()) {
                Log::info("Storefront cache revalidated: tag={$tag}");
            } else {
                Log::warning("Storefront revalidation failed for tag={$tag}: HTTP {$response->status()}");
            }
        }
    }
}
