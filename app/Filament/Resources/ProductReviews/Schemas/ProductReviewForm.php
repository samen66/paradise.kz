<?php

namespace App\Filament\Resources\ProductReviews\Schemas;

use Filament\Schemas\Schema;

class ProductReviewForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                \Filament\Forms\Components\Select::make('product_id')
                    ->relationship('product', 'name')
                    ->required(),
                \Filament\Forms\Components\TextInput::make('name')
                    ->required(),
                \Filament\Forms\Components\TextInput::make('rating')
                    ->numeric()
                    ->required()
                    ->minValue(1)
                    ->maxValue(5),
                \Filament\Forms\Components\Textarea::make('comment'),
                \Filament\Forms\Components\Toggle::make('is_approved')
                    ->default(false),
            ]);
    }
}
