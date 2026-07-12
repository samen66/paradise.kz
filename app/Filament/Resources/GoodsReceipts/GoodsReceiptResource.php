<?php

namespace App\Filament\Resources\GoodsReceipts;

use App\Filament\Resources\GoodsReceipts\Pages\CreateGoodsReceipt;
use App\Filament\Resources\GoodsReceipts\Pages\EditGoodsReceipt;
use App\Filament\Resources\GoodsReceipts\Pages\ListGoodsReceipts;
use App\Filament\Resources\GoodsReceipts\RelationManagers\ItemsRelationManager;
use App\Filament\Resources\GoodsReceipts\Schemas\GoodsReceiptForm;
use App\Filament\Resources\GoodsReceipts\Tables\GoodsReceiptsTable;
use App\Models\GoodsReceipt;
use App\Services\Inventory\GoodsReceiptService;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use RuntimeException;

class GoodsReceiptResource extends Resource
{
    protected static ?string $model = GoodsReceipt::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedInboxArrowDown;

    protected static ?string $navigationLabel = 'Приёмки';

    protected static ?string $modelLabel = 'Приёмка';

    protected static ?string $pluralModelLabel = 'Приёмки';

    public static function getNavigationGroup(): ?string
    {
        return 'Склад';
    }

    public static function form(Schema $schema): Schema
    {
        return GoodsReceiptForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return GoodsReceiptsTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            ItemsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListGoodsReceipts::route('/'),
            'create' => CreateGoodsReceipt::route('/create'),
            'edit' => EditGoodsReceipt::route('/{record}/edit'),
        ];
    }

    /**
     * The "Провести" action, shared by the table row and the edit page header.
     * Posting writes the FIFO batches + stock movements via GoodsReceiptService.
     */
    public static function postAction(): Action
    {
        return Action::make('post')
            ->label('Провести')
            ->icon(Heroicon::OutlinedCheckCircle)
            ->color('success')
            ->requiresConfirmation()
            ->modalHeading('Провести приёмку?')
            ->modalDescription('Будут созданы партии и движения по складу. Действие необратимо.')
            ->visible(fn (GoodsReceipt $record): bool => ! $record->isPosted())
            ->action(function (GoodsReceipt $record): void {
                try {
                    app(GoodsReceiptService::class)->post($record, auth()->user());
                } catch (RuntimeException $exception) {
                    Notification::make()
                        ->title('Не удалось провести приёмку')
                        ->body($exception->getMessage())
                        ->danger()
                        ->send();

                    return;
                }

                Notification::make()
                    ->title('Приёмка проведена')
                    ->success()
                    ->send();
            });
    }
}
