<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin\Concerns;

use App\Models\User;
use App\Services\Catalog\StoreResolver;
use Illuminate\Validation\ValidationException;

/**
 * Склад нового документа: переданный, иначе предпочтительный склад
 * менеджера → склад по умолчанию → первый активный по названию
 * ({@see StoreResolver}).
 */
trait DefaultsDocumentStore
{
    protected function documentStoreId(?int $requested, User $user): int
    {
        if ($requested !== null) {
            return $requested;
        }

        return app(StoreResolver::class)->resolve($user, null)?->id
            ?? throw ValidationException::withMessages(['store_id' => 'Нет активного места хранения.']);
    }
}
