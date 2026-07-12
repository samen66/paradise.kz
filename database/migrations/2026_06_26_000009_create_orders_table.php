<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // pending → synced (pushed to the ERP) | failed (push rejected).
            $table->string('status')->default('pending')->index();

            // The ERP provider this order was pushed to (null until pushed).
            $table->string('source')->nullable();

            // Order total in kopecks (minor units), snapshotted at checkout.
            $table->unsignedBigInteger('total');

            $table->text('comment')->nullable();

            // Set once the order lands in the ERP as a customer order.
            $table->string('external_order_id')->nullable();
            $table->string('external_number')->nullable();

            // Last push error message (populated when status = failed).
            $table->text('error')->nullable();

            $table->timestamp('pushed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
