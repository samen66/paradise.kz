<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\RefusesPostedDocuments;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GoodsReceiptRequest;
use App\Models\GoodsReceipt;
use App\Services\Inventory\GoodsReceiptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class GoodsReceiptController extends Controller
{
    use RefusesPostedDocuments;

    /** Line cost summed in SQL so the list costs one query per page. */
    private const TOTAL_COST_SQL = '(select coalesce(sum(round(quantity * unit_cost)), 0) from goods_receipt_items where goods_receipt_items.goods_receipt_id = goods_receipts.id)';

    public function index(Request $request): JsonResponse
    {
        $receipts = QueryBuilder::for(GoodsReceipt::class)
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('store_id'),
            )
            ->select('goods_receipts.*')
            ->selectRaw(self::TOTAL_COST_SQL.' as total_cost')
            ->withCasts(['total_cost' => 'integer'])
            ->withCount('items')
            ->with(['store:id,name', 'supplier:id,name'])
            ->orderByDesc('id')
            ->paginate(20)
            ->appends($request->query());

        return response()->json($receipts);
    }

    public function store(GoodsReceiptRequest $request): JsonResponse
    {
        $receipt = GoodsReceipt::create([...$request->validated(), 'status' => GoodsReceipt::STATUS_DRAFT]);

        return response()->json(['data' => $this->present($receipt)], 201);
    }

    public function show(GoodsReceipt $goodsReceipt): JsonResponse
    {
        return response()->json(['data' => $this->present($goodsReceipt)]);
    }

    public function update(GoodsReceiptRequest $request, GoodsReceipt $goodsReceipt): JsonResponse
    {
        if ($refusal = $this->refuseIfPosted($goodsReceipt)) {
            return $refusal;
        }

        $goodsReceipt->update($request->validated());

        return response()->json(['data' => $this->present($goodsReceipt)]);
    }

    public function destroy(GoodsReceipt $goodsReceipt): JsonResponse
    {
        if ($refusal = $this->refuseIfPosted($goodsReceipt)) {
            return $refusal;
        }

        $goodsReceipt->delete();

        return response()->json(null, 204);
    }

    public function post(Request $request, GoodsReceipt $goodsReceipt, GoodsReceiptService $service): JsonResponse
    {
        try {
            $service->post($goodsReceipt, $request->user());
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['data' => $this->present($goodsReceipt)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(GoodsReceipt $receipt): array
    {
        $receipt->load([
            'store:id,name',
            'supplier:id,name',
            'user:id,name',
            'items' => fn ($query) => $query->orderBy('id'),
            'items.product:id,name,code,article',
        ]);

        return [...$receipt->toArray(), 'total_cost' => $receipt->totalCost()];
    }
}
