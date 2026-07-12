<?php

namespace App\Filament\Resources\GoodsReceipts\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class GoodsReceiptForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('supplier_id')
                    ->label('Поставщик')
                    ->relationship('supplier', 'name')
                    ->searchable()
                    ->preload(),
                Select::make('store_id')
                    ->label('Склад')
                    ->relationship('store', 'name')
                    ->required()
                    ->preload(),
                TextInput::make('number')
                    ->label('Номер')
                    ->maxLength(255),
                DateTimePicker::make('received_at')
                    ->label('Дата приёмки')
                    ->default(now()),
                Textarea::make('note')
                    ->label('Комментарий')
                    ->columnSpanFull(),
            ]);
    }
}
