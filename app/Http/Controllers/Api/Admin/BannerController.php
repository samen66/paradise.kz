<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\SavesTranslations;
use App\Http\Controllers\Api\Admin\Concerns\StoresSingleImage;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BannerRequest;
use App\Models\Banner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Hero banners for the storefront home (`home_hero`) and the B2B portal home
 * (`b2b_home`). Filament keeps editing the same rows until it is retired.
 */
class BannerController extends Controller
{
    use SavesTranslations;
    use StoresSingleImage;

    /**
     * @return array<string, mixed>
     */
    public static function present(Banner $banner): array
    {
        $media = $banner->getFirstMedia(Banner::IMAGE_COLLECTION);

        return [
            'id' => $banner->id,
            'placement' => $banner->placement,
            'title' => $banner->getTranslations('title'),
            'subtitle' => $banner->getTranslations('subtitle'),
            'url' => $banner->url,
            'sort_order' => $banner->sort_order,
            'is_active' => $banner->is_active,
            'image_url' => $media ? ($media->hasGeneratedConversion('mobile') ? $media->getUrl('mobile') : $media->getUrl()) : null,
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $placement = $request->query('placement');

        $banners = Banner::query()
            ->with('media')
            ->when(is_string($placement) && $placement !== '', fn ($query) => $query->where('placement', $placement))
            ->orderBy('placement')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $banners->map(fn (Banner $banner): array => self::present($banner))->all()]);
    }

    public function store(BannerRequest $request): JsonResponse
    {
        return response()->json(['data' => self::present($this->saveWithTranslations(new Banner, $request->validated()))], 201);
    }

    public function update(BannerRequest $request, Banner $banner): JsonResponse
    {
        $this->saveWithTranslations($banner, $request->validated());

        return response()->json(['data' => self::present($banner)]);
    }

    public function destroy(Banner $banner): JsonResponse
    {
        $banner->delete();

        return response()->json(null, 204);
    }

    public function storeImage(Request $request, Banner $banner): JsonResponse
    {
        $this->replaceImage($request, $banner, Banner::IMAGE_COLLECTION);

        return response()->json(['data' => self::present($banner->fresh())]);
    }

    public function destroyImage(Banner $banner): JsonResponse
    {
        $this->removeImage($banner, Banner::IMAGE_COLLECTION);

        return response()->json(['data' => self::present($banner->fresh())]);
    }
}
