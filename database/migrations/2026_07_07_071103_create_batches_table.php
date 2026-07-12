<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();

            // Purchase cost of one unit in this layer, in kopecks (minor units).
            $table->unsignedBigInteger('unit_cost');

            // Quantity originally received vs. still on hand. FIFO draws down
            // qty_left oldest-first; a batch with qty_left = 0 is fully consumed.
            $table->decimal('qty_in', 12, 3);
            $table->decimal('qty_left', 12, 3);

            $table->timestamp('received_at');
            $table->timestamp('expires_at')->nullable();
            $table->string('note')->nullable();

            $table->timestamps();

            // FIFO ordering and "layers that still have stock" lookups.
            $table->index(['product_id', 'store_id', 'qty_left']);
            $table->index('received_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('batches');
    }
};
