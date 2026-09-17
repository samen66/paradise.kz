<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\RefusesPostedDocuments;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\WriteOffItemRequest;
use App\Models\ProductStoreStock;
use App\Models\WriteOff;
use App\Models\WriteOffItem;
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

    public function store(WriteOffItemRequest $request, WriteOff $writeOff): JsonResponse
    {
        return $this->whileDraft($writeOff, function (WriteOff $locked) use ($request): JsonResponse {
            $item = $locked->items()->create($request->validated());

            return response()->json(['data' => $item->load(self::PRODUCT_COLUMNS)], 201);
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
