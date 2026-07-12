<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();

            // The FIFO layer this movement created (receipt) or drew from (issue);
            // null for pure adjustments that touch no specific layer.
            $table->foreignId('batch_id')->nullable()->constrained()->nullOnDelete();

            // Signed change in on-hand quantity: positive = in, negative = out.
            $table->decimal('qty_delta', 12, 3);

            // receipt | sale | return | transfer_in | transfer_out | write_off | adjustment | stocktake
            $table->string('type')->index();

            // Cost of one unit for this movement, in kopecks (the layer's cost on issue).
            $table->unsignedBigInteger('unit_cost')->nullable();

            // On-hand balance for this product + store immediately after the movement.
            $table->decimal('balance_after', 12, 3)->nullable();

            // The document that caused the movement (goods receipt, order, transfer…).
            $table->nullableMorphs('documentable');

            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('note')->nullable();

            $table->timestamps();

            $table->index(['store_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
