<?php

namespace App\Filament\Resources\Products\RelationManagers;

use App\Models\Attribute;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\CreateAction;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use LaraZeus\SpatieTranslatable\Actions\LocaleSwitcher;
use LaraZeus\SpatieTranslatable\Resources\RelationManagers\Concerns\Translatable;

class AttributeValuesRelationManager extends RelationManager
{
    use Translatable;

    protected static string $relationship = 'attributeValues';

    protected static ?string $title = 'Характеристики';

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('attribute_id')
                    ->label('Атрибут')
                    ->relationship('attribute', 'name')
                    ->getOptionLabelFromRecordUsing(fn (Attribute $record): string => $record->getTranslation('name', 'ru'))
                    ->searchable()
                    ->preload()
                    ->required(),
                TextInput::make('value')
                    ->label('Значение')
                    ->required(),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->recordTitleAttribute('value')
            ->columns([
                TextColumn::make('attribute.name')->label('Атрибут')->searchable(),
                TextColumn::make('value')->label('Значение')->searchable(),
            ])
            ->filters([])
            ->headerActions([
                LocaleSwitcher::make(),
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
