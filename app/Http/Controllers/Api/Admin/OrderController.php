<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class OrderController extends Controller
{
    public function index(): JsonResponse
    {
        $orders = QueryBuilder::for(Order::class)
            ->allowedFilters([
                AllowedFilter::exact('status'),
                AllowedFilter::exact('type'),
                AllowedFilter::callback('search', function ($query, $value): void {
                    $query->where(function ($q) use ($value): void {
                        $q->where('id', $value)
                          ->orWhere('number', 'LIKE', "%{$value}%")
                          ->orWhereHas('user', function ($uq) use ($value): void {
                              $uq->where('phone', 'LIKE', "%{$value}%")
                                 ->orWhere('name', 'LIKE', "%{$value}%");
                          });
                    });
                }),
            ])
            ->with(['user'])
            ->latest()
            ->paginate(20);

        return response()->json($orders);
    }

    public function show(int $id): JsonResponse
    {
        $order = Order::with([
            'user',
            'address',
            'items.product.media',
        ])->findOrFail($id);

        return response()->json(['data' => $order]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:' . implode(',', Order::ALL_STATUSES)],
        ]);

        $order = Order::findOrFail($id);
        $order->update(['status' => $validated['status']]);

        return response()->json(['data' => $order->fresh(['user', 'address', 'items.product.media'])]);
    }
}
