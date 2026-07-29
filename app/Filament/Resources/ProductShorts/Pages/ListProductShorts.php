<?php

namespace App\Filament\Resources\ProductShorts\Pages;

use App\Filament\Resources\ProductShorts\ProductShortResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListProductShorts extends ListRecords
{
    protected static string $resource = ProductShortResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
