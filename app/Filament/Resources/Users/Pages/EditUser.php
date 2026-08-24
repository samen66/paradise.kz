<?php

namespace App\Filament\Resources\Users\Pages;

use App\Actions\ApproveClient;
use App\Filament\Resources\Users\UserResource;
use App\Models\User;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;
use Throwable;

class EditUser extends EditRecord
{
    protected static string $resource = UserResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('approve')
                ->label('Одобрить')
                ->icon('heroicon-o-check-badge')
                ->color('success')
                ->visible(fn (User $record): bool => ! $record->is_approved && $record->hasRole('b2b_customer'))
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
                        Notification::make()
                            ->title('Не удалось одобрить клиента')
                            ->body($e->getMessage())
                            ->danger()
                            ->send();
                    }
                }),
            DeleteAction::make(),
        ];
    }
}
