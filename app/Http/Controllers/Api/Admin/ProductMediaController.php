<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/**
 * Product images, one at a time. Replaces the old "upload replaces them all"
 * behaviour of the product form: a manager adds, removes and reorders.
 */
class ProductMediaController extends Controller
{
    /**
     * @return array{id: int, file_name: string, url: string, thumb_url: string, order: int|null}
     */
    public static function present(Media $media): array
    {
        return [
            'id' => $media->id,
            'file_name' => $media->file_name,
            'url' => $media->getUrl(),
            'thumb_url' => $media->hasGeneratedConversion('thumb') ? $media->getUrl('thumb') : $media->getUrl(),
            'order' => $media->order_column,
        ];
    }

    /**
     * @return list<array{id: int, file_name: string, url: string, thumb_url: string, order: int|null}>
     */
    public static function presentAll(Product $product): array
    {
        return $product->getMedia(Product::IMAGE_COLLECTION)
            ->map(fn (Media $media): array => self::present($media))
            ->values()
            ->all();
    }

    public function index(Product $product): JsonResponse
    {
        return response()->json(['data' => self::presentAll($product)]);
    }

    public function store(Request $request, Product $product): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:jpeg,png,webp', 'max:10240'],
        ]);

        $media = $product->addMediaFromRequest('file')->toMediaCollection(Product::IMAGE_COLLECTION);

        return response()->json(['data' => self::present($media)], 201);
    }

    public function order(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'distinct'],
        ]);

        $ids = array_map('intval', $validated['ids']);
        $own = $product->getMedia(Product::IMAGE_COLLECTION)->pluck('id')->all();

        sort($own);
        $sorted = $ids;
        sort($sorted);

        if ($sorted !== $own) {
            return response()->json(['message' => 'Порядок должен перечислять ровно все картинки товара.'], 422);
        }

        Media::setNewOrder($ids);

        return response()->json(['data' => self::presentAll($product->fresh())]);
    }

    public function destroy(Product $product, Media $media): JsonResponse
    {
        $media->delete();

        return response()->json(null, 204);
    }
}
