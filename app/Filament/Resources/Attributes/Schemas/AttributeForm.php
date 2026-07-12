<?php

namespace App\Filament\Resources\Attributes\Schemas;

use App\Models\Attribute;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Illuminate\Support\Str;

class AttributeForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name')
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
                    ->unique(Attribute::class, 'slug', ignoreRecord: true),
                Toggle::make('is_filterable')
                    ->label('Фильтр в каталоге')
                    ->helperText('Показывать как фасетный фильтр в каталоге.')
                    ->default(false),
            ]);
    }
}
