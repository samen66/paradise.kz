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
    private const PRICE_TYPE_COLUMNS = 'priceType:id,code,name';

    public function index(Product $product): JsonResponse
    {
        return response()->json(['data' => $product->prices()->with(self::PRICE_TYPE_COLUMNS)->orderBy('id')->get()]);
    }

    public function store(ProductPriceRequest $request, Product $product): JsonResponse
    {
        $price = $product->prices()->create($request->validated());

        return response()->json(['data' => $price->load(self::PRICE_TYPE_COLUMNS)], 201);
    }

    public function update(ProductPriceRequest $request, Product $product, ProductPrice $price): JsonResponse
    {
        $price->update($request->validated());

        return response()->json(['data' => $price->load(self::PRICE_TYPE_COLUMNS)]);
    }

    public function destroy(Product $product, ProductPrice $price): JsonResponse
    {
        $price->delete();

        return response()->json(null, 204);
    }
}
