<?php

namespace App\Filament\Resources\Users\Pages;

use App\Filament\Resources\Users\UserResource;
use Filament\Resources\Pages\CreateRecord;

class CreateUser extends CreateRecord
{
    protected static string $resource = UserResource::class;

    /**
     * This resource only ever manages B2B clients (the list is scoped to the
     * `b2b_customer` role in UsersTable), so every record created here must
     * get that role — otherwise it vanishes from the resource's own list.
     */
    protected function afterCreate(): void
    {
        $this->record->assignRole('b2b_customer');
    }
}
