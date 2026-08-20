<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\CatalogSetting;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\Store;
use App\Services\Catalog\StoreResolver;
use App\Services\Catalog\VisibilityService;
use App\Services\Pricing\PricingService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;
use Symfony\Component\HttpFoundation\Response;

class ProductController extends Controller
{
    private const PER_PAGE = 24;

    public function __construct(
        private readonly VisibilityService $visibility,
        private readonly PricingService $pricing,
        private readonly StoreResolver $stores,
    ) {}

    /**
     * Paginated list of products visible to the authenticated client, each
     * carrying its resolved per-client price and per-warehouse stock.
     *
     * Filters: filter[category]=<external_folder_id>, filter[search]=<term>.
     * Sorts:   name, code, created_at (and their `-` descending forms).
     * Price is per-client and intentionally NOT a sortable column.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        $store = $this->stores->resolve($user, $this->requestedStoreId($request));

        $products = QueryBuilder::for($this->visibility->visibleProductQuery($user)->with('media'))
            ->allowedFilters(
                AllowedFilter::exact('category', 'externalMapping.external_folder_id'),
                AllowedFilter::callback('search', $this->searchFilter(...)),
                AllowedFilter::callback('brand', $this->brandFilter(...)),
                AllowedFilter::callback('attr', $this->attributeFilter(...)),
                AllowedFilter::callback('in_stock', function (Builder $query, mixed $value) use ($store): void {
                    if (filter_var($value, FILTER_VALIDATE_BOOLEAN) && $store !== null) {
                        $query->whereIn('products.id', ProductStoreStock::query()
                            ->select('product_id')
                            ->where('store_id', $store->id)
                            ->where('stock', '>', 0));
                    }
                }),
            )
            ->allowedSorts(
                AllowedSort::field('name'),
                AllowedSort::field('code'),
                AllowedSort::field('created_at'),
            )
            ->defaultSort('name')
            ->paginate(self::PER_PAGE)
            ->appends($request->query());

        // Resolve all prices/stocks in one query each (no N+1), then attach to each row.
        $prices = $this->pricing->priceForMany($user, $products->getCollection());
        $stocks = $this->stockForMany($store, $products->getCollection());
        $showStockQuantity = CatalogSetting::current()->show_stock_quantity;

        $products->getCollection()->each(function (Product $product) use ($prices, $stocks, $showStockQuantity): void {
            $product->resolved_price = $prices[$product->id] ?? null;
            $product->resolved_stock = $stocks[$product->id] ?? 0;
            $product->show_stock_quantity = $showStockQuantity;
        });

        return ProductResource::collection($products);
    }

    /**
     * Product detail. Returns 404 (not 403) when the product is outside the
     * client's visible set, so hidden products' existence never leaks.
     */
    public function show(Request $request, Product $product): ProductResource
    {
        $user = $request->user();

        if (! $this->visibility->canSee($user, $product)) {
            abort(Response::HTTP_NOT_FOUND);
        }

        $store = $this->stores->resolve($user, $this->requestedStoreId($request));

        $product->loadMissing('media', 'variants');
        $product->resolved_price = $this->pricing->priceFor($user, $product);
        $product->resolved_stock = $store === null ? 0 : (float) (ProductStoreStock::query()
            ->where('product_id', $product->id)
            ->where('store_id', $store->id)
            ->value('stock') ?? 0);
        $product->show_stock_quantity = CatalogSetting::current()->show_stock_quantity;
        $product->with_description = true;

        return new ProductResource($product);
    }

    private function requestedStoreId(Request $request): ?int
    {
        $value = $request->query('store_id');

        return $value === null ? null : (int) $value;
    }

    /**
     * Resolve free stock for many products at once (no N+1 on the warehouse lookup).
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

    /**
     * Partial match across name, code and article.
     *
     * @param  Builder<Product>  $query
     */
    private function searchFilter(Builder $query, string $value): void
    {
        $term = '%'.$value.'%';

        $query->where(function (Builder $inner) use ($term): void {
            $inner->where('name', 'like', $term)
                ->orWhere('code', 'like', $term)
                ->orWhere('article', 'like', $term);
        });
    }

    /**
     * Brand filter by slug(s) or id(s).
     *
     * @param  Builder<Product>  $query
     */
    private function brandFilter(Builder $query, mixed $value): void
    {
        $values = array_map(strval(...), is_array($value) ? $value : [$value]);
        $ids = array_map(intval(...), array_filter($values, ctype_digit(...)));

        $query->whereIn('products.brand_id', function ($sub) use ($values, $ids): void {
            $sub->select('id')->from('brands')->whereIn('slug', $values)
                ->when($ids !== [], fn ($q) => $q->orWhereIn('id', $ids));
        });
    }

    /**
     * Structured-attribute filter.
     *
     * @param  Builder<Product>  $query
     */
    private function attributeFilter(Builder $query, mixed $value): void
    {
        if (! is_array($value)) {
            return;
        }

        foreach ($value as $attributeSlug => $values) {
            $values = is_array($values) ? $values : explode(',', (string) $values);

            $query->whereExists(function ($sub) use ($attributeSlug, $values): void {
                $sub->selectRaw('1')
                    ->from('attribute_values')
                    ->join('attributes', 'attributes.id', '=', 'attribute_values.attribute_id')
                    ->whereColumn('attribute_values.product_id', 'products.id')
                    ->where('attributes.slug', (string) $attributeSlug)
                    ->where('attributes.is_filterable', true)
                    ->whereIn('attribute_values.value', $values);
            });
        }
    }
}
