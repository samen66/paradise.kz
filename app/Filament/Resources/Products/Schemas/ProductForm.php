<?php

namespace App\Filament\Resources\Products\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\KeyValue;
use Filament\Forms\Components\Section;
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
                Section::make(__('admin.sections.main_info'))
                    ->schema([
                        TextInput::make('name')
                            ->label(__('admin.fields.name'))
                            ->disabled()
                            ->helperText(__('admin.helpers.erp_readonly'))
                            ->required(),
                        Textarea::make('description')
                            ->label(__('admin.fields.description'))
                            ->columnSpanFull(),
                        Grid::make(2)
                            ->schema([
                                Select::make('category_id')
                                    ->label(__('admin.fields.category'))
                                    ->relationship('category', 'name')
                                    ->searchable()
                                    ->preload(),
                                Select::make('brand_id')
                                    ->label(__('admin.fields.brand'))
                                    ->relationship('brand', 'name')
                                    ->searchable()
                                    ->preload(),
                            ]),
                        Toggle::make('is_active')
                            ->label(__('admin.fields.is_active'))
                            ->helperText(__('admin.helpers.is_active'))
                            ->required(),
                    ]),

                Section::make(__('admin.sections.prices_and_stock'))
                    ->schema([
                        Grid::make(3)
                            ->schema([
                                TextInput::make('stock')
                                    ->label(__('admin.fields.stock'))
                                    ->disabled()
                                    ->helperText(__('admin.helpers.erp_readonly'))
                                    ->required()
                                    ->numeric()
                                    ->default(0),
                                TextInput::make('retail_price')
                                    ->label(__('admin.fields.retail_price'))
                                    ->disabled()
                                    ->helperText(__('admin.helpers.erp_readonly') . ' ' . __('admin.helpers.in_kopecks'))
                                    ->numeric(),
                                TextInput::make('b2b_price')
                                    ->label(__('admin.fields.b2b_price'))
                                    ->disabled()
                                    ->helperText(__('admin.helpers.erp_readonly') . ' ' . __('admin.helpers.in_kopecks'))
                                    ->numeric(),
                            ]),
                        Grid::make(3)
                            ->schema([
                                TextInput::make('purchase_price')
                                    ->label(__('admin.fields.purchase_price'))
                                    ->disabled()
                                    ->helperText(__('admin.helpers.erp_readonly') . ' ' . __('admin.helpers.in_kopecks'))
                                    ->numeric(),
                                TextInput::make('min_price')
                                    ->label(__('admin.fields.min_price'))
                                    ->disabled()
                                    ->helperText(__('admin.helpers.erp_readonly') . ' ' . __('admin.helpers.in_kopecks'))
                                    ->numeric(),
                                TextInput::make('b2b_min_order_qty')
                                    ->label(__('admin.fields.b2b_min_order_qty'))
                                    ->helperText(__('admin.helpers.b2b_min_qty'))
                                    ->numeric()
                                    ->minValue(1),
                            ]),
                    ]),

                Section::make(__('admin.sections.dimensions'))
                    ->schema([
                        Grid::make(3)
                            ->schema([
                                TextInput::make('uom')
                                    ->label(__('admin.fields.uom'))
                                    ->disabled(),
                                TextInput::make('weight')
                                    ->label(__('admin.fields.weight'))
                                    ->disabled()
                                    ->numeric(),
                                TextInput::make('volume')
                                    ->label(__('admin.fields.volume'))
                                    ->disabled()
                                    ->numeric(),
                            ]),
                    ])->collapsed(),

                Section::make(__('admin.sections.erp_sync'))
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                TextInput::make('source')
                                    ->label(__('admin.fields.source'))
                                    ->disabled()
                                    ->required(),
                                TextInput::make('external_id')
                                    ->label(__('admin.fields.external_id'))
                                    ->disabled()
                                    ->required(),
                                TextInput::make('external_folder_id')
                                    ->label(__('admin.fields.external_folder_id'))
                                    ->disabled(),
                                TextInput::make('code')
                                    ->label(__('admin.fields.code'))
                                    ->disabled(),
                                TextInput::make('article')
                                    ->label(__('admin.fields.article'))
                                    ->disabled(),
                                TextInput::make('country')
                                    ->label(__('admin.fields.country'))
                                    ->disabled(),
                                TextInput::make('supplier')
                                    ->label(__('admin.fields.supplier'))
                                    ->disabled(),
                                DateTimePicker::make('synced_at')
                                    ->label(__('admin.fields.synced_at'))
                                    ->disabled(),
                            ]),
                        TagsInput::make('barcodes')
                            ->label(__('admin.fields.barcodes'))
                            ->disabled()
                            ->columnSpanFull(),
                        KeyValue::make('attributes')
                            ->label(__('admin.fields.attributes'))
                            ->disabled()
                            ->keyLabel('Name')
                            ->valueLabel('Value')
                            ->columnSpanFull(),
                    ])->collapsed(),
            ]);
    }
}
