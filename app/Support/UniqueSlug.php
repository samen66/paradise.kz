<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * A free `slug` for a new catalog row, made from its ru name: «Размер» →
 * razmer, then razmer-2, razmer-3… while taken. A name with nothing to
 * transliterate («!!!») gets $fallback. The base is capped so the suffix
 * still fits a varchar(255).
 */
final class UniqueSlug
{
    private const MAX_BASE = 240;

    public static function make(string $table, string $name, string $fallback): string
    {
        $base = trim(Str::limit(Str::slug($name), self::MAX_BASE, ''), '-');
        $base = $base === '' ? $fallback : $base;
        $slug = $base;

        for ($suffix = 2; DB::table($table)->where('slug', $slug)->exists(); $suffix++) {
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }
}
