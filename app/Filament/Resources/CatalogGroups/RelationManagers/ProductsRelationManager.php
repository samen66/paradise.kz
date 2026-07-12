<?php

namespace App\Filament\Resources\CatalogGroups\RelationManagers;

use App\Models\Product;
use Filament\Actions\AttachAction;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\CreateAction;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\DetachAction;
use Filament\Actions\DetachBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class ProductsRelationManager extends RelationManager
{
    protected static string $relationship = 'products';

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('external_id')
                    ->required(),
                TextInput::make('external_folder_id'),
                TextInput::make('name')
                    ->required(),
                TextInput::make('code'),
                TextInput::make('article'),
                Textarea::make('description')
                    ->columnSpanFull(),
                TextInput::make('retail_price')
                    ->numeric()
                    ->prefix('$'),
                TextInput::make('b2b_price')
                    ->numeric()
                    ->prefix('$'),
                TextInput::make('stock')
                    ->required()
                    ->numeric()
                    ->default(0),
                TextInput::make('uom'),
                Toggle::make('is_active')
                    ->required(),
                DateTimePicker::make('synced_at'),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('name')
            ->columns([
                TextColumn::make('external_id')
                    ->searchable(),
                TextColumn::make('external_folder_id')
                    ->searchable(),
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
                TextColumn::make('stock')
                    ->numeric()
                    ->sortable(),
                TextColumn::make('uom')
                    ->searchable(),
                ImageColumn::make('images')
                    ->getStateUsing(fn (Product $record): array => $record
                        ->getMedia(Product::IMAGE_COLLECTION)
                        ->map(fn ($media): string => $media->getUrl('thumb'))
                        ->all())
                    ->stacked()
                    ->limit(3),
                IconColumn::make('is_active')
                    ->boolean(),
                TextColumn::make('synced_at')
                    ->dateTime()
                    ->sortable(),
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
            ->headerActions([
                CreateAction::make(),
                AttachAction::make(),
            ])
            ->recordActions([
                EditAction::make(),
                DetachAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DetachBulkAction::make(),
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
