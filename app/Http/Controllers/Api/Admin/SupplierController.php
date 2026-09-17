<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SupplierRequest;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class SupplierController extends Controller
{
    public function index(): JsonResponse
    {
        $suppliers = QueryBuilder::for(Supplier::class)
            ->allowedFilters(
                AllowedFilter::callback('search', function ($query, $value): void {
                    $query->where(function ($q) use ($value): void {
                        $q->where('name', 'LIKE', "%{$value}%")
                            ->orWhere('bin', 'LIKE', "%{$value}%");
                    });
                }),
            )
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $suppliers]);
    }

    public function store(SupplierRequest $request): JsonResponse
    {
        return response()->json(['data' => Supplier::create($request->validated())], 201);
    }

    public function show(Supplier $supplier): JsonResponse
    {
        return response()->json(['data' => $supplier]);
    }

    public function update(SupplierRequest $request, Supplier $supplier): JsonResponse
    {
        $supplier->update($request->validated());

        return response()->json(['data' => $supplier]);
    }

    /**
     * Receipts keep pointing at their supplier; a manager switches the
     * supplier off (is_active) instead.
     */
    public function destroy(Supplier $supplier): JsonResponse
    {
        if ($supplier->goodsReceipts()->exists()) {
            return response()->json(['message' => 'У поставщика есть приёмки — удалить нельзя, выключите его.'], 422);
        }

        $supplier->delete();

        return response()->json(null, 204);
    }
}
