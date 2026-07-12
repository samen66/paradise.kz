<?php

namespace App\Filament\Resources\ProductCollections\RelationManagers;

use App\Models\Product;
use Filament\Actions\AttachAction;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DetachAction;
use Filament\Actions\DetachBulkAction;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

/**
 * Products inside a home-page collection. Attach-only (products are mirrored
 * from the ERP / managed in the catalog — never created from here); the pivot
 * `sort_order` controls the order within the block.
 */
class ProductsRelationManager extends RelationManager
{
    protected static string $relationship = 'products';

    protected static ?string $title = 'Товары в подборке';

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('name')
            ->columns([
                ImageColumn::make('image')
                    ->label('Фото')
                    ->getStateUsing(fn (Product $record): ?string => $record
                        ->getFirstMediaUrl(Product::IMAGE_COLLECTION, 'thumb') ?: null),
                TextColumn::make('name')->label('Название')->searchable(),
                TextColumn::make('code')->label('Код')->searchable(),
                TextColumn::make('pivot.sort_order')->label('Порядок')->sortable(),
            ])
            ->headerActions([
                AttachAction::make()
                    ->preloadRecordSelect()
                    ->schema(fn (AttachAction $action): array => [
                        $action->getRecordSelect(),
                        TextInput::make('sort_order')
                            ->label('Порядок')
                            ->numeric()
                            ->default(0),
                    ]),
            ])
            ->recordActions([
                DetachAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DetachBulkAction::make(),
                ]),
            ]);
    }
}
