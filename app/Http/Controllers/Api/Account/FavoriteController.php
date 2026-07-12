<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Services\Catalog\PublicProductPresenter;
use App\Services\Catalog\StoreResolver;
use App\Services\Catalog\VisibilityService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\Response;

/**
 * Storefront wishlist. Listed products pass the same public-visibility and
 * retail-pricing rules as the catalog, so a product that later became
 * restricted silently drops out of the list.
 */
class FavoriteController extends Controller
{
    public function __construct(
        private readonly VisibilityService $visibility,
        private readonly PublicProductPresenter $presenter,
        private readonly StoreResolver $stores,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $visibleIds = $this->visibility->publicProductQuery()->select('products.id');

        $products = $request->user()
            ->favoriteProducts()
            ->whereIn('products.id', $visibleIds)
            ->with('media')
            ->get();

        $this->presenter->enrich($products, $this->stores->resolve(null, null));

        return ProductResource::collection($products);
    }

    public function store(Request $request, Product $product): Response
    {
        $request->user()->favoriteProducts()->syncWithoutDetaching([$product->id]);

        return response()->noContent(Response::HTTP_CREATED);
    }

    public function destroy(Request $request, Product $product): Response
    {
        $request->user()->favoriteProducts()->detach($product->id);

        return response()->noContent();
    }
}
