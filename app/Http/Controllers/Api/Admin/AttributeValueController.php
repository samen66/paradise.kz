<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AttributeValueRequest;
use App\Models\AttributeValue;
use App\Models\Product;
use Illuminate\Http\JsonResponse;

class AttributeValueController extends Controller
{
    private const ATTRIBUTE_COLUMNS = 'attribute:id,name,slug';

    public function index(Product $product): JsonResponse
    {
        return response()->json(['data' => $product->attributeValues()->with(self::ATTRIBUTE_COLUMNS)->orderBy('id')->get()]);
    }

    public function store(AttributeValueRequest $request, Product $product): JsonResponse
    {
        $value = $product->attributeValues()->create($request->validated());

        return response()->json(['data' => $value->load(self::ATTRIBUTE_COLUMNS)], 201);
    }

    public function update(AttributeValueRequest $request, Product $product, AttributeValue $attributeValue): JsonResponse
    {
        $attributeValue->update($request->validated());

        return response()->json(['data' => $attributeValue->load(self::ATTRIBUTE_COLUMNS)]);
    }

    public function destroy(Product $product, AttributeValue $attributeValue): JsonResponse
    {
        $attributeValue->delete();

        return response()->json(null, 204);
    }
}
