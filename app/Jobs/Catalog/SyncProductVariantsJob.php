<?php

declare(strict_types=1);

namespace App\Jobs\Catalog;

use App\Contracts\Catalog\CatalogSource;
use App\Models\ProductExternalMapping;
use App\Models\ProductVariant;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Carbon;

/**
 * Mirror the ERP's product variants (modifications) into product_variants,
 * linked to their parent product by source + external_id.
 *
 * Must run AFTER {@see SyncProductsJob} so parent products exist; variants whose
 * parent isn't locally known are skipped. `stock` is preserved across re-syncs
 * (it is fed separately), so it is excluded from the update column set.
 */
class SyncProductVariantsJob implements ShouldQueue
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
        $productIds = ProductExternalMapping::query()->where('source', $sourceKey)->pluck('product_id', 'external_id');
        $batch = [];

        foreach ($source->productVariants($this->changedSince) as $variant) {
            $productId = $productIds[$variant->parentExternalId] ?? null;

            if ($productId === null) {
                continue;
            }

            $batch[] = [
                'product_id' => $productId,
                'source' => $sourceKey,
                'external_id' => $variant->externalId,
                'name' => $variant->name,
                'code' => $variant->code,
                'retail_price' => $variant->retailPrice,
                'b2b_price' => $variant->b2bPrice,
                'barcodes' => json_encode($variant->barcodes, JSON_UNESCAPED_UNICODE),
                'characteristics' => json_encode($variant->characteristics, JSON_UNESCAPED_UNICODE),
                'synced_at' => $now,
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
        // `stock` is intentionally absent: it is fed by a separate stock sync and
        // must not be reset to its insert default on re-sync.
        ProductVariant::query()->upsert(
            $batch,
            ['source', 'external_id'],
            [
                'product_id',
                'name',
                'code',
                'retail_price',
                'b2b_price',
                'barcodes',
                'characteristics',
                'synced_at',
            ],
        );
    }
}
