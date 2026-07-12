<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Local-only, like is_active: admins assign these; a re-sync from
            // the ERP never sets or clears them (see SyncProductsJob).
            $table->foreignId('category_id')->nullable()->after('external_folder_id')->constrained()->nullOnDelete();
            $table->foreignId('brand_id')->nullable()->after('category_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('category_id');
            $table->dropConstrainedForeignId('brand_id');
        });
    }
};
