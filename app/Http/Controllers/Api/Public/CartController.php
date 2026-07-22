<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\Public\ValidateCartRequest;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Services\Catalog\StoreResolver;
use App\Services\Catalog\VisibilityService;
use App\Services\Orders\DeliveryCostCalculator;
use App\Services\Pricing\PricingService;
use Illuminate\Http\JsonResponse;

/**
 * Pre-checkout revalidation of a client-side cart: current retail prices,
 * availability at the chosen store, and delivery cost. Pure read — checkout
 * itself re-validates authoritatively inside a transaction
 * (OrderPlacementService), this endpoint exists so the cart page shows
 * accurate numbers before the customer commits.
 */
class CartController extends Controller
{
    public function __construct(
        private readonly VisibilityService $visibility,
        private readonly PricingService $pricing,
        private readonly StoreResolver $stores,
        private readonly DeliveryCostCalculator $deliveryCalculator,
    ) {}

    public function validateCart(ValidateCartRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $store = $this->stores->resolve(null, isset($validated['store_id']) ? (int) $validated['store_id'] : null);

        $productIds = array_column($validated['items'], 'product_id');

        $products = Product::query()
            ->whereIn('id', $productIds)
            ->with('media')
            ->get()
            ->keyBy('id');

        $publiclyVisibleIds = $this->visibility->publicProductQuery()
            ->whereIn('products.id', $productIds)
            ->pluck('products.id')
            ->flip();

        $prices = $this->pricing->retailPriceForMany($products);

        $stocks = $store === null ? collect() : ProductStoreStock::query()
            ->where('store_id', $store->id)
            ->whereIn('product_id', $productIds)
            ->pluck('stock', 'product_id');

        $subtotal = 0; // kopecks, over valid lines only
        $lines = [];

        foreach ($validated['items'] as $item) {
            $productId = (int) $item['product_id'];
            $quantity = (float) $item['quantity'];
            $product = $products->get($productId);
            $price = $prices[$productId] ?? null;
            $stock = (float) ($stocks[$productId] ?? 0);

            $problem = match (true) {
                $product === null, ! $publiclyVisibleIds->has($productId) => 'unavailable',
                $price === null => 'no_price',
                $quantity > $stock => 'insufficient_stock',
                default => null,
            };

            if ($problem === null) {
                $subtotal += (int) round($price * $quantity);
            }

            $lines[] = [
                'product_id' => $productId,
                'quantity' => $quantity,
                'available' => $problem === null,
                'problem' => $problem,
                'name' => $product?->name,
                'slug' => $product?->slug,
                'article' => $product?->article,
                'image' => $product?->getFirstMediaUrl(Product::IMAGE_COLLECTION, 'thumb') ?: null,
                'price' => $price === null ? null : $price / 100,
                'stock' => $stock,
            ];
        }

        $deliveryCost = $this->deliveryCalculator->costFor($subtotal);

        return new JsonResponse([
            'data' => [
                'store_id' => $store?->id,
                'items' => $lines,
                'subtotal' => $subtotal / 100,
                // What delivery would cost for this subtotal; pickup is free.
                'delivery_cost' => $deliveryCost / 100,
                'total_with_delivery' => ($subtotal + $deliveryCost) / 100,
                'total_pickup' => $subtotal / 100,
            ],
        ]);
    }
}
