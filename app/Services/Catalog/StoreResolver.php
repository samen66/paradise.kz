<?php

declare(strict_types=1);

namespace App\Services\Catalog;

use App\Models\Store;
use App\Models\User;

/**
 * Resolves which warehouse (store) catalog browsing should annotate stock
 * for. Never blocks browsing: falls back through the client's own preference
 * down to "any active store", and finally null if none exist.
 */
class StoreResolver
{
    /**
     * $user is null for anonymous (guest/B2C) storefront visitors, who have no
     * preferred warehouse to fall back to.
     */
    public function resolve(?User $user, ?int $requestedId): ?Store
    {
        if ($requestedId !== null) {
            $requested = Store::query()->where('is_active', true)->find($requestedId);

            if ($requested !== null) {
                return $requested;
            }
        }

        if ($user?->preferred_store_id !== null) {
            $preferred = Store::query()->where('is_active', true)->find($user->preferred_store_id);

            if ($preferred !== null) {
                return $preferred;
            }
        }

        return Store::query()->where('is_active', true)->orderByDesc('is_default')->orderBy('name')->first();
    }
}
