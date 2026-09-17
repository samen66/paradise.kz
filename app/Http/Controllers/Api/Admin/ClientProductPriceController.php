<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ClientProductPriceRequest;
use App\Models\ClientProductPrice;
use App\Models\Product;
use Illuminate\Http\JsonResponse;

class ClientProductPriceController extends Controller
{
    private const USER_COLUMNS = 'user:id,company_name,email,phone';

    public function index(Product $product): JsonResponse
    {
        return response()->json(['data' => $product->clientPrices()->with(self::USER_COLUMNS)->orderBy('id')->get()]);
    }

    public function store(ClientProductPriceRequest $request, Product $product): JsonResponse
    {
        $clientPrice = $product->clientPrices()->create($request->validated());

        return response()->json(['data' => $clientPrice->load(self::USER_COLUMNS)], 201);
    }

    public function update(ClientProductPriceRequest $request, Product $product, ClientProductPrice $clientPrice): JsonResponse
    {
        $clientPrice->update($request->validated());

        return response()->json(['data' => $clientPrice->load(self::USER_COLUMNS)]);
    }

    public function destroy(Product $product, ClientProductPrice $clientPrice): JsonResponse
    {
        $clientPrice->delete();

        return response()->json(null, 204);
    }
}
