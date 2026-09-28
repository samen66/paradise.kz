<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A variant's characteristics, from the same attribute dictionary as the
 * product's (attribute_values), value as {ru, kk} JSON.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_variant_attribute_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('attribute_id')->constrained()->cascadeOnDelete();
            $table->json('value');
            $table->timestamps();
            // The default name is longer than MySQL's 64 characters.
            $table->unique(['product_variant_id', 'attribute_id'], 'pvav_variant_attribute_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variant_attribute_values');
    }
};
