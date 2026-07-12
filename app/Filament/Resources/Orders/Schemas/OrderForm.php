<?php

namespace App\Filament\Resources\Orders\Schemas;

use App\Models\Order;
use Filament\Forms\Components\DateTimePicker;
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
                Select::make('user_id')
                    ->relationship('user', 'name')
                    ->required(),
                Select::make('store_id')
                    ->label('Склад')
                    ->relationship('store', 'name')
                    ->required(),
                TextInput::make('status')
                    ->required()
                    ->default('pending'),
                TextInput::make('total')
                    ->required()
                    ->numeric(),
                Textarea::make('comment')
                    ->columnSpanFull(),
                TextInput::make('external_order_id'),
                TextInput::make('external_number'),
                Textarea::make('error')
                    ->columnSpanFull(),
                DateTimePicker::make('pushed_at'),

                Select::make('delivery_method')
                    ->label('Способ получения')
                    ->options([
                        Order::DELIVERY_PICKUP => 'Самовывоз',
                        Order::DELIVERY_DELIVERY => 'Доставка',
                    ])
                    ->default(Order::DELIVERY_PICKUP)
                    ->required()
                    ->live(),
                TextInput::make('delivery_cost')
                    ->label('Стоимость доставки (тиын)')
                    ->numeric()
                    ->default(0)
                    ->required(),
                TextInput::make('delivery_city')
                    ->label('Город')
                    ->visible(fn (callable $get): bool => $get('delivery_method') === Order::DELIVERY_DELIVERY),
                TextInput::make('delivery_street')
                    ->label('Улица')
                    ->visible(fn (callable $get): bool => $get('delivery_method') === Order::DELIVERY_DELIVERY),
                TextInput::make('delivery_building')
                    ->label('Дом')
                    ->visible(fn (callable $get): bool => $get('delivery_method') === Order::DELIVERY_DELIVERY),
                TextInput::make('delivery_apartment')
                    ->label('Кв./офис')
                    ->visible(fn (callable $get): bool => $get('delivery_method') === Order::DELIVERY_DELIVERY),
                TextInput::make('delivery_comment')
                    ->label('Комментарий к доставке')
                    ->visible(fn (callable $get): bool => $get('delivery_method') === Order::DELIVERY_DELIVERY)
                    ->columnSpanFull(),
            ]);
    }
}
