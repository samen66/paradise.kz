<?php

declare(strict_types=1);

namespace App\Jobs\Catalog;

use App\Contracts\Catalog\CatalogSource;
use App\Models\ProductFolder;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Mirror the ERP's product folders (categories) into product_folders.
 *
 * The ERP is the source of truth (AGENTS.md #1): every folder is upserted by its
 * source + external_id; we never originate categories locally.
 */
class SyncProductFoldersJob implements ShouldQueue
{
    use Queueable;

    /** Rows to buffer before flushing an upsert batch. */
    private const BATCH_SIZE = 500;

    public function handle(CatalogSource $source): void
    {
        $sourceKey = $source->key();
        $batch = [];

        foreach ($source->productFolders() as $folder) {
            $batch[] = [
                'source' => $sourceKey,
                'external_id' => $folder->externalId,
                'parent_external_id' => $folder->parentExternalId,
                'name' => $folder->name,
                'path_name' => $folder->pathName,
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
        ProductFolder::query()->upsert(
            $batch,
            ['source', 'external_id'],
            ['parent_external_id', 'name', 'path_name'],
        );
    }
}
