<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\SavesTranslations;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ShowroomRequest;
use App\Http\Resources\ShowroomAdminResource;
use App\Jobs\RevalidateStorefrontCacheJob;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

/**
 * Showrooms are retail-point stores; this controller edits their public
 * card only. Activity, the default flag and deletion stay on the warehouse
 * screen (Admin\StoreController) with its safety checks.
 */
class ShowroomController extends Controller
{
    use SavesTranslations;

    public function index(): AnonymousResourceCollection
    {
        $showrooms = Store::query()
            ->where('type', Store::TYPE_RETAIL_POINT)
            ->with('media')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return ShowroomAdminResource::collection($showrooms);
    }

    public function store(ShowroomRequest $request): JsonResponse
    {
        $data = Arr::except($request->validated(), ['show_on_site']);
        $data['slug'] ??= $this->uniqueSlug($data['name']);

        $store = new Store(['type' => Store::TYPE_RETAIL_POINT, 'is_active' => true, 'show_on_site' => false]);
        $this->saveWithTranslations($store, $data);

        return $this->present($store)->response()->setStatusCode(201);
    }

    public function show(Store $store): ShowroomAdminResource
    {
        $this->ensureShowroom($store);

        return $this->present($store);
    }

    public function update(ShowroomRequest $request, Store $store): ShowroomAdminResource
    {
        $this->ensureShowroom($store);

        $previousSlug = $store->slug;
        $this->saveWithTranslations($store, $request->validated());

        RevalidateStorefrontCacheJob::dispatch($store->storefrontCacheTags($previousSlug))->afterCommit();

        return $this->present($store);
    }

    private function ensureShowroom(Store $store): void
    {
        abort_unless($store->type === Store::TYPE_RETAIL_POINT, 404);
    }

    private function present(Store $store): ShowroomAdminResource
    {
        $store = $store->fresh('media');
        $store->setAttribute('products_in_stock', $store->productStocks()->where('stock', '>', 0)->count());

        return new ShowroomAdminResource($store);
    }

    /**
     * A page address from the name (Cyrillic transliterated), `-2`, `-3`…
     * appended while it is taken.
     */
    private function uniqueSlug(string $name): ?string
    {
        $base = rtrim(Str::limit(Str::slug($name), 90, ''), '-');

        if ($base === '') {
            return null;
        }

        $slug = $base;

        for ($suffix = 2; Store::query()->where('slug', $slug)->exists(); $suffix++) {
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }
}
