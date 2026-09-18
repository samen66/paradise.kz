<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\B2bHomeContent;
use App\Models\Banner;
use App\Models\Product;
use App\Models\ProductCollection;
use App\Services\Catalog\VisibilityService;
use Illuminate\Http\JsonResponse;

/**
 * The public B2B portal home page: hero banners, the "who we are" block and
 * the "styles" (collections flagged for it). Open to anonymous visitors, so
 * products carry no prices or stock and come from the public catalog only.
 */
class B2bHomeController extends Controller
{
    /** Cap per style so one home request stays bounded. */
    private const PRODUCTS_PER_COLLECTION = 8;

    public function __construct(
        private readonly VisibilityService $visibility,
    ) {}

    public function __invoke(): JsonResponse
    {
        return response()->json([
            'data' => [
                'banners' => $this->banners(),
                'about' => $this->about(),
                'collections' => $this->collections(),
            ],
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function banners(): array
    {
        return Banner::query()
            ->where('placement', Banner::PLACEMENT_B2B_HOME)
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
     * @return array{title: string|null, text: string|null, image: string|null}|null
     */
    private function about(): ?array
    {
        $content = B2bHomeContent::query()->with('media')->first();

        if ($content === null || (blank($content->about_title) && blank($content->about_text))) {
            return null;
        }

        return [
            'title' => $content->about_title ?: null,
            'text' => $content->about_text ?: null,
            'image' => $content->getFirstMediaUrl(B2bHomeContent::ABOUT_IMAGE_COLLECTION, 'wide') ?: null,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function collections(): array
    {
        $publicProductIds = $this->visibility->publicProductQuery()->select('products.id');

        return ProductCollection::query()
            ->where('is_active', true)
            ->where('show_on_b2b_home', true)
            ->orderBy('sort_order')
            ->with(['media', 'products' => function ($query) use ($publicProductIds): void {
                $query->whereIn('products.id', $publicProductIds)
                    ->with('media')
                    ->limit(self::PRODUCTS_PER_COLLECTION);
            }])
            ->get()
            ->map(function (ProductCollection $collection): array {
                $collection->products->each(function (Product $product): void {
                    $product->hide_commercial = true;
                });

                return [
                    'id' => $collection->id,
                    'title' => $collection->title,
                    'slug' => $collection->slug,
                    'description' => $collection->description ?: null,
                    'cover' => $collection->getFirstMediaUrl(ProductCollection::COVER_COLLECTION, 'wide') ?: null,
                    'cover_card' => $collection->getFirstMediaUrl(ProductCollection::COVER_COLLECTION, 'card') ?: null,
                    'products' => ProductResource::collection($collection->products)->resolve(),
                ];
            })
            ->all();
    }
}
