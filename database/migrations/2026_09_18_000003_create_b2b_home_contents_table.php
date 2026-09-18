<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Single-row table: the "who we are" block of the B2B portal home page.
     */
    public function up(): void
    {
        Schema::create('b2b_home_contents', function (Blueprint $table) {
            $table->id();
            $table->json('about_title')->nullable();
            $table->json('about_text')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('b2b_home_contents');
    }
};
