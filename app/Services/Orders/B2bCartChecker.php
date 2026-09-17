<?php

declare(strict_types=1);

namespace App\Services\Orders;

use App\Models\CatalogSetting;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\Store;
use App\Models\User;
use App\Services\Catalog\VisibilityService;
use App\Services\Pricing\PricingService;

/**
 * The one set of rules deciding whether a B2B client may order a cart line
 * from a warehouse: the product is visible to the client, has a price, meets
 * the minimum order quantity and fits the stock AT THAT warehouse.
 *
 * Both the cart check (POST /api/cart/validate) and order placement
 * ({@see OrderPlacementService::place()}) run through here, so the portal
 * never shows a cart as fine that checkout would then reject. The stock read
 * is the product_store_stock projection — a fast pre-check; the lock-guarded
 * FIFO issue() inside the order transaction stays the final word.
 *
 * Batched: a fixed number of queries whatever the cart size.
 */
class B2bCartChecker
{
    public const PROBLEM_UNAVAILABLE = 'unavailable';

    public const PROBLEM_NO_PRICE = 'no_price';

    public const PROBLEM_BELOW_MIN_QTY = 'below_min_qty';

    public const PROBLEM_INSUFFICIENT_STOCK = 'insufficient_stock';

    public function __construct(
        private readonly VisibilityService $visibility,
        private readonly PricingService $pricing,
    ) {}

    /**
     * @param  array<int, array{product_id: int|string, quantity: int|float|string}>  $items
     * @return array<int, array{product_id: int, quantity: float, product: Product|null, price: int|null, stock: float, min_qty: int, problem: string|null}>
     *                                                                                                                                                       One line per item, same keys/order; `price` in kopecks.
     */
    public function check(User $user, Store $store, array $items): array
    {
        $productIds = array_map(static fn (array $item): int => (int) $item['product_id'], $items);

        $products = Product::query()
            ->whereIn('id', $productIds)
            ->with(['media', 'externalMapping'])
            ->get()
            ->keyBy('id');

        $visibleIds = $this->visibility->visibleProductQuery($user)
            ->whereIn('products.id', $productIds)
            ->pluck('products.id')
            ->flip();

        $prices = $this->pricing->priceForMany($user, $products);

        $stocks = ProductStoreStock::query()
            ->where('store_id', $store->id)
            ->whereIn('product_id', $productIds)
            ->pluck('stock', 'product_id');

        // Product::effectiveB2bMinOrderQty() per line would re-read the
        // settings row for every product; same rule, read once.
        $defaultMinQty = CatalogSetting::current()->b2b_default_min_order_qty ?? 1;

        $lines = [];

        foreach ($items as $index => $item) {
            $productId = (int) $item['product_id'];
            $quantity = (float) $item['quantity'];
            $product = $products->get($productId);
            $price = $prices[$productId] ?? null;
            // The order ships from exactly one warehouse, so only its balance
            // counts — zero included, never the all-warehouse aggregate.
            $stock = (float) ($stocks[$productId] ?? 0);
            $minQty = $product?->b2b_min_order_qty ?? $defaultMinQty;

            $lines[$index] = [
                'product_id' => $productId,
                'quantity' => $quantity,
                'product' => $product,
                'price' => $price,
                'stock' => $stock,
                'min_qty' => $minQty,
                'problem' => match (true) {
                    $product === null, ! $visibleIds->has($productId) => self::PROBLEM_UNAVAILABLE,
                    $price === null => self::PROBLEM_NO_PRICE,
                    $quantity < $minQty => self::PROBLEM_BELOW_MIN_QTY,
                    $quantity > $stock => self::PROBLEM_INSUFFICIENT_STOCK,
                    default => null,
                },
            ];
        }

        return $lines;
    }
}
