<?php

namespace App\Filament\Resources\Categories\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class CategoriesTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('sort_order')
            ->columns([
                TextColumn::make('name')->label('Название')->searchable()->sortable(),
                TextColumn::make('parent.name')->label('Родитель')->placeholder('—'),
                TextColumn::make('slug')->label('Слаг')->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('products_count')->label('Товаров')->counts('products')->badge(),
                TextColumn::make('sort_order')->label('Сортировка')->numeric()->sortable(),
                IconColumn::make('is_active')->label('Активна')->boolean(),
                TextColumn::make('created_at')->label('Создана')->dateTime()->sortable()->toggleable(isToggledHiddenByDefault: true),
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
