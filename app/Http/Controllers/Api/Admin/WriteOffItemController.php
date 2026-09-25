<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\RefusesPostedDocuments;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DocumentItemsBatchRequest;
use App\Http\Requests\Admin\WriteOffItemRequest;
use App\Models\ProductStoreStock;
use App\Models\WriteOff;
use App\Models\WriteOffItem;
use App\Services\Inventory\DocumentLines;
use Illuminate\Http\JsonResponse;

class WriteOffItemController extends Controller
{
    use RefusesPostedDocuments;

    private const PRODUCT_COLUMNS = 'product:id,name,code,article';

    /**
     * Each line carries `available` — on-hand at the document's warehouse —
     * so a shortage is visible before posting, not only after the 422.
     */
    public function index(WriteOff $writeOff): JsonResponse
    {
        $items = $writeOff->items()->with(self::PRODUCT_COLUMNS)->orderBy('id')->get();

        $onHand = ProductStoreStock::query()
            ->where('store_id', $writeOff->store_id)
            ->whereIn('product_id', $items->pluck('product_id'))
            ->pluck('stock', 'product_id');

        $items->each(fn (WriteOffItem $item) => $item->setAttribute('available', (float) ($onHand[$item->product_id] ?? 0)));

        return response()->json(['data' => $items]);
    }

    /**
     * 201 — новая строка; 200 — товар уже был в документе, его строка
     * получила переданное количество (или +1).
     */
    public function store(WriteOffItemRequest $request, WriteOff $writeOff, DocumentLines $lines): JsonResponse
    {
        return $this->whileDraft($writeOff, function (WriteOff $locked) use ($request, $lines): JsonResponse {
            $data = $request->validated();

            ['item' => $item, 'created' => $created] = $lines->add(
                $locked,
                (int) $data['product_id'],
                isset($data['quantity']) ? (string) $data['quantity'] : null,
            );

            return response()->json(['data' => $item->load(self::PRODUCT_COLUMNS)], $created ? 201 : 200);
        });
    }

    /**
     * Все строки пачки — в одной транзакции; ответ — все строки документа
     * с `available`, как у `index`.
     */
    public function batch(DocumentItemsBatchRequest $request, WriteOff $writeOff, DocumentLines $lines): JsonResponse
    {
        return $this->whileDraft($writeOff, function (WriteOff $locked) use ($request, $lines): JsonResponse {
            $lines->addMany($locked, $request->validated('items'));

            return $this->index($locked);
        });
    }

    public function update(WriteOffItemRequest $request, WriteOff $writeOff, WriteOffItem $item): JsonResponse
    {
        return $this->whileDraft($writeOff, function () use ($request, $item): JsonResponse {
            $item->update($request->validated());

            return response()->json(['data' => $item->load(self::PRODUCT_COLUMNS)]);
        });
    }

    public function destroy(WriteOff $writeOff, WriteOffItem $item): JsonResponse
    {
        return $this->whileDraft($writeOff, function () use ($item): JsonResponse {
            $item->delete();

            return response()->json(null, 204);
        });
    }
}
