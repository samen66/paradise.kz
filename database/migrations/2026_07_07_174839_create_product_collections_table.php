<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Admin-curated product selections for storefront home-page blocks
 * ("Новинки", "Хиты продаж", ...). title is translatable JSON.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_collections', function (Blueprint $table): void {
            $table->id();
            $table->text('title');
            $table->string('slug')->unique();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_collections');
    }
};
