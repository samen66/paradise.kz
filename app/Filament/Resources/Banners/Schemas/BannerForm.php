<?php

namespace App\Filament\Resources\Banners\Schemas;

use App\Models\Banner;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\SpatieMediaLibraryFileUpload;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class BannerForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('placement')
                    ->label('Размещение')
                    ->options([
                        Banner::PLACEMENT_HOME_HERO => 'Главная — верхний баннер',
                    ])
                    ->default(Banner::PLACEMENT_HOME_HERO)
                    ->required(),
                TextInput::make('title')
                    ->label('Заголовок'),
                TextInput::make('subtitle')
                    ->label('Подзаголовок'),
                TextInput::make('url')
                    ->label('Ссылка')
                    ->helperText('Куда ведёт клик по баннеру, например /catalog/divany'),
                SpatieMediaLibraryFileUpload::make('image')
                    ->label('Изображение')
                    ->collection(Banner::IMAGE_COLLECTION)
                    ->image()
                    ->required(),
                TextInput::make('sort_order')
                    ->label('Порядок')
                    ->numeric()
                    ->default(0),
                Toggle::make('is_active')
                    ->label('Активен')
                    ->default(true),
            ]);
    }
}
