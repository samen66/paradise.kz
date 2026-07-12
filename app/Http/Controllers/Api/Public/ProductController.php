<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Services\Catalog\CategoryTree;
use App\Services\Catalog\PublicProductPresenter;
use App\Services\Catalog\StoreResolver;
use App\Services\Catalog\VisibilityService;
use App\Services\Pricing\PricingService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;
use Symfony\Component\HttpFoundation\Response;

/**
 * The anonymous (guest/B2C) storefront catalog: no login, no approval gate,
 * retail pricing, and only products in no catalog group (see
 * VisibilityService::publicProductQuery — catalog groups exist to restrict an
 * assortment to specific B2B clients, so grouped products never surface here).
 */
class ProductController extends Controller
{
    private const PER_PAGE = 24;

    /** Effective retail price (kopecks) as SQL — see PricingService. */
    private const RETAIL_PRICE_SQL = PricingService::RETAIL_PRICE_SQL;

    public function __construct(
        private readonly VisibilityService $visibility,
        private readonly PublicProductPresenter $presenter,
        private readonly StoreResolver $stores,
        private readonly CategoryTree $categories,
    ) {}

    /**
     * Filters: filter[category]=<id|slug> (includes descendant categories),
     *          filter[brand]=<id|slug>, filter[search]=<term>,
     *          filter[price_min]/filter[price_max] (₸, major units),
     *          filter[attr][<attribute slug>]=<value>[,<value>...],
     *          filter[in_stock]=1 (only products in stock at the resolved store).
     * Sorts:   name (current locale), price, code, created_at (and `-` forms).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $store = $this->stores->resolve(null, $this->requestedStoreId($request));

        $products = QueryBuilder::for($this->visibility->publicProductQuery()->with('media'))
            ->allowedFilters(
                AllowedFilter::callback('category', $this->categoryFilter(...)),
                AllowedFilter::callback('brand', $this->brandFilter(...)),
                AllowedFilter::callback('search', $this->searchFilter(...)),
                AllowedFilter::callback('price_min', function (Builder $query, mixed $value): void {
                    $query->whereRaw(self::RETAIL_PRICE_SQL.' >= ?', [(int) ((float) $value * 100)]);
                }),
                AllowedFilter::callback('price_max', function (Builder $query, mixed $value): void {
                    $query->whereRaw(self::RETAIL_PRICE_SQL.' <= ?', [(int) ((float) $value * 100)]);
                }),
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
                AllowedSort::callback('name', $this->nameSort(...)),
                AllowedSort::callback('price', function (Builder $query, bool $descending): void {
                    $query->orderByRaw(self::RETAIL_PRICE_SQL.($descending ? ' desc' : ' asc'));
                }),
                AllowedSort::field('code'),
                AllowedSort::field('created_at'),
            )
            ->defaultSort('name')
            ->paginate(self::PER_PAGE)
            ->appends($request->query());

        $this->presenter->enrich($products->getCollection(), $store);

        return ProductResource::collection($products);
    }

    /**
     * Product detail, addressable by SEO slug or numeric id. Returns 404 (not
     * 403) when the product is outside the public catalog, so restricted
     * products' existence never leaks.
     */
    public function show(Request $request, string $product): ProductResource
    {
        $product = $this->findBySlugOrId($product);

        if (! $this->visibility->canSeePublicly($product)) {
            abort(Response::HTTP_NOT_FOUND);
        }

        $store = $this->stores->resolve(null, $this->requestedStoreId($request));

        $product->loadMissing('media', 'variants', 'category', 'brand', 'attributeValues.attribute');
        $this->presenter->enrich($product->newCollection([$product]), $store);
        $product->with_description = true;

        return new ProductResource($product);
    }

    private function findBySlugOrId(string $key): Product
    {
        $query = Product::query()->where('slug', $key);

        if (ctype_digit($key)) {
            $query->orWhere('id', (int) $key);
        }

        return $query->firstOrFail();
    }

    private function requestedStoreId(Request $request): ?int
    {
        $value = $request->query('store_id');

        return $value === null ? null : (int) $value;
    }

    /**
     * Category filter by id or slug, widened to the whole subtree so a parent
     * category lists its children's products too (mebel.kz behavior).
     *
     * @param  Builder<Product>  $query
     */
    private function categoryFilter(Builder $query, mixed $value): void
    {
        $ids = $this->categories->subtreeIds(is_array($value) ? (string) reset($value) : (string) $value);

        $query->whereIn('products.category_id', $ids);
    }

    /**
     * Brand filter by slug(s) or id(s); multiple brands combine with OR
     * (filter[brand]=ikea,bellona).
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
     * Structured-attribute filter:
     * filter[attr][color]=red,blue → products whose `color` attribute value is
     * red OR blue; separate attributes combine with AND. Only attributes the
     * admin marked filterable participate — unknown/unfilterable slugs match
     * nothing rather than silently matching everything.
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

    /**
     * Sort by the current-locale name, falling back to ru for untranslated
     * rows (json_extract works on both MySQL and SQLite).
     *
     * @param  Builder<Product>  $query
     */
    private function nameSort(Builder $query, bool $descending): void
    {
        $direction = $descending ? 'desc' : 'asc';
        $locale = app()->getLocale();

        $query->orderByRaw(
            "coalesce(json_extract(products.name, ?), json_extract(products.name, '$.ru')) {$direction}",
            ['$.'.$locale],
        );
    }

    /**
     * Partial match across the localized names (any locale), code and article.
     *
     * @param  Builder<Product>  $query
     */
    private function searchFilter(Builder $query, string $value): void
    {
        $term = '%'.$value.'%';

        $query->where(function (Builder $inner) use ($term): void {
            foreach (config()->array('app.locales') as $locale) {
                $inner->orWhere("name->{$locale}", 'like', $term);
            }

            $inner->orWhere('code', 'like', $term)
                ->orWhere('article', 'like', $term);
        });
    }
}
