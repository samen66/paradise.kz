<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('catalog_settings', function (Blueprint $table) {
            // In kopecks. Flat delivery fee charged when the order's delivery
            // method is "delivery" (0/pickup is always free).
            $table->unsignedBigInteger('delivery_price')->nullable();

            // In kopecks. Order subtotal at or above this waives delivery_price.
            // Null means "no free-delivery threshold".
            $table->unsignedBigInteger('free_delivery_from')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('catalog_settings', function (Blueprint $table) {
            $table->dropColumn(['delivery_price', 'free_delivery_from']);
        });
    }
};
