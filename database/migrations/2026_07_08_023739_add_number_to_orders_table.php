<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Human-friendly public order number (P-100001, ...) shown to customers and
 * used for guest order tracking. Backfilled for existing orders from the id.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('number')->nullable()->unique()->after('id');
        });

        // Portable across MySQL and SQLite ('||' is not MySQL concat).
        foreach (DB::table('orders')->whereNull('number')->pluck('id') as $id) {
            DB::table('orders')->where('id', $id)->update(['number' => 'P-'.(100000 + $id)]);
        }
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn('number');
        });
    }
};
