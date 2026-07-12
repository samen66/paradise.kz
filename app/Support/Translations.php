<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Helpers for spatie/laravel-translatable JSON columns in code paths that
 * bypass Eloquent models (bulk upserts in the ERP sync jobs). The ERP only
 * ever supplies ru content, so a sync must merge into the ru key and leave
 * admin-authored kk translations untouched.
 */
final class Translations
{
    /**
     * Merge a ru value into an existing translations JSON string without
     * touching other locales. Returns the JSON to store, or null when no
     * translation remains.
     */
    public static function mergeRu(?string $existingJson, ?string $value): ?string
    {
        $translations = [];

        if ($existingJson !== null) {
            $decoded = json_decode($existingJson, true);

            if (is_array($decoded)) {
                $translations = $decoded;
            }
        }

        if ($value === null) {
            unset($translations['ru']);
        } else {
            $translations['ru'] = $value;
        }

        if ($translations === []) {
            return null;
        }

        return json_encode($translations, JSON_UNESCAPED_UNICODE);
    }
}
