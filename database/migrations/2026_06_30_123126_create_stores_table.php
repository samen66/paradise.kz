<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stores', function (Blueprint $table) {
            $table->id();

            // Nullable now: warehouses created locally have no ERP origin. Rows
            // imported from an ERP still carry source + external_id (their identity).
            $table->string('source')->nullable()->index();
            $table->string('external_id')->nullable();
            $table->string('name');

            // Own warehouse metadata (local system of record).
            $table->string('code')->nullable();
            $table->string('type')->default('warehouse'); // warehouse | retail_point
            $table->string('address')->nullable();
            $table->boolean('is_default')->default(false);

            // Local-only flag: lets admins hide a warehouse from clients.
            $table->boolean('is_active')->default(true)->index();

            $table->timestamps();

            $table->unique(['source', 'external_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stores');
    }
};
