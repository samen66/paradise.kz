<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Models\Product;
use App\Models\Store;
use RuntimeException;

/**
 * Thrown when an issue would draw more stock than a warehouse holds for a product.
 */
class InsufficientStockException extends RuntimeException
{
    public function __construct(
        public readonly Product $product,
        public readonly Store $store,
        public readonly float $requested,
        public readonly float $available,
    ) {
        parent::__construct(sprintf(
            'Недостаточно товара «%s» на складе «%s»: запрошено %.3f, доступно %.3f.',
            $product->name,
            $store->name,
            $requested,
            $available,
        ));
    }
}
