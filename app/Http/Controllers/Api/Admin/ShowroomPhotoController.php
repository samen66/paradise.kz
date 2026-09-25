<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\RevalidateStorefrontCacheJob;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/**
 * Showroom photos, one at a time, same contract as product media: the first
 * one is the cover on the storefront.
 */
class ShowroomPhotoController extends Controller
{
    public function index(Store $store): JsonResponse
    {
        $this->ensureShowroom($store);

        return response()->json(['data' => $this->presentAll($store)]);
    }

    public function store(Request $request, Store $store): JsonResponse
    {
        $this->ensureShowroom($store);

        $request->validate([
            'file' => ['required', 'file', 'mimes:jpeg,png,webp', 'max:10240'],
        ]);

        if ($store->getMedia(Store::PHOTOS_COLLECTION)->count() >= Store::MAX_PHOTOS) {
            throw ValidationException::withMessages(['file' => 'У шоурума не больше '.Store::MAX_PHOTOS.' фото.']);
        }

        $media = $store->addMediaFromRequest('file')->toMediaCollection(Store::PHOTOS_COLLECTION);
        $this->purge($store);

        return response()->json(['data' => $this->present($media)], 201);
    }

    public function order(Request $request, Store $store): JsonResponse
    {
        $this->ensureShowroom($store);

        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'distinct'],
        ]);

        $ids = array_map('intval', $validated['ids']);
        $own = $store->getMedia(Store::PHOTOS_COLLECTION)->pluck('id')->all();

        sort($own);
        $sorted = $ids;
        sort($sorted);

        if ($sorted !== $own) {
            return response()->json(['message' => 'Порядок должен перечислять ровно все фото шоурума.'], 422);
        }

        Media::setNewOrder($ids);
        $this->purge($store);

        return response()->json(['data' => $this->presentAll($store->fresh())]);
    }

    public function destroy(Store $store, Media $media): JsonResponse
    {
        $this->ensureShowroom($store);

        if ($media->collection_name !== Store::PHOTOS_COLLECTION) {
            abort(404);
        }

        $media->delete();
        $this->purge($store);

        return response()->json(null, 204);
    }

    private function ensureShowroom(Store $store): void
    {
        abort_unless($store->type === Store::TYPE_RETAIL_POINT, 404);
    }

    private function purge(Store $store): void
    {
        RevalidateStorefrontCacheJob::dispatch($store->storefrontCacheTags())->afterCommit();
    }

    /**
     * @return array{id: int, file_name: string, url: string, thumb_url: string, order: int|null}
     */
    private function present(Media $media): array
    {
        return [
            'id' => $media->id,
            'file_name' => $media->file_name,
            'url' => $media->getUrl(),
            'thumb_url' => $media->hasGeneratedConversion('card') ? $media->getUrl('card') : $media->getUrl(),
            'order' => $media->order_column,
        ];
    }

    /**
     * @return list<array{id: int, file_name: string, url: string, thumb_url: string, order: int|null}>
     */
    private function presentAll(Store $store): array
    {
        return $store->getMedia(Store::PHOTOS_COLLECTION)
            ->map(fn (Media $media): array => $this->present($media))
            ->values()
            ->all();
    }
}
