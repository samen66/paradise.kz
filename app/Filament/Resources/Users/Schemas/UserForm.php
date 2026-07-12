<?php

namespace App\Filament\Resources\Users\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class UserForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name')
                    ->required(),
                TextInput::make('email')
                    ->label('Email address')
                    ->email(),
                DateTimePicker::make('email_verified_at'),
                TextInput::make('password')
                    ->password()
                    ->required(),
                TextInput::make('phone')
                    ->tel()
                    ->unique(ignoreRecord: true),
                TextInput::make('company_name'),
                TextInput::make('company_bin'),
                Toggle::make('is_approved')
                    ->required(),
                TextInput::make('discount_percent')
                    ->required()
                    ->numeric()
                    ->default(0),
                TextInput::make('external_counterparty_id'),
                Select::make('preferred_store_id')
                    ->label('Предпочитаемый склад')
                    ->relationship('preferredStore', 'name'),
            ]);
    }
}
