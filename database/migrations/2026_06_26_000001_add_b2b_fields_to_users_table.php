<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone')->nullable()->after('email');

            // B2B company details.
            $table->string('company_name')->nullable()->after('phone');
            $table->string('company_bin')->nullable()->after('company_name'); // БИН (KZ).

            // Approval gate: new B2B clients are inactive until an admin approves.
            $table->boolean('is_approved')->default(false)->after('company_bin');

            // Per-client wholesale discount applied on top of the ERP B2B price.
            $table->decimal('discount_percent', 5, 2)->default(0)->after('is_approved');

            // Link to the matching ERP counterparty (the order's agent).
            $table->string('external_counterparty_id')->nullable()->unique()->after('discount_percent');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'phone',
                'company_name',
                'company_bin',
                'is_approved',
                'discount_percent',
                'external_counterparty_id',
            ]);
        });
    }
};
