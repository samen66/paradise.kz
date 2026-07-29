<?php

namespace App\Filament\Resources\ProductShorts;

use App\Filament\Resources\ProductShorts\Pages\CreateProductShort;
use App\Filament\Resources\ProductShorts\Pages\EditProductShort;
use App\Filament\Resources\ProductShorts\Pages\ListProductShorts;
use App\Filament\Resources\ProductShorts\Schemas\ProductShortForm;
use App\Filament\Resources\ProductShorts\Tables\ProductShortsTable;
use App\Models\ProductShort;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class ProductShortResource extends Resource
{
    protected static ?string $model = ProductShort::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    public static function form(Schema $schema): Schema
    {
        return ProductShortForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return ProductShortsTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListProductShorts::route('/'),
            'create' => CreateProductShort::route('/create'),
            'edit' => EditProductShort::route('/{record}/edit'),
        ];
    }
}
