<?php

namespace App\Filament\Resources\Products\RelationManagers;

use App\Models\ProductVariant;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\KeyValue;
use Filament\Forms\Components\TagsInput;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

/**
 * Product variants / modifications mirrored from the ERP. Read-oriented: rows
 * originate from the variant sync, so there is no create/associate action.
 */
class VariantsRelationManager extends RelationManager
{
    protected static string $relationship = 'variants';

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('external_id')
                    ->required(),
                TextInput::make('name')
                    ->required(),
                TextInput::make('code'),
                TextInput::make('retail_price')
                    ->helperText('In kopecks (minor units).')
                    ->numeric(),
                TextInput::make('b2b_price')
                    ->helperText('In kopecks (minor units).')
                    ->numeric(),
                TextInput::make('stock')
                    ->numeric(),
                TagsInput::make('barcodes')
                    ->columnSpanFull(),
                KeyValue::make('characteristics')
                    ->keyLabel('Name')
                    ->valueLabel('Value')
                    ->columnSpanFull(),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('name')
            ->columns([
                TextColumn::make('name')
                    ->searchable(),
                TextColumn::make('code')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('b2b_price')
                    ->money()
                    ->sortable(),
                TextColumn::make('stock')
                    ->numeric()
                    ->sortable(),
                TextColumn::make('barcodes')
                    ->label('Barcodes')
                    ->getStateUsing(fn (ProductVariant $record): int => count($record->barcodes ?? []))
                    ->badge(),
                TextColumn::make('synced_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
