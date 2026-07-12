<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Jobs\Catalog\SyncProductFoldersJob;
use App\Jobs\Catalog\SyncProductsJob;
use App\Jobs\Catalog\SyncProductVariantsJob;
use App\Jobs\Catalog\SyncStockJob;
use App\Jobs\Catalog\SyncStoresJob;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Bus;

/**
 * Trigger a MoySklad mirror sync (folders → products → stock).
 *
 * Run with no options for a full sync; pass --since for an incremental delta.
 * Folders must finish before products so external_folder_id links resolve, so
 * the jobs run as a chain.
 */
class SyncMoySkladCommand extends Command
{
    protected $signature = 'moysklad:sync {--since= : Y-m-d H:i:s for an incremental sync}';

    protected $description = 'Sync product folders, products and stock from MoySklad';

    public function handle(): int
    {
        /** @var string|null $since */
        $since = $this->option('since');

        $this->info($since === null
            ? 'Starting full MoySklad sync (folders → products → stores → stock)...'
            : "Starting incremental MoySklad sync since {$since}...");

        Bus::chain([
            new SyncProductFoldersJob,
            new SyncProductsJob($since),
            new SyncProductVariantsJob($since),
            new SyncStoresJob,
            new SyncStockJob($since),
        ])->dispatch();

        $this->info('MoySklad sync jobs dispatched.');

        return self::SUCCESS;
    }
}
