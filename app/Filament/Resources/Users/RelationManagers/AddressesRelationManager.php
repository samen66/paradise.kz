<?php

namespace App\Filament\Resources\Users\RelationManagers;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\CreateAction;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class AddressesRelationManager extends RelationManager
{
    protected static string $relationship = 'addresses';

    protected static ?string $title = 'Адреса доставки';

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('city')
                    ->label('Город')
                    ->required()
                    ->maxLength(255),
                TextInput::make('street')
                    ->label('Улица')
                    ->required()
                    ->maxLength(255),
                TextInput::make('building')
                    ->label('Дом')
                    ->required()
                    ->maxLength(50),
                TextInput::make('apartment')
                    ->label('Кв./офис')
                    ->maxLength(50),
                TextInput::make('comment')
                    ->label('Комментарий')
                    ->maxLength(500)
                    ->columnSpanFull(),
                Toggle::make('is_default')
                    ->label('По умолчанию'),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('city')
            ->columns([
                TextColumn::make('city')->label('Город')->searchable(),
                TextColumn::make('street')->label('Улица')->searchable(),
                TextColumn::make('building')->label('Дом'),
                TextColumn::make('apartment')->label('Кв./офис')->placeholder('—'),
                IconColumn::make('is_default')->label('По умолчанию')->boolean(),
            ])
            ->filters([])
            ->headerActions([
                CreateAction::make(),
            ])
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
