<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Kazakhstan-centric phone normalization to E.164 (+7XXXXXXXXXX), so the same
 * subscriber always matches regardless of how the number was typed
 * (8 707..., +7 707..., 7071234567). Used by OTP login, guest checkout and
 * guest-order claiming — all phone comparisons must go through here.
 */
final class Phone
{
    public static function normalize(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if ($digits === '') {
            return '';
        }

        // Local formats: 87071234567 → +77071234567, 7071234567 → +77071234567.
        if (strlen($digits) === 11 && str_starts_with($digits, '8')) {
            return '+7'.substr($digits, 1);
        }

        if (strlen($digits) === 10) {
            return '+7'.$digits;
        }

        return '+'.$digits;
    }
}
