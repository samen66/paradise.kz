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
                'barcodes' => json_encode($product->barcodes, JSON_UNESCAPED_UNICODE),
                'attributes' => json_encode($product->attributes, JSON_UNESCAPED_UNICODE),
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
        $batch = $this->mergeTranslatables($batch);

        // `is_active` is intentionally absent here: on UPDATE it must keep the
        // local value; it is only written when the row is first INSERTed.
        Product::query()->upsert(
            $batch,
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
    }

    /**
     * `name`/`description` are translatable JSON columns, but the ERP only
     * supplies ru content. Merge each row's ru value into the translations
     * already stored for that product so a re-sync never wipes admin-authored
     * kk translations. One extra SELECT per batch.
     *
     * @param  array<int, array<string, mixed>>  $batch
     * @return array<int, array<string, mixed>>
     */
    private function mergeTranslatables(array $batch): array
    {
        $existing = Product::query()
            ->toBase()
            ->where('source', $batch[0]['source'])
            ->whereIn('external_id', array_column($batch, 'external_id'))
            ->get(['external_id', 'name', 'description'])
            ->keyBy('external_id');

        foreach ($batch as &$row) {
            $current = $existing[$row['external_id']] ?? null;
            $row['name'] = Translations::mergeRu($current->name ?? null, $row['name']);
            $row['description'] = Translations::mergeRu($current->description ?? null, $row['description']);
        }

        return $batch;
    }
}
