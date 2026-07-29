<?php

namespace App\Filament\Resources\ProductShorts\Pages;

use App\Filament\Resources\ProductShorts\ProductShortResource;
use Filament\Resources\Pages\CreateRecord;

class CreateProductShort extends CreateRecord
{
    protected static string $resource = ProductShortResource::class;
}
