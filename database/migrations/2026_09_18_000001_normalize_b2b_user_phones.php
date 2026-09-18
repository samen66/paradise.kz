<?php

declare(strict_types=1);

use App\Support\Phone;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * SMS login finds B2B clients by the normalized number (+7XXXXXXXXXX),
     * while the old registration form stored the phone as typed. Rewrite
     * those in place; a number whose normalized form already belongs to
     * another row is left for the manager to resolve.
     */
    public function up(): void
    {
        DB::table('users')
            ->where('type', 'b2b')
            ->whereNotNull('phone')
            ->orderBy('id')
            ->each(function (object $user): void {
                $normalized = Phone::normalize((string) $user->phone);

                if ($normalized === '' || $normalized === $user->phone) {
                    return;
                }

                if (DB::table('users')->where('phone', $normalized)->exists()) {
                    return;
                }

                DB::table('users')->where('id', $user->id)->update(['phone' => $normalized]);
            });
    }

    /**
     * The original spelling is not recoverable, and the normalized one is
     * valid for every code path.
     */
    public function down(): void {}
};
