<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_folders', function (Blueprint $table) {
            $table->id();
            $table->string('source')->index();
            $table->string('external_id');
            $table->string('parent_external_id')->nullable()->index();
            $table->string('name');
            $table->string('path_name')->nullable();
            $table->timestamps();

            $table->unique(['source', 'external_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_folders');
    }
};
