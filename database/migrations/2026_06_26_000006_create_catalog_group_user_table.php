<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('catalog_group_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('catalog_group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->unique(['catalog_group_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('catalog_group_user');
    }
};
