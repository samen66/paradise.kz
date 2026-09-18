<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreRequest;
use App\Models\GoodsReceipt;
use App\Models\Order;
use App\Models\Store;
use App\Models\WriteOff;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Warehouses. Deleting one cascades batches, movements and receipts at the
 * database level, so the controller refuses to delete a warehouse that has any
 * history, and never lets the last active warehouse go: without one
 * StoreResolver returns null and checkout fails.
 */
class StoreController extends Controller
{
    /** ERP bookkeeping kept as data, never shown in the admin. */
    private const HIDDEN = ['source', 'external_id'];

    public function index(): JsonResponse
    {
        $stores = Store::query()->orderByDesc('is_default')->orderBy('name')->get()->each->makeHidden(self::HIDDEN);

        return response()->json(['data' => $stores]);
    }

    public function store(StoreRequest $request): JsonResponse
    {
        $data = $request->validated();

        $store = DB::transaction(function () use ($data): Store {
            if (! empty($data['is_default'])) {
                Store::query()->update(['is_default' => false]);
            }

            return Store::create($data);
        });

        return response()->json(['data' => $store->refresh()->makeHidden(self::HIDDEN)], 201);
    }

    public function show(Store $store): JsonResponse
    {
        return response()->json(['data' => $store->makeHidden(self::HIDDEN)]);
    }

    public function update(StoreRequest $request, Store $store): JsonResponse
    {
        $data = $request->validated();

        $result = DB::transaction(function () use ($store, $data): JsonResponse|Store {
            /** @var Store $locked */
            $locked = Store::query()->whereKey($store->id)->lockForUpdate()->firstOrFail();

            if (array_key_exists('is_active', $data) && ! $data['is_active'] && $this->isLastActive($locked)) {
                return response()->json(['message' => 'Это последний активный склад — без него витрина и оформление заказов перестанут работать.'], 422);
            }

            if (! empty($data['is_default'])) {
                Store::query()->whereKeyNot($locked->id)->update(['is_default' => false]);
            }

            $locked->update($data);

            return $locked;
        });

        if ($result instanceof JsonResponse) {
            return $result;
        }

        return response()->json(['data' => $result->refresh()->makeHidden(self::HIDDEN)]);
    }

    public function destroy(Store $store): JsonResponse
    {
        return DB::transaction(function () use ($store): JsonResponse {
            /** @var Store $locked */
            $locked = Store::query()->whereKey($store->id)->lockForUpdate()->firstOrFail();

            if ($this->hasHistory($locked)) {
                return response()->json(['message' => 'У склада есть история (движения, приёмки, списания или заказы) — удалить нельзя, выключите его.'], 422);
            }

            if ($this->isLastActive($locked)) {
                return response()->json(['message' => 'Это последний активный склад — удалить нельзя.'], 422);
            }

            $locked->delete();

            return response()->json(null, 204);
        });
    }

    private function isLastActive(Store $store): bool
    {
        return $store->is_active
            && ! Store::query()->where('is_active', true)->whereKeyNot($store->id)->lockForUpdate()->exists();
    }

    private function hasHistory(Store $store): bool
    {
        return $store->stockMovements()->exists()
            || $store->batches()->exists()
            || GoodsReceipt::query()->where('store_id', $store->id)->exists()
            || WriteOff::query()->where('store_id', $store->id)->exists()
            || Order::query()->where('store_id', $store->id)->exists();
    }
}
