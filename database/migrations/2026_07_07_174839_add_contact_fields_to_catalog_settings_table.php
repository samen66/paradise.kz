<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Store contacts shown in the storefront header/footer and on the contacts
 * page. Lives on the single-row catalog_settings table (same pattern as the
 * delivery fields) rather than a new table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('catalog_settings', function (Blueprint $table): void {
            $table->string('contact_phone')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('contact_address')->nullable();
            $table->string('whatsapp_url')->nullable();
            $table->string('instagram_url')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('catalog_settings', function (Blueprint $table): void {
            $table->dropColumn([
                'contact_phone',
                'contact_email',
                'contact_address',
                'whatsapp_url',
                'instagram_url',
            ]);
        });
    }
};
