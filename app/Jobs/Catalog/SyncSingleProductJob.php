<?php

declare(strict_types=1);

namespace App\Jobs\Catalog;

use App\Contracts\Catalog\CatalogSource;
use App\Models\Product;
use App\Support\Translations;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Carbon;

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

        // Translatable JSON columns: merge the ERP's ru content into any
        // existing translations so admin-authored kk values survive re-syncs.
        $current = Product::query()
            ->toBase()
            ->where('source', $sourceKey)
            ->where('external_id', $product->externalId)
            ->first(['name', 'description']);

        Product::query()->upsert(
            [[
                'source' => $sourceKey,
                'external_id' => $product->externalId,
                'external_folder_id' => $product->externalFolderId,
                'name' => Translations::mergeRu($current->name ?? null, $product->name),
                'code' => $product->code,
                'article' => $product->article,
                'description' => Translations::mergeRu($current->description ?? null, $product->description),
                'retail_price' => $product->retailPrice,
                'b2b_price' => $product->b2bPrice,
                'purchase_price' => $product->purchasePrice,
                'min_price' => $product->minPrice,
                'uom' => $product->uom,
                'weight' => $product->weight,
                'volume' => $product->volume,
                'country' => $product->country,
                'supplier' => $product->supplier,
                'barcodes' => json_encode($product->barcodes, JSON_UNESCAPED_UNICODE),
                'attributes' => json_encode($product->attributes, JSON_UNESCAPED_UNICODE),
                // Insert default only — excluded from the update set below.
                'is_active' => true,
                'synced_at' => Carbon::now(),
            ]],
            ['source', 'external_id'],
            [
                'external_folder_id',
                'name',
                'code',
                'article',
                'description',
                'retail_price',
                'b2b_price',
                'purchase_price',
                'min_price',
                'uom',
                'weight',
                'volume',
                'country',
                'supplier',
                'barcodes',
                'attributes',
                'synced_at',
            ],
        );

        if ($product->images !== []) {
            SyncProductImagesJob::dispatch($sourceKey, $product->externalId, $product->images);
        }
    }
}
