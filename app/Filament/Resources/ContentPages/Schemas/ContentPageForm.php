<?php

namespace App\Filament\Resources\ContentPages\Schemas;

use App\Models\Page;
use Filament\Forms\Components\RichEditor;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Illuminate\Support\Str;

class ContentPageForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('title')
                    ->label('Заголовок')
                    ->required()
                    ->live(onBlur: true)
                    ->afterStateUpdated(function (string $context, $state, callable $set): void {
                        if ($context === 'create') {
                            $set('slug', Str::slug($state));
                        }
                    }),
                TextInput::make('slug')
                    ->label('Слаг (URL)')
                    ->required()
                    ->unique(Page::class, 'slug', ignoreRecord: true)
                    ->helperText('Адрес страницы на сайте: /pages/<слаг>'),
                RichEditor::make('body')
                    ->label('Содержимое')
                    ->columnSpanFull(),
                TextInput::make('seo_title')
                    ->label('SEO: заголовок (title)'),
                Textarea::make('seo_description')
                    ->label('SEO: описание (meta description)')
                    ->rows(2),
                Toggle::make('is_active')
                    ->label('Опубликована')
                    ->default(true),
            ]);
    }
}
