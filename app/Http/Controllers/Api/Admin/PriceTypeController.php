<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PriceTypeRequest;
use App\Models\PriceType;
use Illuminate\Http\JsonResponse;

class PriceTypeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => PriceType::orderBy('sort_order')->orderBy('name')->get()]);
    }

    public function store(PriceTypeRequest $request): JsonResponse
    {
        return response()->json(['data' => PriceType::create($request->validated())], 201);
    }

    public function show(PriceType $priceType): JsonResponse
    {
        return response()->json(['data' => $priceType]);
    }

    public function update(PriceTypeRequest $request, PriceType $priceType): JsonResponse
    {
        $priceType->update($request->validated());

        return response()->json(['data' => $priceType]);
    }

    /**
     * PricingService resolves prices by type code — deleting a type in use
     * would silently cascade away product prices the storefront shows.
     */
    public function destroy(PriceType $priceType): JsonResponse
    {
        if ($priceType->productPrices()->exists()) {
            return response()->json(['message' => 'По этому типу заданы цены товаров — сначала удалите их.'], 422);
        }

        $priceType->delete();

        return response()->json(null, 204);
    }
}
