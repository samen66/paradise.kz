<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which of the product's photos (media, collection `images`) belong to a
 * variant, in the variant's own order. A photo deleted from the gallery
 * disappears from its variants by the cascade.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_variant_media', function (Blueprint $table) {
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_id')->constrained('media')->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->primary(['product_variant_id', 'media_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variant_media');
    }
};
