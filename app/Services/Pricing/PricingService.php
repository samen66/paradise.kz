<?php

declare(strict_types=1);

namespace App\Services\Pricing;

use App\Models\ClientProductPrice;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Resolves the price (in kopecks) a specific B2B client pays for a product.
 *
 * Rule (see docs/mvp-b2b-plan.md):
 *   base  = the "b2b" PriceType price, falling back to the "retail" PriceType
 *           price, falling back to the legacy product.b2b_price /
 *           product.retail_price columns (still ERP-mirrored — see
 *           SyncProductsJob) for products with no local price rows yet.
 *   price = explicit per-client override  ??  base * (1 - discount_percent/100)
 */
class PricingService
{
    /**
     * The effective retail price in kopecks as a SQL expression, for callers
     * that must filter/sort/aggregate by price inside the database (public
     * catalog price filter, facets). MUST stay in sync with
     * {@see retailPriceForMany}: the local `retail` price-type row falling
     * back to the legacy ERP-mirrored products.retail_price column.
     */
    public const RETAIL_PRICE_SQL = <<<'SQL'
        coalesce(
            (select product_prices.price
             from product_prices
             join price_types on price_types.id = product_prices.price_type_id
             where product_prices.product_id = products.id
               and price_types.code = 'retail'
             limit 1),
            products.retail_price
        )
        SQL;

    private const BASE_PRICE_TYPE_CODE = 'b2b';

    private const FALLBACK_PRICE_TYPE_CODE = 'retail';

    /**
     * Price in kopecks for one product, or null when no base price is known.
     */
    public function priceFor(User $user, Product $product): ?int
    {
        return $this->priceForMany($user, [$product])[$product->id] ?? null;
    }

    /**
     * Resolve prices for many products at once (no N+1 on overrides or local prices).
     *
     * @param  iterable<Product>  $products
     * @return array<int, int|null> Keyed by product id → price in kopecks.
     */
    public function priceForMany(User $user, iterable $products): array
    {
        $products = Collection::make($products);
        $productIds = $products->pluck('id');

        $overrides = ClientProductPrice::query()
            ->where('user_id', $user->id)
            ->whereIn('product_id', $productIds)
            ->pluck('price', 'product_id');

        $localPricesByProduct = $this->localPricesByProduct($productIds);
        $discount = (float) $user->discount_percent;

        return $products
            ->mapWithKeys(function (Product $product) use ($overrides, $localPricesByProduct, $discount): array {
                $override = $overrides[$product->id] ?? null;

                if ($override !== null) {
                    return [$product->id => (int) $override];
                }

                $base = $this->basePrice($product, $localPricesByProduct[$product->id] ?? []);

                return [$product->id => $this->discounted($base, $discount)];
            })
            ->all();
    }

    /**
     * Retail (B2C/guest) price in kopecks for one product, or null when no
     * retail price is known. Unlike {@see priceFor}, this never applies a
     * per-client discount or override — guests have no client record.
     */
    public function retailPriceFor(Product $product): ?int
    {
        return $this->retailPriceForMany([$product])[$product->id] ?? null;
    }

    /**
     * Resolve retail prices for many products at once (no N+1 on local prices).
     *
     * @param  iterable<Product>  $products
     * @return array<int, int|null> Keyed by product id → price in kopecks.
     */
    public function retailPriceForMany(iterable $products): array
    {
        $products = Collection::make($products);
        $localPricesByProduct = $this->localPricesByProduct($products->pluck('id'));

        return $products
            ->mapWithKeys(function (Product $product) use ($localPricesByProduct): array {
                $local = $localPricesByProduct[$product->id] ?? [];

                return [$product->id => $local[self::FALLBACK_PRICE_TYPE_CODE] ?? $product->retail_price];
            })
            ->all();
    }

    /**
     * One query for local product_prices rows (for the two well-known price
     * types) across the whole product set.
     *
     * @param  Collection<int, int>  $productIds
     * @return array<int, array<string, int>> product_id => [price type code => price].
     */
    private function localPricesByProduct(Collection $productIds): array
    {
        return ProductPrice::query()
            ->join('price_types', 'price_types.id', '=', 'product_prices.price_type_id')
            ->whereIn('product_prices.product_id', $productIds)
            ->whereIn('price_types.code', [self::BASE_PRICE_TYPE_CODE, self::FALLBACK_PRICE_TYPE_CODE])
            ->get([
                'product_prices.product_id as product_id',
                'price_types.code as code',
                'product_prices.price as price',
            ])
            ->groupBy('product_id')
            ->map(fn (Collection $rows): array => $rows->pluck('price', 'code')->all())
            ->all();
    }

    /**
     * @param  array<string, int>  $localPrices  This product's local prices by price type code.
     */
    private function basePrice(Product $product, array $localPrices): ?int
    {
        $b2bTier = $localPrices[self::BASE_PRICE_TYPE_CODE] ?? $product->b2b_price;
        $retailTier = $localPrices[self::FALLBACK_PRICE_TYPE_CODE] ?? $product->retail_price;

        return $b2bTier ?? $retailTier;
    }

    private function discounted(?int $base, float $discountPercent): ?int
    {
        if ($base === null) {
            return null;
        }

        if ($discountPercent <= 0) {
            return $base;
        }

        return (int) round($base * (1 - $discountPercent / 100));
    }
}
