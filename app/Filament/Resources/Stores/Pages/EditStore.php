<?php

namespace App\Filament\Resources\Stores\Pages;

use App\Filament\Resources\Stores\StoreResource;
use App\Models\GoodsReceipt;
use App\Models\Order;
use App\Models\Store;
use App\Models\WriteOff;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Support\Facades\DB;

class EditStore extends EditRecord
{
    protected static string $resource = StoreResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make()
                ->visible(fn (Store $record): bool => ! $this->hasHistory($record) && ! $this->isLastActive($record))
                ->before(function (Action $action, Store $record): void {
                    $this->haltIfNotDeletable($action, $record);
                }),
        ];
    }

    /**
     * Mirrors StoreController::destroy()'s refusal rules: deleting a store
     * cascades stock_movements/batches/goods_receipts/product_store_stock at
     * the database level, and losing the last active store breaks checkout
     * (StoreResolver returns null). Re-reads under a row lock rather than
     * trusting this page's in-memory $record, the same way the admin API's
     * StoreController and the goods-receipt Filament guards do.
     */
    private function haltIfNotDeletable(Action $action, Store $record): void
    {
        $locked = DB::transaction(
            fn (): Store => Store::query()->whereKey($record->id)->lockForUpdate()->firstOrFail(),
        );

        if ($this->hasHistory($locked)) {
            Notification::make()
                ->title('У склада есть история (движения, приёмки, списания или заказы) — удалить нельзя, выключите его.')
                ->danger()
                ->send();

            $action->halt();

            return;
        }

        if ($this->isLastActive($locked)) {
            Notification::make()
                ->title('Это последний активный склад — удалить нельзя.')
                ->danger()
                ->send();

            $action->halt();
        }
    }

    private function hasHistory(Store $store): bool
    {
        return $store->stockMovements()->exists()
            || $store->batches()->exists()
            || GoodsReceipt::query()->where('store_id', $store->id)->exists()
            || WriteOff::query()->where('store_id', $store->id)->exists()
            || Order::query()->where('store_id', $store->id)->exists();
    }

    private function isLastActive(Store $store): bool
    {
        return $store->is_active
            && ! Store::query()->where('is_active', true)->whereKeyNot($store->id)->lockForUpdate()->exists();
    }
}
