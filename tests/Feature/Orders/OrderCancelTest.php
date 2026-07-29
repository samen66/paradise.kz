<?php

declare(strict_types=1);

namespace Tests\Feature\Orders;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class OrderCancelTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Bus::fake();
    }

    #[Test]
    public function customer_can_cancel_pending_order(): void
    {
        $user = User::factory()->retail()->create();

        $order = Order::factory()->create([
            'user_id' => $user->id,
            'status'  => Order::STATUS_PENDING,
            'total'   => 100_000,
        ]);

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/account/orders/{$order->id}/cancel")
            ->assertOk();

        $this->assertDatabaseHas('orders', [
            'id'     => $order->id,
            'status' => Order::STATUS_CANCELLED,
        ]);
    }

    #[Test]
    public function customer_cannot_cancel_confirmed_order(): void
    {
        $user = User::factory()->retail()->create();

        $order = Order::factory()->create([
            'user_id' => $user->id,
            'status'  => Order::STATUS_CONFIRMED,
            'total'   => 100_000,
        ]);

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/account/orders/{$order->id}/cancel")
            ->assertStatus(422);

        $this->assertDatabaseHas('orders', [
            'id'     => $order->id,
            'status' => Order::STATUS_CONFIRMED,
        ]);
    }
}
