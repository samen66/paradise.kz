<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // The ERP's customer-order fulfilment state name (e.g. "Новый",
            // "Подтверждён", "Отгружен"), mirrored back via the order UPDATE
            // webhook. Distinct from `status`, which tracks our local push
            // lifecycle (pending → synced | failed).
            $table->string('external_state')->nullable()->after('external_number');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('external_state');
        });
    }
};
