<?php

namespace App\Filament\Resources\GoodsReceipts\RelationManagers;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\CreateAction;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

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
                    ->formatStateUsing(fn ($state) => $state !== null ? (float)$state / 100 : null)
                    ->dehydrateStateUsing(fn ($state) => $state !== null ? (int)round((float)$state * 100) : null),
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
                    ->formatStateUsing(fn ($state) => $state !== null ? number_format((float)$state / 100, 2, '.', '') : null),
            ])
            ->filters([])
            ->headerActions([
                CreateAction::make()
                    ->visible(fn (): bool => ! $this->getOwnerRecord()->isPosted()),
            ])
            ->recordActions([
                EditAction::make()
                    ->visible(fn (): bool => ! $this->getOwnerRecord()->isPosted()),
                DeleteAction::make()
                    ->visible(fn (): bool => ! $this->getOwnerRecord()->isPosted()),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
