<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Marks the throwaway User rows created per guest checkout, so "the canonical
 * retail account for a phone number" is queryable without string-matching the
 * synthetic guest email. Existing guest rows are backfilled by their email
 * pattern.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('is_guest')->default(false)->after('is_approved');
        });

        DB::table('users')
            ->where('email', 'like', 'guest-%@guest.paradise.kz')
            ->update(['is_guest' => true]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('is_guest');
        });
    }
};
