<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A collection doubles as a "style" on the B2B home page (cover photo +
     * description). Where it shows is chosen per surface; existing
     * collections keep showing on the storefront only.
     */
    public function up(): void
    {
        Schema::table('product_collections', function (Blueprint $table) {
            $table->json('description')->nullable()->after('slug');
            $table->boolean('show_on_storefront')->default(true)->after('is_active');
            $table->boolean('show_on_b2b_home')->default(false)->after('show_on_storefront');
        });
    }

    public function down(): void
    {
        Schema::table('product_collections', function (Blueprint $table) {
            $table->dropColumn(['description', 'show_on_storefront', 'show_on_b2b_home']);
        });
    }
};
