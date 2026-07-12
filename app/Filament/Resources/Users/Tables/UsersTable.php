<?php

namespace App\Filament\Resources\Users\Tables;

use App\Actions\ApproveClient;
use App\Models\User;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Notifications\Notification;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Throwable;

class UsersTable
{
    public static function configure(Table $table): Table
    {
        return $table
            // Only B2B resellers are managed here (not staff accounts).
            ->modifyQueryUsing(fn (Builder $query) => $query->role('b2b_customer'))
            ->columns([
                TextColumn::make('company_name')
                    ->label('Компания')
                    ->searchable(),
                TextColumn::make('company_bin')
                    ->label('БИН')
                    ->searchable(),
                TextColumn::make('email')
                    ->label('Email')
                    ->searchable(),
                TextColumn::make('phone')
                    ->label('Телефон')
                    ->searchable(),
                IconColumn::make('is_approved')
                    ->label('Одобрен')
                    ->boolean(),
                TextColumn::make('discount_percent')
                    ->label('Скидка, %')
                    ->numeric()
                    ->sortable(),
                TextColumn::make('external_counterparty_id')
                    ->label('Контрагент МойСклад')
                    ->placeholder('—')
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->label('Регистрация')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                TernaryFilter::make('is_approved')
                    ->label('Статус одобрения')
                    ->placeholder('Все')
                    ->trueLabel('Одобренные')
                    ->falseLabel('Ожидают'),
            ])
            ->recordActions([
                Action::make('approve')
                    ->label('Одобрить')
                    ->icon('heroicon-o-check-badge')
                    ->color('success')
                    ->visible(fn (User $record): bool => ! $record->is_approved)
                    ->requiresConfirmation()
                    ->modalHeading('Одобрить клиента')
                    ->modalDescription('Будет создан контрагент в МойСклад, и клиент получит доступ к каталогу.')
                    ->action(function (User $record): void {
                        try {
                            app(ApproveClient::class)->handle($record);

                            Notification::make()
                                ->title('Клиент одобрен')
                                ->success()
                                ->send();
                        } catch (Throwable $e) {
                            // Approval is blocked if the counterparty can't be created.
                            Notification::make()
                                ->title('Не удалось одобрить клиента')
                                ->body($e->getMessage())
                                ->danger()
                                ->send();
                        }
                    }),
                EditAction::make(),
            ]);
    }
}
