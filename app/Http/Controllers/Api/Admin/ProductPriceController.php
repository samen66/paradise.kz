<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProductPriceRequest;
use App\Models\Product;
use App\Models\ProductPrice;
use Illuminate\Http\JsonResponse;

class ProductPriceController extends Controller
{
    public function index(Product $product): JsonResponse
    {
        return response()->json(['data' => $product->prices()->with('priceType')->orderBy('id')->get()]);
    }

    public function store(ProductPriceRequest $request, Product $product): JsonResponse
    {
        $price = $product->prices()->create($request->validated());

        return response()->json(['data' => $price->load('priceType')], 201);
    }

    public function update(ProductPriceRequest $request, Product $product, ProductPrice $price): JsonResponse
    {
        $price->update($request->validated());

        return response()->json(['data' => $price->load('priceType')]);
    }

    public function destroy(Product $product, ProductPrice $price): JsonResponse
    {
        $price->delete();

        return response()->json(null, 204);
    }
}
