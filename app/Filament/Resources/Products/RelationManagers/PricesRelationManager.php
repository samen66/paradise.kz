<?php

namespace App\Filament\Resources\Products\RelationManagers;

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

class PricesRelationManager extends RelationManager
{
    protected static string $relationship = 'prices';

    protected static ?string $title = 'Цены';

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('price_type_id')
                    ->label('Тип цены')
                    ->relationship('priceType', 'name')
                    ->searchable()
                    ->preload()
                    ->required(),
                TextInput::make('price')
                    ->label('Цена (₸)')
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
            ->recordTitleAttribute('price')
            ->columns([
                TextColumn::make('priceType.name')->label('Тип цены')->searchable(),
                TextColumn::make('price')
                    ->label('Цена (₸)')
                    ->numeric()
                    ->sortable()
                    ->formatStateUsing(fn ($state) => $state !== null ? number_format((float)$state / 100, 2, '.', '') : null),
            ])
            ->filters([])
            ->headerActions([
                CreateAction::make(),
            ])
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
