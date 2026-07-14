<?php

declare(strict_types=1);

namespace App\Filament\Pages;

use App\Models\CatalogSetting;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Components\Actions;
use Filament\Schemas\Components\Form;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;

/**
 * Singular settings page (one row, no list) for catalog-wide toggles shown
 * to B2B clients through the API.
 *
 * @property-read Schema $form
 */
class CatalogSettings extends Page
{
    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCog6Tooth;

    protected static ?string $navigationLabel = 'Настройки каталога';

    protected string $view = 'filament.pages.catalog-settings';

    /**
     * @var array<string, mixed>|null
     */
    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill($this->getRecord()->attributesToArray());
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Form::make([
                    Toggle::make('show_stock_quantity')
                        ->label('Показывать точный остаток B2B-клиентам')
                        ->helperText('Если выключено, клиенты видят только «Есть в наличии» / «Нет в наличии», без точного числа.')
                        ->required(),
                    TextInput::make('b2b_default_min_order_qty')
                        ->label('Минимальное кол-во заказа для B2B (по умолчанию)')
                        ->helperText('Применяется ко всем товарам, у которых не указано своё минимальное кол-во.')
                        ->numeric()
                        ->minValue(1)
                        ->default(1)
                        ->required(),
                    TextInput::make('delivery_price')
                        ->label('Стоимость доставки (тиын)')
                        ->helperText('Фиксированная плата за доставку. Пусто — доставка бесплатна.')
                        ->numeric()
                        ->minValue(0),
                    TextInput::make('free_delivery_from')
                        ->label('Бесплатная доставка от суммы (тиын)')
                        ->helperText('Сумма заказа, при достижении которой доставка бесплатна. Пусто — порога нет.')
                        ->numeric()
                        ->minValue(0),
                    TextInput::make('contact_phone')
                        ->label('Телефон магазина')
                        ->helperText('Показывается в шапке и подвале сайта.')
                        ->tel(),
                    TextInput::make('contact_email')
                        ->label('Email магазина')
                        ->email(),
                    TextInput::make('contact_address')
                        ->label('Адрес (для страницы контактов)'),
                    TextInput::make('whatsapp_url')
                        ->label('Ссылка WhatsApp')
                        ->url(),
                    TextInput::make('instagram_url')
                        ->label('Ссылка Instagram')
                        ->url(),
                ])
                    ->livewireSubmitHandler('save')
                    ->footer([
                        Actions::make([
                            Action::make('save')
                                ->submit('save')
                                ->keyBindings(['mod+s']),
                        ]),
                    ]),
            ])
            ->record($this->getRecord())
            ->statePath('data');
    }

    public function save(): void
    {
        $this->getRecord()->update($this->form->getState());

        Notification::make()
            ->title('Настройки сохранены')
            ->success()
            ->send();
    }

    public function getRecord(): CatalogSetting
    {
        return CatalogSetting::current();
    }
}
