<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A retail point doubles as a showroom on the storefront. Its public card —
 * contacts, hours, services, map point — lives on the same row as the
 * warehouse it is, so stock "in this showroom" is simply this store's stock.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->string('slug', 100)->nullable()->unique();
            $table->boolean('show_on_site')->default(false);
            $table->string('city', 100)->nullable();
            $table->json('landmark')->nullable();
            $table->json('parking')->nullable();
            $table->json('description')->nullable();
            $table->string('phone', 32)->nullable();
            $table->string('whatsapp', 20)->nullable();
            $table->decimal('lat', 9, 6)->nullable();
            $table->decimal('lng', 9, 6)->nullable();
            $table->json('weekly_hours')->nullable();
            $table->json('services')->nullable();
            $table->string('area', 50)->nullable();
            $table->string('floors', 50)->nullable();
            $table->boolean('is_flagship')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn([
                'slug', 'show_on_site', 'city', 'landmark', 'parking', 'description', 'phone', 'whatsapp',
                'lat', 'lng', 'weekly_hours', 'services', 'area', 'floors', 'is_flagship', 'sort_order',
            ]);
        });
    }
};
