<?php

namespace App\Filament\Resources\ProductShorts\Pages;

use App\Filament\Resources\ProductShorts\ProductShortResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditProductShort extends EditRecord
{
    protected static string $resource = ProductShortResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
