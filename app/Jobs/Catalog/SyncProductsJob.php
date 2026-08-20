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
 * Mirror the ERP's catalog products into the local products table.
 *
 * The ERP is the source of truth for the synced fields (AGENTS.md #1), but
 * `is_active` is a LOCAL-ONLY flag (admins use it to hide a product). It is set
 * only on INSERT (new products default visible) and is deliberately excluded
 * from the update column list, so a re-sync never resets an admin's choice.
 */
class SyncProductsJob implements ShouldQueue
{
    use Queueable;

    /** Rows to buffer before flushing an upsert batch. */
    private const BATCH_SIZE = 500;

    /**
     * @param  string|null  $changedSince  "Y-m-d H:i:s" for an incremental sync.
     */
    public function __construct(
        private readonly ?string $changedSince = null,
    ) {}

    public function handle(CatalogSource $source): void
    {
        $now = Carbon::now();
        $sourceKey = $source->key();
        $batch = [];

        foreach ($source->products($this->changedSince) as $product) {
            $batch[] = [
                'source' => $sourceKey,
                'external_id' => $product->externalId,
                'external_folder_id' => $product->externalFolderId,
                'name' => $product->name,
                'code' => $product->code,
                'article' => $product->article,
                'description' => $product->description,
                'retail_price' => $product->retailPrice,
                'b2b_price' => $product->b2bPrice,
                'purchase_price' => $product->purchasePrice,
                'min_price' => $product->minPrice,
                'uom' => $product->uom,
                'weight' => $product->weight,
                'volume' => $product->volume,
                'country' => $product->country,
                'supplier' => $product->supplier,
                'barcodes' => $product->barcodes,
                'erp_attributes' => $product->attributes,
                // Insert default only — excluded from the update set below.
                'is_active' => true,
                'synced_at' => $now,
            ];

            // Images are mirrored into our own storage out-of-band; the job
            // diffs against existing media so re-syncs only fetch what changed.
            if ($product->images !== []) {
                SyncProductImagesJob::dispatch($sourceKey, $product->externalId, $product->images);
            }

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
        $source = $batch[0]['source'];
        $externalIds = array_column($batch, 'external_id');

        $existingMappings = ProductExternalMapping::query()
            ->with('product:id,name,description')
            ->where('source', $source)
            ->whereIn('external_id', $externalIds)
            ->get()
            ->keyBy('external_id');

        $productsToUpsert = [];
        $mappingsToUpsert = [];
        $now = Carbon::now();

        DB::transaction(function () use ($batch, $existingMappings, $now, &$productsToUpsert, &$mappingsToUpsert) {
            foreach ($batch as $row) {
                $mapping = $existingMappings->get($row['external_id']);
                
                $name = Translations::mergeRu($mapping?->product?->getRawOriginal('name'), $row['name']);
                $description = Translations::mergeRu($mapping?->product?->getRawOriginal('description'), $row['description']);
                
                if ($mapping === null) {
                    // New product
                    $product = Product::query()->create([
                        'name' => json_decode($name, true),
                        'code' => $row['code'],
                        'article' => $row['article'],
                        'description' => json_decode($description, true),
                        'retail_price' => $row['retail_price'],
                        'b2b_price' => $row['b2b_price'],
                        'purchase_price' => $row['purchase_price'],
                        'min_price' => $row['min_price'],
                        'uom' => $row['uom'],
                        'weight' => $row['weight'],
                        'volume' => $row['volume'],
                        'country' => $row['country'],
                        'supplier' => $row['supplier'],
                        'is_active' => $row['is_active'],
                    ]);
                    
                    $mappingsToUpsert[] = [
                        'product_id' => $product->id,
                        'source' => $row['source'],
                        'external_id' => $row['external_id'],
                        'external_folder_id' => $row['external_folder_id'],
                        'synced_at' => $row['synced_at'],
                        'barcodes' => json_encode($row['barcodes'], JSON_UNESCAPED_UNICODE),
                        'erp_attributes' => json_encode($row['erp_attributes'], JSON_UNESCAPED_UNICODE),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                } else {
                    // Existing product
                    $productsToUpsert[] = [
                        'id' => $mapping->product_id,
                        'name' => $name,
                        'code' => $row['code'],
                        'article' => $row['article'],
                        'description' => $description,
                        'retail_price' => $row['retail_price'],
                        'b2b_price' => $row['b2b_price'],
                        'purchase_price' => $row['purchase_price'],
                        'min_price' => $row['min_price'],
                        'uom' => $row['uom'],
                        'weight' => $row['weight'],
                        'volume' => $row['volume'],
                        'country' => $row['country'],
                        'supplier' => $row['supplier'],
                    ];
                    
                    $mappingsToUpsert[] = [
                        'product_id' => $mapping->product_id,
                        'source' => $row['source'],
                        'external_id' => $row['external_id'],
                        'external_folder_id' => $row['external_folder_id'],
                        'synced_at' => $row['synced_at'],
                        'barcodes' => json_encode($row['barcodes'], JSON_UNESCAPED_UNICODE),
                        'erp_attributes' => json_encode($row['erp_attributes'], JSON_UNESCAPED_UNICODE),
                        'created_at' => clone $mapping->created_at, // pass by value
                        'updated_at' => $now,
                    ];
                }
            }

            if ($productsToUpsert !== []) {
                Product::query()->upsert($productsToUpsert, ['id'], [
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
                ]);
            }
            
            if ($mappingsToUpsert !== []) {
                ProductExternalMapping::query()->upsert($mappingsToUpsert, ['source', 'external_id'], [
                    'external_folder_id',
                    'synced_at',
                    'barcodes',
                    'erp_attributes',
                    'updated_at',
                ]);
            }
        });
    }
}
