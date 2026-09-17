<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProductVariantRequest;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class ProductVariantController extends Controller
{
    /** ERP bookkeeping kept as data, never shown in the admin. */
    private const HIDDEN = ['source', 'external_id', 'synced_at'];

    public function index(Product $product): JsonResponse
    {
        $variants = $product->variants()->orderBy('id')->get()->each->makeHidden(self::HIDDEN);

        return response()->json(['data' => $variants]);
    }

    public function store(ProductVariantRequest $request, Product $product): JsonResponse
    {
        $variant = $product->variants()->create([
            ...$request->validated(),
            // NOT NULL columns from the ERP days; a hand-made variant is local.
            'source' => 'local',
            'external_id' => (string) Str::uuid(),
        ]);

        return response()->json(['data' => $variant->makeHidden(self::HIDDEN)], 201);
    }

    public function update(ProductVariantRequest $request, Product $product, ProductVariant $variant): JsonResponse
    {
        $variant->update($request->validated());

        return response()->json(['data' => $variant->makeHidden(self::HIDDEN)]);
    }

    public function destroy(Product $product, ProductVariant $variant): JsonResponse
    {
        $variant->delete();

        return response()->json(null, 204);
    }
}
