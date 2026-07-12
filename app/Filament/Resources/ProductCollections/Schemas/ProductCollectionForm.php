<?php

namespace App\Filament\Resources\ProductCollections\Schemas;

use App\Models\ProductCollection;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Illuminate\Support\Str;

class ProductCollectionForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('title')
                    ->label('Название')
                    ->required()
                    ->live(onBlur: true)
                    ->afterStateUpdated(function (string $context, $state, callable $set): void {
                        if ($context === 'create') {
                            $set('slug', Str::slug($state));
                        }
                    }),
                TextInput::make('slug')
                    ->label('Слаг')
                    ->required()
                    ->unique(ProductCollection::class, 'slug', ignoreRecord: true),
                TextInput::make('sort_order')
                    ->label('Порядок на главной')
                    ->numeric()
                    ->default(0),
                Toggle::make('is_active')
                    ->label('Показывать на главной')
                    ->default(true),
            ]);
    }
}
