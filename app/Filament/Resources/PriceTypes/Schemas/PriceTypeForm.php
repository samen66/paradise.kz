<?php

namespace App\Filament\Resources\PriceTypes\Schemas;

use App\Models\PriceType;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class PriceTypeForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name')
                    ->label('Название')
                    ->required(),
                TextInput::make('code')
                    ->label('Код')
                    ->helperText('Стабильный идентификатор. "b2b" и "retail" используются PricingService напрямую.')
                    ->required()
                    ->unique(PriceType::class, 'code', ignoreRecord: true),
                TextInput::make('sort_order')
                    ->label('Порядок сортировки')
                    ->numeric()
                    ->default(0)
                    ->required(),
            ]);
    }
}
