<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProductSaveRequest;
use App\Models\Product;
use App\Services\Pricing\PricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class ProductController extends Controller
{
    /**
     * Why a product will not make it to the storefront: issue code => a SQL
     * predicate over one `products` row.
     *
     * Nothing is decided here a second time — every predicate mirrors a rule
     * that VisibilityService and PricingService already enforce. The point is
     * only to make that rule visible to a manager, who otherwise just sees a
     * product that "did not show up on the site".
     *
     * They are SQL (not PHP over loaded relations) so the whole page costs one
     * query: with 15 products per page, checking price and group membership
     * per product would be 30 extra round trips.
     *
     * @var array<string, string>
     */
    private const ISSUES = [
        // VisibilityService::publicProductQuery() — a hard global switch.
        'inactive' => 'products.is_active = 0',
        // VisibilityService::publicProductQuery() — a grouped product is B2B-only
        // by design: catalog groups exist to restrict an assortment to clients.
        'hidden_by_group' => 'exists (select 1 from catalog_group_product where catalog_group_product.product_id = products.id)',
        // PricingService::retailPriceForMany() would resolve null: the storefront
        // shows the product with no price and guest checkout answers 422.
        'no_price' => '('.PricingService::RETAIL_PRICE_SQL.') is null',
        // No /product/{slug} to open the card with.
        'no_slug' => 'products.slug is null',
        // Not reachable by browsing the category tree.
        'no_category' => 'products.category_id is null',
        'out_of_stock' => 'products.stock <= 0',
    ];

    /**
     * The subset of {@see ISSUES} that filter[issues]=1 selects on: a product
     * set up wrongly, which a manager has to go and fix. Being out of stock is
     * a fact of the business rather than a mistake — it is worth a badge, but
     * it would drown the filter in every product that merely sold out.
     *
     * @var list<string>
     */
    private const BLOCKING_ISSUES = ['inactive', 'hidden_by_group', 'no_price', 'no_slug', 'no_category'];

    /**
     * Filters: filter[category_id], filter[is_active], filter[search]=<name|code>,
     *          filter[issues]=1 (only products that will not reach the storefront).
     *
     * Every product carries `issues: string[]` — see {@see ISSUES}.
     */
    public function index(Request $request)
    {
        $query = QueryBuilder::for(Product::class)
            ->allowedFilters(
                AllowedFilter::exact('category_id'),
                AllowedFilter::exact('is_active'),
                AllowedFilter::callback('search', function ($query, $value) {
                    $query->where(function ($q) use ($value) {
                        $q->where('name->ru', 'LIKE', "%{$value}%")
                            ->orWhere('name->kk', 'LIKE', "%{$value}%")
                            ->orWhere('code', 'LIKE', "%{$value}%");
                    });
                }),
                AllowedFilter::callback('issues', function ($query, $value) {
                    if (! filter_var($value, FILTER_VALIDATE_BOOLEAN)) {
                        return;
                    }

                    $query->where(function ($q) {
                        foreach (self::BLOCKING_ISSUES as $code) {
                            $q->orWhereRaw(self::ISSUES[$code]);
                        }
                    });
                }),
            )
            // Explicit, because the first addSelect() below would otherwise drop
            // the implicit `products.*`.
            ->select('products.*')
            ->with(['category', 'brand', 'media', 'externalMapping']);

        foreach (self::ISSUES as $code => $predicate) {
            $query->selectRaw("({$predicate}) as issue_{$code}");
        }

        $products = $query->paginate(15)->appends($request->query());

        $products->getCollection()->each(fn (Product $product) => $this->attachIssues($product));

        return response()->json($products);
    }

    /**
     * Fold the per-issue flag columns selected in {@see index} into one
     * `issues` array, and drop the flags themselves from the response.
     */
    private function attachIssues(Product $product): void
    {
        $codes = [];

        foreach (array_keys(self::ISSUES) as $code) {
            if ((bool) $product->getAttribute("issue_{$code}")) {
                $codes[] = $code;
            }

            unset($product->{"issue_{$code}"});
        }

        $product->issues = $codes;
    }

    public function show(Product $product): JsonResponse
    {
        $product->load(['category', 'brand', 'externalMapping']);

        return response()->json(['data' => [
            ...$product->toArray(),
            'images' => ProductMediaController::presentAll($product),
        ]]);
    }

    public function store(ProductSaveRequest $request): JsonResponse
    {
        $product = Product::create($request->validated());

        return response()->json(['data' => $product->load(['category', 'brand'])], 201);
    }

    public function update(ProductSaveRequest $request, Product $product): JsonResponse
    {
        $product->update($request->validated());

        return response()->json(['data' => $product->load(['category', 'brand'])]);
    }

    /**
     * The stock ledger is append-only history; a product it mentions stays.
     * A manager switches it off (is_active) instead.
     */
    public function destroy(Product $product): JsonResponse
    {
        if ($product->stockMovements()->exists()) {
            return response()->json(['message' => 'По товару есть движения по складу — удалить нельзя, выключите его.'], 422);
        }

        if ($product->goodsReceiptItems()->exists()) {
            return response()->json(['message' => 'Товар есть в приёмках — удалить нельзя, выключите его.'], 422);
        }

        $product->delete();

        return response()->json(null, 204);
    }
}
