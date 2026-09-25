<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\RefusesPostedDocuments;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GoodsReceiptItemRequest;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Services\Inventory\DocumentLines;
use Illuminate\Http\JsonResponse;

class GoodsReceiptItemController extends Controller
{
    use RefusesPostedDocuments;

    private const PRODUCT_COLUMNS = 'product:id,name,code,article';

    public function index(GoodsReceipt $goodsReceipt): JsonResponse
    {
        return response()->json(['data' => $goodsReceipt->items()->with(self::PRODUCT_COLUMNS)->orderBy('id')->get()]);
    }

    /**
     * 201 — новая строка; 200 — товар уже был в документе, его строка
     * получила переданное количество (или +1).
     */
    public function store(GoodsReceiptItemRequest $request, GoodsReceipt $goodsReceipt, DocumentLines $lines): JsonResponse
    {
        return $this->whileDraft($goodsReceipt, function (GoodsReceipt $locked) use ($request, $lines): JsonResponse {
            $data = $request->validated();

            ['item' => $item, 'created' => $created] = $lines->add(
                $locked,
                (int) $data['product_id'],
                isset($data['quantity']) ? (string) $data['quantity'] : null,
                isset($data['unit_cost']) ? (int) $data['unit_cost'] : null,
            );

            return response()->json(['data' => $item->load(self::PRODUCT_COLUMNS)], $created ? 201 : 200);
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
