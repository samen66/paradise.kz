<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProductCollectionRequest;
use App\Models\ProductCollection;
use Illuminate\Http\JsonResponse;

class ProductCollectionController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => ProductCollection::withCount('products')->orderBy('sort_order')->orderBy('id')->get(),
        ]);
    }

    public function store(ProductCollectionRequest $request): JsonResponse
    {
        return response()->json(['data' => ProductCollection::create($request->validated())], 201);
    }

    public function show(ProductCollection $productCollection): JsonResponse
    {
        $productCollection->load([
            'products' => fn ($query) => $query->select('products.id', 'products.name', 'products.code', 'products.article'),
        ]);

        return response()->json(['data' => $productCollection]);
    }

    public function update(ProductCollectionRequest $request, ProductCollection $productCollection): JsonResponse
    {
        $productCollection->update($request->validated());

        return response()->json(['data' => $productCollection]);
    }

    public function destroy(ProductCollection $productCollection): JsonResponse
    {
        $productCollection->delete();

        return response()->json(null, 204);
    }
}
