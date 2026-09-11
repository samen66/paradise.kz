<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;

/**
 * Backfills storefront slugs for products that somehow have none.
 *
 * Products normally get their slug from Product::booted() the moment they are
 * created, and the storefront addresses a product by it — so a product without
 * one has no page. This exists for the rows that bypass model events: bulk
 * `insert()` from a seeder or a future CSV/marketplace import, and anything
 * already in the database from before slugs existed.
 *
 * It used to run on a schedule after every ERP sync window, because those bulk
 * upserts produced slugless rows constantly. There is no sync any more, so it
 * is a repair tool now — run it by hand after an import.
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
