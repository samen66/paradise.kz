<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\GoodsReceipt;
use App\Models\ProductStoreStock;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\WriteOff;
use App\Services\Inventory\StockByProduct;
use App\Services\Inventory\StockMovementPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * Read-only view of on-hand stock per product and warehouse.
 *
 * Quantities here are a projection of the FIFO ledger and are never written
 * through this endpoint — stock moves by posting a goods receipt or an
 * adjustment, so that every change leaves a row in `stock_movements`. This
 * exists so a manager can answer "what do we actually have?" without leaving
 * the admin panel.
 *
 * The response also carries `meta.has_active_store`. Without an active store
 * StoreResolver resolves to null and the whole stock story falls apart quietly
 * — the catalog reports zeroes and checkout 404s on `Store::findOrFail()` — so
 * the admin panel warns about it. This is the only warehouse endpoint the
 * panel has; a separate route for one boolean would not earn its keep.
 *
 * `products` — остатки по товару для вкладки «Остатки», см. StockByProduct.
 */
class StockController extends Controller
{
    private const PER_PAGE = 50;

    /**
     * Filters: filter[search]=<name|code|article>, filter[store_id]=<id>,
     *          filter[low]=<threshold> (on-hand at or below the threshold —
     *          pass 0 to list what has run out).
     * Sorts:   stock, avg_cost, updated_at (and `-` forms).
     */
    public function index(Request $request): JsonResponse
    {
        $rows = QueryBuilder::for(ProductStoreStock::class)
            ->allowedFilters(
                AllowedFilter::exact('store_id'),
                AllowedFilter::callback('search', function ($query, $value): void {
                    $query->whereHas('product', function ($q) use ($value): void {
                        $q->where('name->ru', 'LIKE', "%{$value}%")
                            ->orWhere('name->kk', 'LIKE', "%{$value}%")
                            ->orWhere('code', 'LIKE', "%{$value}%")
                            ->orWhere('article', 'LIKE', "%{$value}%");
                    });
                }),
                AllowedFilter::callback('low', function ($query, $value): void {
                    $query->where('stock', '<=', (float) $value);
                }),
            )
            ->allowedSorts('stock', 'avg_cost', 'updated_at')
            ->defaultSort('-updated_at')
            ->with(['product:id,name,code,article', 'store:id,name'])
            ->paginate(self::PER_PAGE)
            ->appends($request->query());

        $payload = $rows->toArray();
        $payload['meta'] = [
            'has_active_store' => Store::query()->where('is_active', true)->exists(),
        ];

        return response()->json($payload);
    }

    /**
     * Остатки по товару (вкладка «Остатки»).
     *
     * Filters: filter[search], filter[store_id], filter[product_id],
     *          filter[status]=low|out. Sort: name, stock, stock_value (и `-`);
     *          неизвестная сортировка — по названию.
     */
    public function products(Request $request, StockByProduct $stock): JsonResponse
    {
        $validated = $request->validate([
            'filter.search' => ['nullable', 'string', 'max:255'],
            'filter.store_id' => ['nullable', 'integer'],
            'filter.product_id' => ['nullable', 'integer'],
            'filter.status' => ['nullable', Rule::in(StockByProduct::STATUSES)],
            'sort' => ['nullable', 'string', 'max:32'],
        ]);

        $filter = $validated['filter'] ?? [];

        $result = $stock->list([
            'search' => $filter['search'] ?? null,
            'store_id' => isset($filter['store_id']) ? (int) $filter['store_id'] : null,
            'product_id' => isset($filter['product_id']) ? (int) $filter['product_id'] : null,
            'status' => $filter['status'] ?? null,
            'sort' => $validated['sort'] ?? null,
        ]);

        $payload = $result['page']->appends($request->query())->toArray();
        $payload['meta'] = [
            'counts' => $result['counts'],
            'total_value' => $result['total_value'],
            'low_stock_threshold' => $stock->threshold(),
        ];

        return response()->json($payload);
    }

    /**
     * Сводка для вкладки «Обзор»: стоимость запаса, заканчивается / нет в
     * наличии (по всем местам хранения), черновики документов, пять последних
     * движений, есть ли активный склад.
     */
    public function summary(StockByProduct $stock, StockMovementPresenter $presenter): JsonResponse
    {
        $totals = $stock->totals([]);

        $recent = StockMovement::query()
            ->with(StockMovementPresenter::RELATIONS)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(5)
            ->get()
            ->map(fn (StockMovement $movement): array => $presenter->present($movement))
            ->all();

        return response()->json(['data' => [
            'total_value' => $totals['total_value'],
            'low' => $totals['counts']['low'],
            'out' => $totals['counts']['out'],
            'drafts' => [
                'receipts' => GoodsReceipt::query()->where('status', GoodsReceipt::STATUS_DRAFT)->count(),
                'write_offs' => WriteOff::query()->where('status', WriteOff::STATUS_DRAFT)->count(),
            ],
            'recent_movements' => $recent,
            'has_active_store' => Store::query()->where('is_active', true)->exists(),
        ]]);
    }
}
