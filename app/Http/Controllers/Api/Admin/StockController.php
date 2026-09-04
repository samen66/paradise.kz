<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProductStoreStock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

        return response()->json($rows);
    }
}
