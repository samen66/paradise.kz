<?php

declare(strict_types=1);

namespace App\Jobs\Catalog;

use App\Contracts\Catalog\CatalogSource;
use App\Models\Product;
use App\Models\ProductExternalMapping;
use App\Support\Translations;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Mirror a single ERP product into the local products table, triggered by a
 * `product` CREATE/UPDATE webhook. This is the targeted counterpart to the full
 * {@see SyncProductsJob}: it fetches just the one changed product.
 *
 * `is_active` follows the same rule as the full sync — written only on INSERT,
 * never overwritten on UPDATE, so an admin's hide choice survives re-syncs.
 */
class SyncSingleProductJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly string $externalId,
    ) {}

    public function handle(CatalogSource $source): void
    {
        $product = $source->product($this->externalId);

        // Gone between the webhook firing and our fetch — nothing to mirror.
        if ($product === null) {
            return;
        }

        $sourceKey = $source->key();

        $mapping = ProductExternalMapping::query()
            ->with('product:id,name,description')
            ->where('source', $sourceKey)
            ->where('external_id', $product->externalId)
            ->first();

        $name = Translations::mergeRu($mapping?->product?->getRawOriginal('name'), $product->name);
        $description = Translations::mergeRu($mapping?->product?->getRawOriginal('description'), $product->description);

        $now = Carbon::now();

        DB::transaction(function () use ($mapping, $product, $name, $description, $sourceKey, $now) {
            if ($mapping === null) {
                $localProduct = Product::query()->create([
                    'name' => json_decode($name, true),
                    'code' => $product->code,
                    'article' => $product->article,
                    'description' => json_decode($description, true),
                    'retail_price' => $product->retailPrice,
                    'b2b_price' => $product->b2bPrice,
                    'purchase_price' => $product->purchasePrice,
                    'min_price' => $product->minPrice,
                    'uom' => $product->uom,
                    'weight' => $product->weight,
                    'volume' => $product->volume,
                    'country' => $product->country,
                    'supplier' => $product->supplier,
                    'is_active' => true,
                ]);

                $localProduct->externalMapping()->create([
                    'source' => $sourceKey,
                    'external_id' => $product->externalId,
                    'external_folder_id' => $product->externalFolderId,
                    'synced_at' => $now,
                    'barcodes' => $product->barcodes,
                    'erp_attributes' => $product->attributes,
                ]);
            } else {
                $mapping->product->update([
                    'name' => json_decode($name, true),
                    'code' => $product->code,
                    'article' => $product->article,
                    'description' => json_decode($description, true),
                    'retail_price' => $product->retailPrice,
                    'b2b_price' => $product->b2bPrice,
                    'purchase_price' => $product->purchasePrice,
                    'min_price' => $product->minPrice,
                    'uom' => $product->uom,
                    'weight' => $product->weight,
                    'volume' => $product->volume,
                    'country' => $product->country,
                    'supplier' => $product->supplier,
                ]);

                $mapping->update([
                    'external_folder_id' => $product->externalFolderId,
                    'synced_at' => $now,
                    'barcodes' => $product->barcodes,
                    'erp_attributes' => $product->attributes,
                ]);
            }
        });

        if ($product->images !== []) {
            SyncProductImagesJob::dispatch($sourceKey, $product->externalId, $product->images);
        }
    }
}
