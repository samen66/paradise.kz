<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();

            // The ERP provider this row was mirrored from (config erp.provider).
            // Rows from different providers coexist; identity is source+external_id.
            $table->string('source')->index();
            $table->string('external_id');
            $table->string('external_folder_id')->nullable()->index();

            $table->string('name');
            $table->string('code')->nullable()->index();
            $table->string('article')->nullable();
            $table->text('description')->nullable();

            // Prices are kept in kopecks (minor units), as the ERP returns them.
            $table->unsignedBigInteger('retail_price')->nullable();
            $table->unsignedBigInteger('b2b_price')->nullable();
            $table->unsignedBigInteger('purchase_price')->nullable();
            $table->unsignedBigInteger('min_price')->nullable();

            // Free stock mirrored from the ERP (per-store breakdown in product_store_stock).
            $table->decimal('stock', 12, 3)->default(0);

            $table->string('uom')->nullable();
            $table->decimal('weight', 12, 3)->nullable();
            $table->decimal('volume', 12, 3)->nullable();
            $table->string('country')->nullable();
            $table->string('supplier')->nullable();

            // Full mirror of provider-side identifiers/characteristics so the B2B
            // site never has to call the ERP at read time.
            $table->json('barcodes')->nullable();
            $table->json('attributes')->nullable();

            $table->string('image_url')->nullable();

            // Local-only flag: lets admins hide a product from all B2B clients.
            $table->boolean('is_active')->default(true)->index();

            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            $table->unique(['source', 'external_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
