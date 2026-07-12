<?php

namespace App\Filament\Resources\CatalogGroups\Schemas;

use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class CatalogGroupForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name')
                    ->required(),
            ]);
    }
}
