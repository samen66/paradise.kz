<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('write_offs', function (Blueprint $table): void {
            $table->id();
            // Restrict, not cascade: a warehouse with posted write-offs has history.
            $table->foreignId('store_id')->constrained()->restrictOnDelete();
            // damaged | lost | regrading | other
            $table->string('reason');
            $table->text('note')->nullable();
            // draft | posted
            $table->string('status')->default('draft')->index();
            $table->timestamp('posted_at')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('write_off_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('write_off_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 12, 3);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('write_off_items');
        Schema::dropIfExists('write_offs');
    }
};
