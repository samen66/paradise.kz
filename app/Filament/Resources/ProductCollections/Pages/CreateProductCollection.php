<?php

namespace App\Filament\Resources\ProductCollections\Pages;

use App\Filament\Resources\ProductCollections\ProductCollectionResource;
use Filament\Resources\Pages\CreateRecord;
use LaraZeus\SpatieTranslatable\Actions\LocaleSwitcher;
use LaraZeus\SpatieTranslatable\Resources\Pages\CreateRecord\Concerns\Translatable;

class CreateProductCollection extends CreateRecord
{
    use Translatable;

    protected static string $resource = ProductCollectionResource::class;

    protected function getHeaderActions(): array
    {
        return [
            LocaleSwitcher::make(),
        ];
    }
}
