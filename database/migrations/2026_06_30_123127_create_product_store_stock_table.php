<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_store_stock', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();

            // On-hand stock, now maintained locally as a projection of stock_movements
            // (FifoInventoryService). An optional ERP sync may still mirror it in.
            $table->decimal('stock', 12, 3)->default(0);

            // Quantity committed to unfulfilled orders (available = stock - reserved).
            $table->decimal('reserved', 12, 3)->default(0);

            // Weighted-average cost of the remaining FIFO layers, in kopecks.
            $table->unsignedBigInteger('avg_cost')->nullable();

            $table->timestamps();

            $table->unique(['product_id', 'store_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_store_stock');
    }
};
