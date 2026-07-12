<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();

            // Keep the line even if the product is later deleted from our mirror;
            // the snapshot fields below preserve what was actually ordered.
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();

            // Snapshots taken at checkout (immune to later catalog/price changes).
            // The product's ERP external id, needed to reference it when pushing.
            $table->string('external_product_id');
            $table->string('name');
            $table->decimal('quantity', 12, 3);
            // Per-client resolved price, in kopecks.
            $table->unsignedBigInteger('price');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
