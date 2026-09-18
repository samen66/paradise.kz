<?php

namespace App\Filament\Resources\GoodsReceipts\RelationManagers;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use Filament\Actions\Action;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\CreateAction;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Support\Facades\DB;

class ItemsRelationManager extends RelationManager
{
    protected static string $relationship = 'items';

    protected static ?string $title = 'Позиции';

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('product_id')
                    ->label('Товар')
                    ->relationship('product', 'name')
                    ->searchable()
                    ->preload()
                    ->required(),
                TextInput::make('quantity')
                    ->label('Количество')
                    ->numeric()
                    ->required()
                    ->minValue(0.001),
                TextInput::make('unit_cost')
                    ->label('Себестоимость (₸)')
                    ->numeric()
                    ->required()
                    ->minValue(0)
                    ->step('0.01')
                    ->formatStateUsing(fn ($state) => $state !== null ? (float) $state / 100 : null)
                    ->dehydrateStateUsing(fn ($state) => $state !== null ? (int) round((float) $state * 100) : null),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('id')
            ->columns([
                TextColumn::make('product.name')->label('Товар')->searchable(),
                TextColumn::make('quantity')->label('Количество')->numeric(),
                TextColumn::make('unit_cost')
                    ->label('Себестоимость (₸)')
                    ->numeric()
                    ->sortable()
                    ->formatStateUsing(fn ($state) => $state !== null ? number_format((float) $state / 100, 2, '.', '') : null),
            ])
            ->filters([])
            ->headerActions([
                CreateAction::make()
                    ->visible(fn (): bool => ! $this->getOwnerRecord()->isPosted())
                    ->before(function (CreateAction $action): void {
                        $this->haltIfReceiptPosted($action, $this->getOwnerRecord());
                    }),
            ])
            ->recordActions([
                EditAction::make()
                    ->visible(fn (): bool => ! $this->getOwnerRecord()->isPosted())
                    ->before(function (EditAction $action, GoodsReceiptItem $record): void {
                        $this->haltIfReceiptPosted($action, $record->goodsReceipt);
                    }),
                DeleteAction::make()
                    ->visible(fn (): bool => ! $this->getOwnerRecord()->isPosted())
                    ->before(function (DeleteAction $action, GoodsReceiptItem $record): void {
                        $this->haltIfReceiptPosted($action, $record->goodsReceipt);
                    }),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }

    /**
     * Re-reads the owner receipt under a row lock rather than trusting the
     * Livewire component's in-memory copy: a page left open since before the
     * receipt was posted would otherwise still show the create/edit/delete
     * buttons and be able to write a line into a document the ledger already
     * considers closed.
     */
    private function haltIfReceiptPosted(Action $action, GoodsReceipt $receipt): void
    {
        $isPosted = DB::transaction(
            fn (): bool => GoodsReceipt::query()->lockForUpdate()->findOrFail($receipt->id)->isPosted(),
        );

        if (! $isPosted) {
            return;
        }

        Notification::make()
            ->title('Документ проведён — изменить нельзя.')
            ->danger()
            ->send();

        $action->halt();
    }
}
