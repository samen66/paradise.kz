<?php

namespace App\Filament\Resources\GoodsReceipts\Pages;

use App\Filament\Resources\GoodsReceipts\GoodsReceiptResource;
use App\Models\GoodsReceipt;
use Filament\Actions\DeleteAction;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Support\Facades\DB;

class EditGoodsReceipt extends EditRecord
{
    protected static string $resource = GoodsReceiptResource::class;

    protected function getHeaderActions(): array
    {
        return [
            GoodsReceiptResource::postAction(),
            DeleteAction::make()
                ->visible(fn (GoodsReceipt $record): bool => ! $record->isPosted())
                ->before(function (DeleteAction $action, GoodsReceipt $record): void {
                    // Re-check under a row lock rather than trust this page's
                    // in-memory $record: a page left open since before the
                    // receipt was posted would otherwise still offer delete.
                    $isPosted = DB::transaction(
                        fn (): bool => GoodsReceipt::query()->lockForUpdate()->findOrFail($record->id)->isPosted(),
                    );

                    if (! $isPosted) {
                        return;
                    }

                    Notification::make()
                        ->title('Документ проведён — изменить нельзя.')
                        ->danger()
                        ->send();

                    $action->halt();
                }),
        ];
    }
}
