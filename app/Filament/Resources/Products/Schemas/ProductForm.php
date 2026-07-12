<?php

namespace App\Filament\Resources\Products\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\KeyValue;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TagsInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class ProductForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('source')
                    ->helperText('ERP provider this row was mirrored from.')
                    ->required(),
                TextInput::make('external_id')
                    ->required(),
                TextInput::make('external_folder_id'),
                Select::make('category_id')
                    ->label('Категория')
                    ->relationship('category', 'name')
                    ->searchable()
                    ->preload(),
                Select::make('brand_id')
                    ->label('Бренд')
                    ->relationship('brand', 'name')
                    ->searchable()
                    ->preload(),
                TextInput::make('name')
                    ->required(),
                TextInput::make('code'),
                TextInput::make('article'),
                Textarea::make('description')
                    ->columnSpanFull(),
                TextInput::make('retail_price')
                    ->helperText('In kopecks. ERP-mirrored fallback, used only when no "Цены" entry exists for this product.')
                    ->numeric(),
                TextInput::make('b2b_price')
                    ->helperText('In kopecks. ERP-mirrored fallback, used only when no "Цены" entry exists for this product.')
                    ->numeric(),
                TextInput::make('purchase_price')
                    ->helperText('In kopecks (minor units).')
                    ->numeric(),
                TextInput::make('min_price')
                    ->helperText('In kopecks (minor units).')
                    ->numeric(),
                TextInput::make('stock')
                    ->required()
                    ->numeric()
                    ->default(0),
                TextInput::make('uom'),
                TextInput::make('weight')
                    ->numeric(),
                TextInput::make('volume')
                    ->numeric(),
                TextInput::make('country'),
                TextInput::make('supplier'),
                TagsInput::make('barcodes')
                    ->helperText('Mirrored ERP barcodes.')
                    ->columnSpanFull(),
                KeyValue::make('attributes')
                    ->label('Attributes / characteristics')
                    ->keyLabel('Name')
                    ->valueLabel('Value')
                    ->columnSpanFull(),
                Toggle::make('is_active')
                    ->helperText('Local-only flag: hide this product from all B2B clients.')
                    ->required(),
                DateTimePicker::make('synced_at'),
            ]);
    }
}
