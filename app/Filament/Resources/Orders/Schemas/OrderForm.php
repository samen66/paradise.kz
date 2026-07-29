<?php

namespace App\Filament\Resources\Orders\Schemas;

use App\Models\Order;
use Filament\Forms\Components\DateTimePicker;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class OrderForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make(__('admin.sections.client_and_status'))
                    ->schema([
                        Grid::make(3)
                            ->schema([
                                Select::make('user_id')
                                    ->label(__('admin.fields.user'))
                                    ->relationship('user', 'name')
                                    ->searchable()
                                    ->required(),
                                Select::make('store_id')
                                    ->label(__('admin.fields.store'))
                                    ->relationship('store', 'name')
                                    ->searchable()
                                    ->required(),
                                TextInput::make('status')
                                    ->label(__('admin.fields.status'))
                                    ->required()
                                    ->default('pending'),
                            ]),
                        Grid::make(3)
                            ->schema([
                                TextInput::make('total')
                                    ->label(__('admin.fields.total'))
                                    ->required()
                                    ->numeric(),
                            ]),
                        Textarea::make('comment')
                            ->label(__('admin.fields.comment'))
                            ->columnSpanFull(),
                    ]),

                Section::make(__('admin.sections.delivery'))
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                Select::make('delivery_method')
                                    ->label(__('admin.fields.delivery_method'))
                                    ->options([
                                        Order::DELIVERY_PICKUP => __('admin.fields.delivery_pickup'),
                                        Order::DELIVERY_DELIVERY => __('admin.fields.delivery_delivery'),
                                    ])
                                    ->default(Order::DELIVERY_PICKUP)
                                    ->required()
                                    ->live(),
                                TextInput::make('delivery_cost')
                                    ->label(__('admin.fields.delivery_cost'))
                                    ->numeric()
                                    ->default(0)
                                    ->required(),
                            ]),
                        Grid::make(4)
                            ->schema([
                                TextInput::make('delivery_city')
                                    ->label(__('admin.fields.delivery_city'))
                                    ->visible(fn (callable $get): bool => $get('delivery_method') === Order::DELIVERY_DELIVERY),
                                TextInput::make('delivery_street')
                                    ->label(__('admin.fields.delivery_street'))
                                    ->visible(fn (callable $get): bool => $get('delivery_method') === Order::DELIVERY_DELIVERY),
                                TextInput::make('delivery_building')
                                    ->label(__('admin.fields.delivery_building'))
                                    ->visible(fn (callable $get): bool => $get('delivery_method') === Order::DELIVERY_DELIVERY),
                                TextInput::make('delivery_apartment')
                                    ->label(__('admin.fields.delivery_apartment'))
                                    ->visible(fn (callable $get): bool => $get('delivery_method') === Order::DELIVERY_DELIVERY),
                            ]),
                        Textarea::make('delivery_comment')
                            ->label(__('admin.fields.delivery_comment'))
                            ->visible(fn (callable $get): bool => $get('delivery_method') === Order::DELIVERY_DELIVERY)
                            ->columnSpanFull(),
                    ]),

                Section::make(__('admin.sections.erp_sync'))
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                TextInput::make('external_order_id')
                                    ->label(__('admin.fields.external_order_id'))
                                    ->disabled()
                                    ->helperText(__('admin.helpers.erp_readonly')),
                                TextInput::make('external_number')
                                    ->label(__('admin.fields.external_number'))
                                    ->disabled()
                                    ->helperText(__('admin.helpers.erp_readonly')),
                                DateTimePicker::make('pushed_at')
                                    ->label(__('admin.fields.pushed_at'))
                                    ->disabled()
                                    ->helperText(__('admin.helpers.erp_readonly')),
                            ]),
                    ])->collapsed(),

                Section::make(__('admin.sections.errors_and_logs'))
                    ->schema([
                        Textarea::make('error')
                            ->label(__('admin.fields.error'))
                            ->disabled()
                            ->columnSpanFull(),
                    ])->collapsed(),
            ]);
    }
}
