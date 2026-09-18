<?php

declare(strict_types=1);

namespace App\Observers;

use App\Events\ProductUpdated;
use App\Jobs\RevalidateStorefrontCacheJob;
use App\Models\Product;

/**
 * Invalidates the Next.js storefront cache whenever a product is created,
 * updated, or deleted in the admin panel (Filament) or via the ERP sync.
 * Also broadcasts real-time updates for connected clients.
 */
class ProductObserver
{
    public function saved(Product $product): void
    {
        $this->revalidate($product);
        ProductUpdated::dispatch($product);
    }

    public function deleted(Product $product): void
    {
        $this->revalidate($product);
    }

    private function revalidate(Product $product): void
    {
        $tags = ['products'];

        if ($product->slug) {
            $tags[] = "product-{$product->slug}";
        }

        // After commit: stock changes happen inside FIFO transactions, and a
        // storefront refetch that ran before the commit would re-cache the
        // old figures.
        RevalidateStorefrontCacheJob::dispatch($tags)->afterCommit();
    }
}
