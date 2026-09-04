<?php

namespace App\Filament\Resources\Orders\Tables;

use App\Models\Order;
use App\Models\User;
use App\Services\Orders\OrderCancellationService;
use Filament\Actions\Action;
use Filament\Actions\ViewAction;
use Filament\Notifications\Notification;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class OrdersTable
{
    /** @var array<string, string> */
    /**
     * Labels for every status that can appear in the database — the two legacy
     * ones included, so historical orders still render a human name.
     */
    private const STATUS_LABELS = [
        'pending' => 'В обработке',
        'confirmed' => 'Подтверждён',
        'in_delivery' => 'В доставке',
        'completed' => 'Выполнен',
        'cancelled' => 'Отменён',
        'synced' => 'Отправлен в систему (архив)',
        'failed' => 'Ошибка отправки (архив)',
    ];

    /**
     * The subset a manager may actually assign. Legacy statuses are readable
     * but not selectable — see {@see Order::CLIENT_STATUSES}.
     *
     * @return array<string, string>
     */
    private static function assignableStatuses(): array
    {
        return array_intersect_key(
            self::STATUS_LABELS,
            array_flip(Order::CLIENT_STATUSES),
        );
    }

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
                Action::make('changeStatus')
                    ->label('Изменить статус')
                    ->icon('heroicon-o-arrow-path-rounded-square')
                    ->form([
                        \Filament\Forms\Components\Select::make('status')
                            ->label('Новый статус')
                            ->options(self::assignableStatuses())
                            ->required(),
                    ])
                    ->action(function (Order $record, array $data): void {
                        // Cancelling puts the goods back on the shelf, so it
                        // goes through the service rather than a status write.
                        if ($data['status'] === Order::STATUS_CANCELLED) {
                            app(OrderCancellationService::class)->cancel($record, auth()->user());
                        } else {
                            $record->update(['status' => $data['status']]);
                        }

                        Notification::make()
                            ->title("Статус изменён на «" . (self::STATUS_LABELS[$data['status']] ?? $data['status']) . "»")
                            ->success()
                            ->send();
                    }),
            ]);
    }
}
