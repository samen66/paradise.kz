<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;

/**
 * Backfills storefront slugs for products created without one — pre-existing
 * rows and rows inserted by the ERP sync's bulk upserts (which bypass the
 * model event that normally assigns a slug). Scheduled after each sync window.
 */
class GenerateProductSlugsCommand extends Command
{
    protected $signature = 'catalog:generate-product-slugs';

    protected $description = 'Generate storefront URL slugs for products that have none';

    public function handle(): int
    {
        $generated = 0;

        Product::query()
            ->whereNull('slug')
            ->chunkById(500, function ($products) use (&$generated): void {
                foreach ($products as $product) {
                    $product->slug = $product->generateSlug();
                    $product->saveQuietly();
                    $generated++;
                }
            });

        $this->info("Generated {$generated} slug(s).");

        return self::SUCCESS;
    }
}
