<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\MoySklad\MoySkladService;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Reconcile the MoySklad webhook subscriptions declared in config/moysklad.php
 * with what is actually registered on the account.
 *
 * Idempotent: creates the webhooks that are missing and leaves matching ones
 * untouched. Pass --prune to also delete webhooks that point at our callback URL
 * but are no longer in the desired set. The callback URL is matched ignoring the
 * query string, so a rotated `?secret=` does not cause a duplicate.
 */
class RegisterMoySkladWebhooksCommand extends Command
{
    protected $signature = 'moysklad:webhooks {--prune : Delete our webhooks that are not in the desired set}';

    protected $description = 'Register/reconcile MoySklad webhooks from config';

    public function handle(MoySkladService $moySklad): int
    {
        $callbackUrl = $this->callbackUrl();
        $this->info("Reconciling MoySklad webhooks against {$this->baseUrl($callbackUrl)} ...");

        $this->reconcileEntityWebhooks($moySklad, $callbackUrl);
        $this->reconcileStockWebhook($moySklad, $callbackUrl);

        $this->info('Done.');

        return self::SUCCESS;
    }

    private function reconcileEntityWebhooks(MoySkladService $moySklad, string $callbackUrl): void
    {
        $base = $this->baseUrl($callbackUrl);
        $existing = $moySklad->webhooks('webhook');
        $ours = array_filter($existing, fn (array $row): bool => $this->baseUrl((string) ($row['url'] ?? '')) === $base);

        /** @var list<array{entityType: string, action: string}> $desired */
        $desired = config('moysklad.webhooks.entity', []);
        $keep = [];

        foreach ($desired as $sub) {
            $entityType = $sub['entityType'];
            $action = strtoupper($sub['action']);
            $keep[] = $this->entityKey($entityType, $action);

            if ($this->findEntityWebhook($ours, $entityType, $action) !== null) {
                $this->line("  ✓ {$entityType} {$action} (already registered)");

                continue;
            }

            $body = [
                'url' => $callbackUrl,
                'action' => $action,
                'entityType' => $entityType,
                'method' => 'POST',
            ];

            // FIELDS makes UPDATE events include updatedFields[].
            if ($action === 'UPDATE') {
                $body['diffType'] = 'FIELDS';
            }

            $moySklad->createWebhook($body, 'webhook');
            $this->line("  + {$entityType} {$action} (created)");
        }

        $this->pruneEntityWebhooks($moySklad, $ours, $keep);
    }

    /**
     * @param  list<array<string, mixed>>  $ours
     * @param  list<string>  $keep
     */
    private function pruneEntityWebhooks(MoySkladService $moySklad, array $ours, array $keep): void
    {
        if (! $this->option('prune')) {
            return;
        }

        foreach ($ours as $row) {
            $key = $this->entityKey((string) ($row['entityType'] ?? ''), strtoupper((string) ($row['action'] ?? '')));

            if (in_array($key, $keep, true) || ! isset($row['id'])) {
                continue;
            }

            $moySklad->deleteWebhook((string) $row['id'], 'webhook');
            $this->line("  - {$row['entityType']} {$row['action']} (pruned)");
        }
    }

    private function reconcileStockWebhook(MoySkladService $moySklad, string $callbackUrl): void
    {
        $config = config('moysklad.webhooks.stock', []);
        $base = $this->baseUrl($callbackUrl);
        $existing = $moySklad->webhooks('webhookstock');
        $ours = array_filter($existing, fn (array $row): bool => $this->baseUrl((string) ($row['url'] ?? '')) === $base);

        if (! ($config['enabled'] ?? false)) {
            // Stock webhooks disabled in config: prune ours if asked, else skip.
            if ($this->option('prune')) {
                foreach ($ours as $row) {
                    if (isset($row['id'])) {
                        $moySklad->deleteWebhook((string) $row['id'], 'webhookstock');
                        $this->line('  - stock (pruned)');
                    }
                }
            }

            return;
        }

        if ($ours !== []) {
            $this->line('  ✓ stock (already registered)');

            return;
        }

        $moySklad->createWebhook([
            'url' => $callbackUrl,
            'stockType' => 'stock',
            'reportType' => $config['report_type'] ?? 'bystore',
        ], 'webhookstock');

        $this->line('  + stock (created)');
    }

    /**
     * @param  list<array<string, mixed>>  $webhooks
     * @return array<string, mixed>|null
     */
    private function findEntityWebhook(array $webhooks, string $entityType, string $action): ?array
    {
        foreach ($webhooks as $row) {
            if (($row['entityType'] ?? null) === $entityType
                && strtoupper((string) ($row['action'] ?? '')) === $action) {
                return $row;
            }
        }

        return null;
    }

    private function callbackUrl(): string
    {
        $url = config('moysklad.webhooks.callback_url')
            ?: rtrim((string) config('app.url'), '/').'/api/moysklad/webhook';

        $secret = config('moysklad.webhook_secret');

        return blank($secret)
            ? (string) $url
            : (string) $url.'?secret='.urlencode((string) $secret);
    }

    private function baseUrl(string $url): string
    {
        return Str::before($url, '?');
    }

    private function entityKey(string $entityType, string $action): string
    {
        return $entityType.':'.$action;
    }
}
