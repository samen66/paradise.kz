<?php

namespace App\Filament\Resources\Orders\Tables;

use App\Jobs\Erp\PushOrderJob;
use App\Models\Order;
use App\Models\User;
use Filament\Actions\Action;
use Filament\Actions\ViewAction;
use Filament\Notifications\Notification;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class OrdersTable
{
    /** @var array<string, string> */
    private const STATUS_LABELS = [
        'pending' => 'В обработке',
        'confirmed' => 'Подтверждён',
        'in_delivery' => 'В доставке',
        'completed' => 'Выполнен',
        'cancelled' => 'Отменён',
        'synced' => 'Отправлен в систему',
        'failed' => 'Ошибка',
    ];

    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('number')
                    ->label('№')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('user.company_name')
                    ->label('Клиент')
                    ->getStateUsing(fn (Order $record): ?string => $record->user?->company_name ?? $record->user?->name)
                    ->searchable(['company_name', 'name']),
                TextColumn::make('user.type')
                    ->label('Тип')
                    ->badge()
                    ->color(fn (?string $state): string => $state === User::TYPE_RETAIL ? 'gray' : 'info')
                    ->formatStateUsing(fn (?string $state): string => $state === User::TYPE_RETAIL ? 'Розница' : 'B2B'),
                TextColumn::make('store.name')
                    ->label('Склад')
                    ->placeholder('—'),
                TextColumn::make('delivery_method')
                    ->label('Получение')
                    ->badge()
                    ->color(fn (string $state): string => $state === Order::DELIVERY_DELIVERY ? 'info' : 'gray')
                    ->formatStateUsing(fn (string $state): string => $state === Order::DELIVERY_DELIVERY ? 'Доставка' : 'Самовывоз'),
                TextColumn::make('status')
                    ->label('Статус')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => self::STATUS_LABELS[$state] ?? $state)
                    ->color(fn (string $state): string => match ($state) {
                        'confirmed' => 'info',
                        'in_delivery' => 'info',
                        'completed' => 'success',
                        'synced' => 'success',
                        'cancelled' => 'gray',
                        'failed' => 'danger',
                        default => 'warning',
                    }),
                TextColumn::make('payment_method')
                    ->label('Оплата')
                    ->formatStateUsing(fn (?string $state): string => match ($state) {
                        'kaspi' => 'Kaspi Pay',
                        'card' => 'Карта',
                        'cash' => 'Наличными',
                        default => 'Не выбран',
                    }),
                TextColumn::make('payment_status')
                    ->label('Статус оплаты')
                    ->badge()
                    ->formatStateUsing(fn (?string $state): string => match ($state) {
                        'paid' => 'Оплачен',
                        'unpaid' => 'Не оплачен',
                        'cancelled' => 'Отменён',
                        'failed' => 'Ошибка',
                        default => $state ?? '—',
                    })
                    ->color(fn (?string $state): string => match ($state) {
                        'paid' => 'success',
                        'unpaid' => 'warning',
                        'cancelled', 'failed' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('total')
                    ->label('Сумма')
                    ->formatStateUsing(fn (int $state): string => number_format($state / 100, 0, '.', ' ').' ₸')
                    ->sortable(),
                TextColumn::make('source')
                    ->label('Источник')
                    ->badge()
                    ->placeholder('—')
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('external_number')
                    ->label('№ во внешней системе')
                    ->placeholder('—'),
                TextColumn::make('created_at')
                    ->label('Создан')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->label('Статус')
                    ->options(self::STATUS_LABELS),
            ])
            ->recordActions([
                ViewAction::make(),
                Action::make('retry')
                    ->label('Повторить отправку')
                    ->icon('heroicon-o-arrow-path')
                    ->color('warning')
                    ->visible(fn (Order $record): bool => $record->status !== 'synced')
                    ->requiresConfirmation()
                    ->action(function (Order $record): void {
                        PushOrderJob::dispatch($record);

                        Notification::make()
                            ->title('Заказ поставлен в очередь на отправку в учётную систему')
                            ->success()
                            ->send();
                    }),
                Action::make('changeStatus')
                    ->label('Изменить статус')
                    ->icon('heroicon-o-arrow-path-rounded-square')
                    ->form([
                        \Filament\Forms\Components\Select::make('status')
                            ->label('Новый статус')
                            ->options(self::STATUS_LABELS)
                            ->required(),
                    ])
                    ->action(function (Order $record, array $data): void {
                        $record->update(['status' => $data['status']]);

                        Notification::make()
                            ->title("Статус изменён на «" . (self::STATUS_LABELS[$data['status']] ?? $data['status']) . "»")
                            ->success()
                            ->send();
                    }),
            ]);
    }
}
