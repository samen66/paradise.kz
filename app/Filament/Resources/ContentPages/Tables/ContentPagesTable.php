<?php

namespace App\Filament\Resources\ContentPages\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class ContentPagesTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('slug')
            ->columns([
                TextColumn::make('title')->label('Заголовок')->searchable(),
                TextColumn::make('slug')->label('Слаг')->searchable(),
                IconColumn::make('is_active')->label('Опубликована')->boolean(),
                TextColumn::make('updated_at')->label('Обновлена')->dateTime()->sortable(),
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
