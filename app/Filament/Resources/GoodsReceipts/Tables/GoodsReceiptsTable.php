<?php

namespace App\Filament\Resources\GoodsReceipts\Tables;

use App\Filament\Resources\GoodsReceipts\GoodsReceiptResource;
use App\Models\GoodsReceipt;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class GoodsReceiptsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('number')->label('Номер')->searchable()->placeholder('—'),
                TextColumn::make('supplier.name')->label('Поставщик')->searchable()->placeholder('—'),
                TextColumn::make('store.name')->label('Склад')->sortable(),
                TextColumn::make('status')
                    ->label('Статус')
                    ->badge()
                    ->color(fn (string $state): string => $state === GoodsReceipt::STATUS_POSTED ? 'success' : 'gray')
                    ->formatStateUsing(fn (string $state): string => $state === GoodsReceipt::STATUS_POSTED ? 'Проведена' : 'Черновик'),
                TextColumn::make('received_at')->label('Дата приёмки')->dateTime()->sortable(),
                TextColumn::make('created_at')->label('Создана')->dateTime()->sortable()->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([])
            ->recordActions([
                GoodsReceiptResource::postAction(),
                EditAction::make(),
            ]);
    }
}
