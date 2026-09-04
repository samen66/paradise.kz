<?php

declare(strict_types=1);

namespace App\Services\Catalog;

use App\Models\CatalogSetting;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\Store;
use App\Services\Pricing\PricingService;
use Illuminate\Support\Collection;

/**
 * Attaches the transient presentation attributes ProductResource expects
 * (resolved_price, resolved_stock, show_stock_quantity) to a set of public
 * catalog products — shared by every endpoint that lists products for guests
 * (catalog listing, home-page collections). Retail pricing only.
 */
class PublicProductPresenter
{
    public function __construct(
        private readonly PricingService $pricing,
    ) {}

    /**
     * @param  Collection<int, Product>  $products
     */
    public function enrich(Collection $products, ?Store $store): void
    {
        $prices = $this->pricing->retailPriceForMany($products);
        $stocks = $this->stockForMany($store, $products);
        $showStockQuantity = CatalogSetting::current()->show_stock_quantity;

        $products->each(function (Product $product) use ($store, $prices, $stocks, $showStockQuantity): void {
            $product->resolved_price = $prices[$product->id] ?? null;
            // A chosen warehouse answers for itself, zero included: falling back
            // to the all-warehouse aggregate here would mean a sold-out product
            // still advertised as in stock, and checkout rejecting it at 422.
            // With no warehouse resolved, the aggregate IS the answer.
            $product->resolved_stock = $store !== null
                ? (float) ($stocks[$product->id] ?? 0)
                : (float) $product->stock;
            $product->show_stock_quantity = $showStockQuantity;
        });
    }

    /**
     * Free stock for many products at once (no N+1 on the warehouse lookup).
     *
     * @param  Collection<int, Product>  $products
     * @return array<int, float> Keyed by product id → stock.
     */
    private function stockForMany(?Store $store, Collection $products): array
    {
        if ($store === null) {
            return [];
        }

        return ProductStoreStock::query()
            ->where('store_id', $store->id)
            ->whereIn('product_id', $products->pluck('id'))
            ->pluck('stock', 'product_id')
            ->map(fn ($stock): float => (float) $stock)
            ->all();
    }
}
