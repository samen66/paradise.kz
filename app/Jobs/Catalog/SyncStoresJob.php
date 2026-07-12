<?php

declare(strict_types=1);

namespace App\Jobs\Catalog;

use App\Contracts\Catalog\CatalogSource;
use App\Models\Store;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Mirror the ERP's warehouses (stores) into the local stores table.
 *
 * The ERP is the source of truth (AGENTS.md #1), but `is_active` is a
 * LOCAL-ONLY flag (admins use it to hide a warehouse from clients). It is set
 * only on INSERT (new stores default visible) and is deliberately excluded
 * from the update column list, so a re-sync never resets an admin's choice.
 */
class SyncStoresJob implements ShouldQueue
{
    use Queueable;

    /** Rows to buffer before flushing an upsert batch. */
    private const BATCH_SIZE = 500;

    public function handle(CatalogSource $source): void
    {
        $sourceKey = $source->key();
        $batch = [];

        foreach ($source->stores() as $store) {
            $batch[] = [
                'source' => $sourceKey,
                'external_id' => $store->externalId,
                'name' => $store->name,
                // Insert default only — excluded from the update set below.
                'is_active' => true,
            ];

            if (count($batch) >= self::BATCH_SIZE) {
                $this->flush($batch);
                $batch = [];
            }
        }

        if ($batch !== []) {
            $this->flush($batch);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $batch
     */
    private function flush(array $batch): void
    {
        Store::query()->upsert($batch, ['source', 'external_id'], ['name']);
    }
}
