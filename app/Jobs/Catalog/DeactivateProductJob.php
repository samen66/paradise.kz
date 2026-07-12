<?php

declare(strict_types=1);

namespace App\Jobs\Catalog;

use App\Models\Product;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Handle a `product` DELETE webhook by hiding the local mirror rather than
 * removing it: the row is kept (orders/prices may still reference it) but
 * `is_active` is flipped off so it drops out of the catalog. A deleted product
 * also stops appearing in future ERP syncs, so it will never be re-enabled.
 */
class DeactivateProductJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly string $externalId,
    ) {}

    public function handle(): void
    {
        Product::query()
            ->where('source', (string) config('erp.provider'))
            ->where('external_id', $this->externalId)
            ->update(['is_active' => false]);
    }
}
