<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('catalog_settings', function (Blueprint $table) {
            $table->string('whatsapp_api_url')->nullable();
            $table->string('whatsapp_api_key')->nullable();
            $table->string('whatsapp_instance_id')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('catalog_settings', function (Blueprint $table) {
            $table->dropColumn(['whatsapp_api_url', 'whatsapp_api_key', 'whatsapp_instance_id']);
        });
    }
};
