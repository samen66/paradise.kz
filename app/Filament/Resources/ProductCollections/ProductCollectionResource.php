<?php

namespace App\Filament\Resources\ProductCollections;

use App\Filament\Resources\ProductCollections\Pages\CreateProductCollection;
use App\Filament\Resources\ProductCollections\Pages\EditProductCollection;
use App\Filament\Resources\ProductCollections\Pages\ListProductCollections;
use App\Filament\Resources\ProductCollections\RelationManagers\ProductsRelationManager;
use App\Filament\Resources\ProductCollections\Schemas\ProductCollectionForm;
use App\Filament\Resources\ProductCollections\Tables\ProductCollectionsTable;
use App\Models\ProductCollection;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use LaraZeus\SpatieTranslatable\Resources\Concerns\Translatable;

class ProductCollectionResource extends Resource
{
    use Translatable;

    protected static ?string $model = ProductCollection::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedSquares2x2;

    protected static ?string $navigationLabel = 'Подборки товаров';

    protected static ?string $modelLabel = 'Подборка';

    protected static ?string $pluralModelLabel = 'Подборки товаров';

    public static function getNavigationGroup(): ?string
    {
        return 'Витрина';
    }

    public static function form(Schema $schema): Schema
    {
        return ProductCollectionForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return ProductCollectionsTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            ProductsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListProductCollections::route('/'),
            'create' => CreateProductCollection::route('/create'),
            'edit' => EditProductCollection::route('/{record}/edit'),
        ];
    }
}
