<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `order_items.external_product_id` was NOT NULL because every product used to
 * arrive from an ERP and the column was needed to reference it when pushing the
 * order back out.
 *
 * Products are now authored locally and nothing is pushed anywhere, so the
 * column is empty for any product without a legacy ERP mapping — and a NOT NULL
 * column meant checkout died with a 500 on exactly those products, i.e. on
 * every product created since. It stays as a historical snapshot for orders
 * placed while the ERP was connected.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table): void {
            $table->string('external_product_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table): void {
            $table->string('external_product_id')->nullable(false)->change();
        });
    }
};
