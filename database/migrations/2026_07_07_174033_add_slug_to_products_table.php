<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SEO-friendly product URLs for the B2C storefront (`divan-atlanta-1042`).
 * Nullable: slugs are generated from the ru name on save and backfilled by
 * `catalog:generate-product-slugs` for pre-existing rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->string('slug')->nullable()->unique()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn('slug');
        });
    }
};
