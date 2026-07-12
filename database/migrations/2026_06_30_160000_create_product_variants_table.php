<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();

            // The ERP provider this variant was mirrored from; identity is
            // source + external_id (a variant/modification has its own ERP id).
            $table->string('source')->index();
            $table->string('external_id');

            $table->string('name');
            $table->string('code')->nullable();

            // Prices in kopecks (minor units); fall back to the parent's when null.
            $table->unsignedBigInteger('retail_price')->nullable();
            $table->unsignedBigInteger('b2b_price')->nullable();

            // Free stock summed across warehouses, mirrored from the ERP.
            $table->decimal('stock', 12, 3)->default(0);

            // Per-variant barcodes and the characteristics that define it
            // (e.g. {"Цвет": "красный", "Размер": "XL"}).
            $table->json('barcodes')->nullable();
            $table->json('characteristics')->nullable();

            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            $table->unique(['source', 'external_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variants');
    }
};
