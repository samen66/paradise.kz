<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Product;
use App\Services\Catalog\CategoryTree;
use App\Services\Catalog\VisibilityService;
use App\Services\Pricing\PricingService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Facet data for the storefront filter sidebar: which filterable attributes
 * (and values), brands and price range exist within the current category
 * scope. Scoped to the public catalog only (same visibility rule as the
 * product listing).
 */
class FacetController extends Controller
{
    public function __construct(
        private readonly VisibilityService $visibility,
        private readonly CategoryTree $categories,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $products = $this->visibility->publicProductQuery();

        $category = $request->query('category');

        if (is_string($category) && $category !== '') {
            $products->whereIn('products.category_id', $this->categories->subtreeIds($category));
        }

        $productIds = $products->select('products.id');

        return response()->json([
            'attributes' => $this->attributeFacets($productIds),
            'brands' => $this->brandFacets($productIds),
            'price' => $this->priceRange($productIds),
        ]);
    }

    /**
     * @param  Builder<Product>  $productIds
     * @return list<array{name: string, slug: string, values: list<string>}>
     */
    private function attributeFacets(Builder $productIds): array
    {
        $values = DB::table('attribute_values')
            ->join('attributes', 'attributes.id', '=', 'attribute_values.attribute_id')
            ->where('attributes.is_filterable', true)
            ->whereIn('attribute_values.product_id', $productIds)
            ->distinct()
            ->orderBy('attributes.slug')
            ->orderBy('attribute_values.value')
            ->get(['attributes.name', 'attributes.slug', 'attribute_values.value']);

        return $values
            ->groupBy('slug')
            ->map(fn ($rows): array => [
                'name' => $rows->first()->name,
                'slug' => $rows->first()->slug,
                'values' => $rows->pluck('value')->values()->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * @param  Builder<Product>  $productIds
     * @return list<array{id: int, name: string|null, slug: string, count: int}>
     */
    private function brandFacets(Builder $productIds): array
    {
        $counts = DB::table('products')
            ->whereIn('products.id', $productIds)
            ->whereNotNull('products.brand_id')
            ->groupBy('products.brand_id')
            ->selectRaw('products.brand_id, count(*) as product_count')
            ->pluck('product_count', 'brand_id');

        return Brand::query()
            ->whereIn('id', $counts->keys())
            ->where('is_active', true)
            ->get()
            ->map(fn ($brand): array => [
                'id' => $brand->id,
                'name' => $brand->name,
                'slug' => $brand->slug,
                'count' => (int) $counts[$brand->id],
            ])
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->all();
    }

    /**
     * Min/max effective retail price in major units (₸), matching the listing
     * price filter semantics.
     *
     * @param  Builder<Product>  $productIds
     * @return array{min: float|null, max: float|null}
     */
    private function priceRange(Builder $productIds): array
    {
        $sql = PricingService::RETAIL_PRICE_SQL;

        $range = DB::table('products')
            ->whereIn('products.id', $productIds)
            ->selectRaw("min({$sql}) as min_price, max({$sql}) as max_price")
            ->first();

        return [
            'min' => $range->min_price === null ? null : $range->min_price / 100,
            'max' => $range->max_price === null ? null : $range->max_price / 100,
        ];
    }
}
