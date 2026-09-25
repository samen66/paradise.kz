<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\DefaultsDocumentStore;
use App\Http\Controllers\Api\Admin\Concerns\RefusesPostedDocuments;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GoodsReceiptRequest;
use App\Models\GoodsReceipt;
use App\Models\User;
use App\Services\Inventory\GoodsReceiptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class GoodsReceiptController extends Controller
{
    use DefaultsDocumentStore;
    use RefusesPostedDocuments;

    public function index(Request $request): JsonResponse
    {
        $receipts = QueryBuilder::for(GoodsReceipt::class)
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('store_id'),
            )
            ->withCount('items')
            // Lines are loaded (not summed in SQL) so total_cost agrees, to
            // the тиын, with GoodsReceiptItem::lineCost() used by show() —
            // a SQL sum(round(quantity * unit_cost)) on DECIMAL columns can
            // round differently than the integer arithmetic lineCost() uses.
            ->with([
                'store:id,name',
                'supplier:id,name',
                'items:id,goods_receipt_id,quantity,unit_cost',
            ])
            ->orderByDesc('id')
            ->paginate(20)
            ->appends($request->query());

        $receipts->getCollection()->transform(function (GoodsReceipt $receipt): GoodsReceipt {
            $receipt->setAttribute('total_cost', $receipt->totalCost());
            $receipt->unsetRelation('items');

            return $receipt;
        });

        return response()->json($receipts);
    }

    /**
     * Черновик создаётся и пустым запросом: склад — {@see DefaultsDocumentStore},
     * дата — сейчас, поставщик — из последней приёмки этого менеджера, где он
     * был указан (если ключа `supplier_id` в запросе нет вовсе), автор — менеджер.
     */
    public function store(GoodsReceiptRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validated();

        $data['store_id'] = $this->documentStoreId(isset($data['store_id']) ? (int) $data['store_id'] : null, $user);
        $data['received_at'] ??= now();

        if (! array_key_exists('supplier_id', $data)) {
            $data['supplier_id'] = GoodsReceipt::query()
                ->where('user_id', $user->id)
                ->whereNotNull('supplier_id')
                ->latest('id')
                ->value('supplier_id');
        }

        $receipt = GoodsReceipt::create([...$data, 'status' => GoodsReceipt::STATUS_DRAFT, 'user_id' => $user->id]);

        return response()->json(['data' => $this->present($receipt)], 201);
    }

    public function show(GoodsReceipt $goodsReceipt): JsonResponse
    {
        return response()->json(['data' => $this->present($goodsReceipt)]);
    }

    public function update(GoodsReceiptRequest $request, GoodsReceipt $goodsReceipt): JsonResponse
    {
        return $this->whileDraft($goodsReceipt, function (GoodsReceipt $locked) use ($request): JsonResponse {
            $locked->update($request->validated());

            return response()->json(['data' => $this->present($locked)]);
        });
    }

    public function destroy(GoodsReceipt $goodsReceipt): JsonResponse
    {
        return $this->whileDraft($goodsReceipt, function (GoodsReceipt $locked): JsonResponse {
            $locked->delete();

            return response()->json(null, 204);
        });
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
