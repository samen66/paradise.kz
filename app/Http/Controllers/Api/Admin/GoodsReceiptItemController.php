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
        if ($refusal = $this->refuseIfPosted($goodsReceipt)) {
            return $refusal;
        }

        $item = $goodsReceipt->items()->create($request->validated());

        return response()->json(['data' => $item->load(self::PRODUCT_COLUMNS)], 201);
    }

    public function update(GoodsReceiptItemRequest $request, GoodsReceipt $goodsReceipt, GoodsReceiptItem $item): JsonResponse
    {
        if ($refusal = $this->refuseIfPosted($goodsReceipt)) {
            return $refusal;
        }

        $item->update($request->validated());

        return response()->json(['data' => $item->load(self::PRODUCT_COLUMNS)]);
    }

    public function destroy(GoodsReceipt $goodsReceipt, GoodsReceiptItem $item): JsonResponse
    {
        if ($refusal = $this->refuseIfPosted($goodsReceipt)) {
            return $refusal;
        }

        $item->delete();

        return response()->json(null, 204);
    }
}
