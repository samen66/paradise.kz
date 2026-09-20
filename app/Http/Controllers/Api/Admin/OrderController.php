<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\Orders\OrderCancellationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class OrderController extends Controller
{
    public function index(): JsonResponse
    {
        $orders = QueryBuilder::for(Order::class)
            ->allowedFilters(
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
            )
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

    /**
     * Move an order to another status.
     *
     * Cancelling is not just a status write: the goods have to go back on the
     * shelf, so it goes through {@see OrderCancellationService}. Everything
     * else is a plain update — the OrderObserver picks it up and notifies the
     * customer.
     *
     * Переход проверяется по {@see Order::ALLOWED_TRANSITIONS} — иначе
     * завершённый заказ можно было бы одним PATCH вернуть в «новый».
     */
    public function update(
        Request $request,
        int $id,
        OrderCancellationService $cancellation,
    ): JsonResponse {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', Order::CLIENT_STATUSES)],
        ]);

        $order = Order::findOrFail($id);

        // Статус уже стоит — не ошибка и не работа: молча отдаём заказ.
        if ($validated['status'] === $order->status) {
            return response()->json(['data' => $order->fresh(['user', 'address', 'items.product.media'])]);
        }

        if (! $order->canTransitionTo($validated['status'])) {
            throw ValidationException::withMessages([
                'status' => ['Из статуса «'.$order->status.'» нельзя перейти в «'.$validated['status'].'».'],
            ]);
        }

        if ($validated['status'] === Order::STATUS_CANCELLED) {
            $cancellation->cancel($order, $request->user());
        } else {
            $order->update(['status' => $validated['status']]);
        }

        return response()->json(['data' => $order->fresh(['user', 'address', 'items.product.media'])]);
    }
}
