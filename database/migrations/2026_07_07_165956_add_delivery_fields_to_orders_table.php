<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // pickup (from `store`) | delivery (to the address snapshot below).
            $table->string('delivery_method')->default('pickup')->after('store_id');

            // In kopecks, snapshotted from CatalogSetting at placement time.
            $table->unsignedBigInteger('delivery_cost')->default(0)->after('total');

            // Links back to the client's saved address for convenience/reporting
            // only; the fields below are the source of truth for this order
            // (same snapshot pattern as order_items' name/price — the address
            // may later change or be deleted, and guests have none to link).
            $table->foreignId('address_id')->nullable()->after('delivery_method')->constrained()->nullOnDelete();

            $table->string('delivery_city')->nullable()->after('address_id');
            $table->string('delivery_street')->nullable()->after('delivery_city');
            $table->string('delivery_building')->nullable()->after('delivery_street');
            $table->string('delivery_apartment')->nullable()->after('delivery_building');
            $table->string('delivery_comment')->nullable()->after('delivery_apartment');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('address_id');
            $table->dropColumn([
                'delivery_method',
                'delivery_cost',
                'delivery_city',
                'delivery_street',
                'delivery_building',
                'delivery_apartment',
                'delivery_comment',
            ]);
        });
    }
};
