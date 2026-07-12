<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Product images are now mirrored into our own storage via Spatie Media
     * Library (the `media` table); the old column held ephemeral MoySklad URLs
     * that expired and 401'd, so it is no longer needed.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('image_urls');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->json('image_urls')->nullable()->after('uom');
        });
    }
};
