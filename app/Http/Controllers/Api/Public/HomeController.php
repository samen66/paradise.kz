<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Banner;
use App\Models\ProductCollection;
use App\Models\Store;
use App\Services\Catalog\PublicProductPresenter;
use App\Services\Catalog\StoreResolver;
use App\Services\Catalog\VisibilityService;
use Illuminate\Http\JsonResponse;

/**
 * Everything the storefront home page needs in one request: hero banners and
 * the admin-curated product collections. Collection products pass through the
 * same public visibility + retail pricing rules as the catalog listing.
 */
class HomeController extends Controller
{
    /** Cap per collection so one home request stays bounded. */
    private const PRODUCTS_PER_COLLECTION = 12;

    public function __construct(
        private readonly VisibilityService $visibility,
        private readonly PublicProductPresenter $presenter,
        private readonly StoreResolver $stores,
    ) {}

    public function __invoke(): JsonResponse
    {
        $store = $this->stores->resolve(null, null);

        return response()->json([
            'data' => [
                'banners' => $this->banners(),
                'collections' => $this->collections($store),
            ],
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function banners(): array
    {
        return Banner::query()
            ->where('placement', Banner::PLACEMENT_HOME_HERO)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->with('media')
            ->get()
            ->map(fn (Banner $banner): array => [
                'id' => $banner->id,
                'title' => $banner->title,
                'subtitle' => $banner->subtitle,
                'url' => $banner->url,
                'image' => $banner->getFirstMediaUrl(Banner::IMAGE_COLLECTION, 'wide') ?: null,
                'image_mobile' => $banner->getFirstMediaUrl(Banner::IMAGE_COLLECTION, 'mobile') ?: null,
            ])
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function collections(?Store $store): array
    {
        $publicProductIds = $this->visibility->publicProductQuery()->select('products.id');

        return ProductCollection::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->with(['products' => function ($query) use ($publicProductIds): void {
                $query->whereIn('products.id', $publicProductIds)
                    ->with('media')
                    ->limit(self::PRODUCTS_PER_COLLECTION);
            }])
            ->get()
            ->map(function (ProductCollection $collection) use ($store): array {
                $this->presenter->enrich($collection->products, $store);

                return [
                    'id' => $collection->id,
                    'title' => $collection->title,
                    'slug' => $collection->slug,
                    'products' => ProductResource::collection($collection->products)->resolve(),
                ];
            })
            ->all();
    }
}
