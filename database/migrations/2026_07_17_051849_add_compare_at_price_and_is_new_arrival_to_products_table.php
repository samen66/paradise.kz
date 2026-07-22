<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Admin-set "was" price for the storefront discount badge. Kept in
            // kopecks like the other price columns; independent of the ERP
            // mirror and of PricingService's resolved_price — never touched
            // by the catalog sync.
            $table->unsignedBigInteger('compare_at_price')->nullable()->after('min_price');

            // Local-only "new arrival" flag for the storefront badge — same
            // pattern as is_active, admin-assigned, never touched by sync.
            $table->boolean('is_new_arrival')->default(false)->index()->after('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['compare_at_price', 'is_new_arrival']);
        });
    }
};
