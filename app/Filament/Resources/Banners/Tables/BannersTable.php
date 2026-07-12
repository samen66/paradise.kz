<?php

namespace App\Filament\Resources\Banners\Tables;

use App\Models\Banner;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class BannersTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('sort_order')
            ->columns([
                ImageColumn::make('image')
                    ->label('Изображение')
                    ->getStateUsing(fn (Banner $record): ?string => $record
                        ->getFirstMediaUrl(Banner::IMAGE_COLLECTION, 'mobile') ?: null),
                TextColumn::make('title')->label('Заголовок')->searchable(),
                TextColumn::make('placement')->label('Размещение'),
                TextColumn::make('sort_order')->label('Порядок')->sortable(),
                IconColumn::make('is_active')->label('Активен')->boolean(),
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
