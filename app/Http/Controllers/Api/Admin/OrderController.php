<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use App\Services\Orders\OrderCancellationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class OrderController extends Controller
{
    /** Псевдостатус вкладки «Архив»: в колонке status такого значения нет. */
    private const ARCHIVED = 'archived';

    /** Легаси-статусы внешней учётной системы, которых больше нет. */
    private const LEGACY_STATUSES = [Order::STATUS_SYNCED, Order::STATUS_FAILED];

    public function index(): JsonResponse
    {
        $orders = $this->baseQuery()
            // Поимённо, а не ->with(['user']): у модели User нет $hidden, и
            // отношение целиком утащило бы в ответ хеш пароля и remember_token.
            ->with(['user:id,name,phone,email,type'])
            ->latest()
            ->paginate(20);

        return response()->json($orders);
    }

    /**
     * Общая основа списка: фильтры сегмента, статуса и поиска.
     *
     * Вынесено отдельно, потому что счётчики вкладок считаются по этой же
     * основе — иначе они разъехались бы со списком.
     */
    private function baseQuery(): QueryBuilder
    {
        return QueryBuilder::for(Order::class)
            ->allowedFilters(
                AllowedFilter::callback('status', function ($query, $value): void {
                    if ($value === self::ARCHIVED) {
                        $query->whereIn('status', self::LEGACY_STATUSES);

                        return;
                    }

                    $query->where('status', $value);
                }),
                AllowedFilter::callback('segment', fn ($query, $value) => $this->applySegment($query, (string) $value)),
                AllowedFilter::callback('search', fn ($query, $value) => $this->applySearch($query, (string) $value)),
            );
    }

    /**
     * Сегмент живёт на пользователе (users.type), не на заказе: тип клиента не
     * переключается, поэтому снапшот на заказе не нужен.
     *
     * Вынесено отдельным методом, потому что счётчики вкладок применяют тот же
     * сегмент к своему запросу — а он собирается мимо Query Builder.
     */
    private function applySegment(Builder $query, string $value): void
    {
        $type = $value === 'b2b' ? User::TYPE_B2B : User::TYPE_RETAIL;

        $query->whereHas('user', function ($uq) use ($type): void {
            $uq->where('type', $type);
        });
    }

    private function applySearch(Builder $query, string $value): void
    {
        $query->where(function ($q) use ($value): void {
            $q->where('id', $value)
                ->orWhere('number', 'LIKE', "%{$value}%")
                ->orWhereHas('user', function ($uq) use ($value): void {
                    $uq->where('phone', 'LIKE', "%{$value}%")
                        ->orWhere('name', 'LIKE', "%{$value}%");
                });
        });
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
