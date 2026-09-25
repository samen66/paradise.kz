<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicShowroomResource;
use App\Models\ProductStoreStock;
use App\Models\Store;
use App\Services\Catalog\VisibilityService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Published showrooms for the storefront. Stock "in the showroom" is its
 * store's own stock, filtered by the public catalog rules; the full product
 * list comes from /public/products?store_id=…&filter[in_stock]=1.
 */
class ShowroomController extends Controller
{
    private const PREVIEW_SIZE = 5;

    public function __construct(private readonly VisibilityService $visibility) {}

    public function index(): AnonymousResourceCollection
    {
        $showrooms = Store::query()->publishedShowrooms()->with('media')->get();
        $this->attachProducts($showrooms);

        return PublicShowroomResource::collection($showrooms);
    }

    public function show(string $slug): PublicShowroomResource
    {
        $showrooms = Store::query()->publishedShowrooms()->with('media')->where('slug', $slug)->get();
        abort_if($showrooms->isEmpty(), 404);
        $this->attachProducts($showrooms);

        return new PublicShowroomResource($showrooms->first());
    }

    /**
     * One grouped count query for all showrooms, one preview query per
     * showroom (there are a handful).
     *
     * @param  Collection<int, Store>  $showrooms
     */
    private function attachProducts(Collection $showrooms): void
    {
        if ($showrooms->isEmpty()) {
            return;
        }

        $counts = ProductStoreStock::query()
            ->whereIn('store_id', $showrooms->modelKeys())
            ->where('stock', '>', 0)
            ->whereIn('product_id', $this->visibility->publicProductQuery()->select('products.id'))
            ->selectRaw('store_id, count(*) as products_count')
            ->groupBy('store_id')
            ->pluck('products_count', 'store_id');

        foreach ($showrooms as $showroom) {
            $showroom->setAttribute('products_count', (int) ($counts[$showroom->id] ?? 0));
            $showroom->setRelation('previewProducts', $this->visibility->publicProductQuery()
                ->with('media')
                ->join('product_store_stock', 'product_store_stock.product_id', '=', 'products.id')
                ->where('product_store_stock.store_id', $showroom->id)
                ->where('product_store_stock.stock', '>', 0)
                ->orderByDesc('product_store_stock.stock')
                ->orderBy('products.id')
                ->limit(self::PREVIEW_SIZE)
                ->get(['products.*']));
        }
    }
}
