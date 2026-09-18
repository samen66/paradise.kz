<?php

namespace App\Filament\Resources\Stores\Tables;

use Filament\Actions\EditAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class StoresTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('name')
            ->columns([
                TextColumn::make('name')->label('Название')->searchable(),
                TextColumn::make('source')->label('Источник')->badge()->sortable()->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('external_id')->label('Внешний ID')->searchable()->toggleable(isToggledHiddenByDefault: true),
                IconColumn::make('is_active')->label('Доступен клиентам')->boolean(),
                TextColumn::make('created_at')->dateTime()->sortable()->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('updated_at')->dateTime()->sortable()->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([])
            ->recordActions([
                EditAction::make(),
            ]);
    }
}
