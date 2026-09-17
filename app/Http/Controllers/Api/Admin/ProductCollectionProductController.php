<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductCollectionProductController extends Controller
{
    /**
     * Put a product in the collection at the given position, or move it
     * there if it is already in.
     */
    public function upsert(Request $request, ProductCollection $productCollection, Product $product): JsonResponse
    {
        $validated = $request->validate(['sort_order' => ['nullable', 'integer']]);

        $productCollection->products()->syncWithoutDetaching([
            $product->id => ['sort_order' => (int) ($validated['sort_order'] ?? 0)],
        ]);

        return response()->json(null, 204);
    }

    public function destroy(ProductCollection $productCollection, Product $product): JsonResponse
    {
        $productCollection->products()->detach($product->id);

        return response()->json(null, 204);
    }
}
