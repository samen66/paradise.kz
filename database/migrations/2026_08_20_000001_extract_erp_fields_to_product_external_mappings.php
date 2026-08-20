<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Create the new table
        Schema::create('product_external_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('source');
            $table->string('external_id');
            $table->string('external_folder_id')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->json('barcodes')->nullable();
            $table->json('erp_attributes')->nullable();
            $table->timestamps();

            $table->unique(['source', 'external_id'], 'uniq_source_external');
            $table->index('product_id', 'idx_product_id');
        });

        // 2. Copy existing ERP data from products → product_external_mappings
        // Only copy rows that actually have source + external_id.
        // We use insertUsing instead of raw SQL for better driver compatibility (sqlite vs mysql)
        DB::table('product_external_mappings')->insertUsing(
            ['product_id', 'source', 'external_id', 'external_folder_id', 'synced_at', 'barcodes', 'erp_attributes', 'created_at', 'updated_at'],
            DB::table('products')
                ->select(['id', 'source', 'external_id', 'external_folder_id', 'synced_at', 'barcodes', 'attributes', DB::raw('CURRENT_TIMESTAMP'), DB::raw('CURRENT_TIMESTAMP')])
                ->whereNotNull('source')
                ->whereNotNull('external_id')
        );

        // 3. Drop the unique constraint from products
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['source', 'external_id']);
            $table->dropIndex(['source']);
            $table->dropIndex(['external_folder_id']);
        });

        // 4. Drop the migrated columns from products
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'source',
                'external_id',
                'external_folder_id',
                'synced_at',
                'barcodes',
                'attributes',
            ]);
        });
    }

    public function down(): void
    {
        // 1. Re-add columns to products
        Schema::table('products', function (Blueprint $table) {
            $table->string('source')->nullable()->after('id');
            $table->string('external_id')->nullable()->after('source');
            $table->string('external_folder_id')->nullable()->after('external_id');
            $table->timestamp('synced_at')->nullable();
            $table->json('barcodes')->nullable();
            $table->json('attributes')->nullable();
        });

        // 2. Copy data back from product_external_mappings → products
        // Note: SQLite does not support update with join.
        // So we might need a simpler query or loop if down needs to work in testing.
        // But for production (MySQL) this works.
        DB::statement('
            UPDATE products
            INNER JOIN product_external_mappings ON products.id = product_external_mappings.product_id
            SET products.source = product_external_mappings.source,
                products.external_id = product_external_mappings.external_id,
                products.external_folder_id = product_external_mappings.external_folder_id,
                products.synced_at = product_external_mappings.synced_at,
                products.barcodes = product_external_mappings.barcodes,
                products.attributes = product_external_mappings.erp_attributes
        ');

        // 3. Re-add index and unique constraint
        Schema::table('products', function (Blueprint $table) {
            $table->index('source');
            $table->index('external_folder_id');
            $table->unique(['source', 'external_id']);
        });

        // 4. Drop the mapping table
        Schema::dropIfExists('product_external_mappings');
    }
};
