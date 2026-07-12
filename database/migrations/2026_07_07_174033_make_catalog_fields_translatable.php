<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Switch catalog display fields to spatie/laravel-translatable JSON columns
 * ({"ru": ..., "kk": ...}). Existing plain-string data is preserved by wrapping
 * it as the `ru` translation. Columns become TEXT (not JSON) so the migration
 * stays portable between MySQL (dev/prod) and SQLite (test suite).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->text('name')->change();
        });
        Schema::table('categories', function (Blueprint $table): void {
            $table->text('name')->change();
        });
        Schema::table('brands', function (Blueprint $table): void {
            $table->text('name')->change();
        });

        DB::table('products')->whereNotNull('name')
            ->update(['name' => DB::raw("json_object('ru', name)")]);
        DB::table('products')->whereNotNull('description')
            ->update(['description' => DB::raw("json_object('ru', description)")]);
        DB::table('categories')->whereNotNull('name')
            ->update(['name' => DB::raw("json_object('ru', name)")]);
        DB::table('brands')->whereNotNull('name')
            ->update(['name' => DB::raw("json_object('ru', name)")]);
    }

    public function down(): void
    {
        // SQLite's json_extract already returns unquoted text; MySQL needs
        // an explicit json_unquote.
        $unwrap = DB::connection()->getDriverName() === 'sqlite'
            ? "json_extract(%s, '$.ru')"
            : "json_unquote(json_extract(%s, '$.ru'))";

        DB::table('products')->whereNotNull('name')
            ->update(['name' => DB::raw(sprintf($unwrap, 'name'))]);
        DB::table('products')->whereNotNull('description')
            ->update(['description' => DB::raw(sprintf($unwrap, 'description'))]);
        DB::table('categories')->whereNotNull('name')
            ->update(['name' => DB::raw(sprintf($unwrap, 'name'))]);
        DB::table('brands')->whereNotNull('name')
            ->update(['name' => DB::raw(sprintf($unwrap, 'name'))]);

        Schema::table('products', function (Blueprint $table): void {
            $table->string('name')->change();
        });
        Schema::table('categories', function (Blueprint $table): void {
            $table->string('name')->change();
        });
        Schema::table('brands', function (Blueprint $table): void {
            $table->string('name')->change();
        });
    }
};
