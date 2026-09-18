<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\RefusesPostedDocuments;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GoodsReceiptItemRequest;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use Illuminate\Http\JsonResponse;

class GoodsReceiptItemController extends Controller
{
    use RefusesPostedDocuments;

    private const PRODUCT_COLUMNS = 'product:id,name,code,article';

    public function index(GoodsReceipt $goodsReceipt): JsonResponse
    {
        return response()->json(['data' => $goodsReceipt->items()->with(self::PRODUCT_COLUMNS)->orderBy('id')->get()]);
    }

    public function store(GoodsReceiptItemRequest $request, GoodsReceipt $goodsReceipt): JsonResponse
    {
        return $this->whileDraft($goodsReceipt, function (GoodsReceipt $locked) use ($request): JsonResponse {
            $item = $locked->items()->create($request->validated());

            return response()->json(['data' => $item->load(self::PRODUCT_COLUMNS)], 201);
        });
    }

    public function update(GoodsReceiptItemRequest $request, GoodsReceipt $goodsReceipt, GoodsReceiptItem $item): JsonResponse
    {
        return $this->whileDraft($goodsReceipt, function () use ($request, $item): JsonResponse {
            $item->update($request->validated());

            return response()->json(['data' => $item->load(self::PRODUCT_COLUMNS)]);
        });
    }

    public function destroy(GoodsReceipt $goodsReceipt, GoodsReceiptItem $item): JsonResponse
    {
        return $this->whileDraft($goodsReceipt, function () use ($item): JsonResponse {
            $item->delete();

            return response()->json(null, 204);
        });
    }
}
