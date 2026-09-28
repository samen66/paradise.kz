<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Helpers for spatie/laravel-translatable JSON columns.
 */
final class Translations
{
    /**
     * Merge a ru value into an existing translations JSON string without
     * touching other locales. Returns the JSON to store, or null when no
     * translation remains.
     *
     * Used in code paths that bypass Eloquent models (bulk upserts in the ERP
     * sync jobs). The ERP only ever supplies ru content, so a sync must merge
     * into the ru key and leave admin-authored kk translations untouched.
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

    /**
     * Drops blank locales, so a cleared kk is not stored as "" and the
     * storefront falls back to ru instead of showing an empty string.
     *
     * @param  array<string, string|null>  $translations
     * @return array<string, string>
     */
    public static function filled(array $translations): array
    {
        return array_filter(
            array_map(fn (?string $text): string => trim((string) $text), $translations),
            fn (string $text): bool => $text !== '',
        );
    }

    /**
     * The $locale text of a raw translations JSON string (a column read past
     * Eloquent), falling back to ru when that locale is missing or blank.
     */
    public static function pick(?string $json, string $locale): string
    {
        $translations = json_decode((string) $json, true);

        if (! is_array($translations)) {
            return (string) $json;
        }

        $text = trim((string) ($translations[$locale] ?? ''));

        return $text !== '' ? $text : (string) ($translations['ru'] ?? '');
    }
}
