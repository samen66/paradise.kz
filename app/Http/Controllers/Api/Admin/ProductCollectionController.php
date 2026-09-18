<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\StoresSingleImage;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProductCollectionRequest;
use App\Models\ProductCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductCollectionController extends Controller
{
    use StoresSingleImage;

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => ProductCollection::withCount('products')->with('media')->orderBy('sort_order')->orderBy('id')->get()
                ->map(fn (ProductCollection $collection): ProductCollection => $this->withCover($collection)),
        ]);
    }

    public function store(ProductCollectionRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->withCover(ProductCollection::create($request->validated()))], 201);
    }

    public function show(ProductCollection $productCollection): JsonResponse
    {
        $productCollection->load([
            'products' => fn ($query) => $query->select('products.id', 'products.name', 'products.code', 'products.article'),
        ]);

        return response()->json(['data' => $this->withCover($productCollection)]);
    }

    public function update(ProductCollectionRequest $request, ProductCollection $productCollection): JsonResponse
    {
        $productCollection->update($request->validated());

        return response()->json(['data' => $this->withCover($productCollection)]);
    }

    public function destroy(ProductCollection $productCollection): JsonResponse
    {
        $productCollection->delete();

        return response()->json(null, 204);
    }

    public function storeCover(Request $request, ProductCollection $productCollection): JsonResponse
    {
        $this->replaceImage($request, $productCollection, ProductCollection::COVER_COLLECTION);

        return response()->json(['data' => $this->withCover($productCollection->fresh())]);
    }

    public function destroyCover(ProductCollection $productCollection): JsonResponse
    {
        $this->removeImage($productCollection, ProductCollection::COVER_COLLECTION);

        return response()->json(['data' => $this->withCover($productCollection->fresh())]);
    }

    /**
     * The model's own serialization plus the cover URL — the admin form shows it.
     */
    private function withCover(ProductCollection $collection): ProductCollection
    {
        return $collection->setAttribute(
            'cover_url',
            $collection->getFirstMediaUrl(ProductCollection::COVER_COLLECTION, 'card') ?: null,
        )->makeHidden('media');
    }
}
