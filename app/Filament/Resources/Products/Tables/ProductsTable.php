<?php

namespace App\Filament\Resources\Products\Tables;

use App\Models\Product;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class ProductsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('source')
                    ->badge()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('external_id')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('external_folder_id')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('category.name')
                    ->label('Категория')
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('brand.name')
                    ->label('Бренд')
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('name')
                    ->searchable(),
                TextColumn::make('code')
                    ->searchable(),
                TextColumn::make('article')
                    ->searchable(),
                TextColumn::make('retail_price')
                    ->money()
                    ->sortable(),
                TextColumn::make('b2b_price')
                    ->money()
                    ->sortable(),
                TextColumn::make('purchase_price')
                    ->money()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('stock')
                    ->numeric()
                    ->sortable(),
                TextColumn::make('uom')
                    ->searchable(),
                TextColumn::make('country')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('supplier')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('barcodes')
                    ->label('Barcodes')
                    ->getStateUsing(fn (Product $record): int => count($record->barcodes ?? []))
                    ->badge()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('variants_count')
                    ->label('Variants')
                    ->counts('variants')
                    ->badge()
                    ->toggleable(isToggledHiddenByDefault: true),
                ImageColumn::make('images')
                    ->getStateUsing(fn (Product $record): array => $record
                        ->getMedia(Product::IMAGE_COLLECTION)
                        ->map(fn ($media): string => $media->getUrl('thumb'))
                        ->all())
                    ->stacked()
                    ->limit(3),
                IconColumn::make('is_active')
                    ->boolean(),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                //
            ])
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
