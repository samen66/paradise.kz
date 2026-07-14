<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('b2b_min_order_qty')->nullable()->after('b2b_price')
                ->comment('Per-product B2B minimum order qty. null = use global default.');
        });

        Schema::table('catalog_settings', function (Blueprint $table) {
            $table->unsignedInteger('b2b_default_min_order_qty')->default(1)->after('show_stock_quantity');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('b2b_min_order_qty');
        });

        Schema::table('catalog_settings', function (Blueprint $table) {
            $table->dropColumn('b2b_default_min_order_qty');
        });
    }
};
