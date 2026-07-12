<?php

namespace App\Filament\Resources\ProductCollections\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class ProductCollectionsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('sort_order')
            ->columns([
                TextColumn::make('title')->label('Название')->searchable(),
                TextColumn::make('slug')->label('Слаг')->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('products_count')->label('Товаров')->counts('products')->badge(),
                TextColumn::make('sort_order')->label('Порядок')->sortable(),
                IconColumn::make('is_active')->label('Активна')->boolean(),
            ])
            ->filters([])
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
