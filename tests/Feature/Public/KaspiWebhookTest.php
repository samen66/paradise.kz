<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\Order;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class KaspiWebhookTest extends TestCase
{
    use RefreshDatabase;

    private Order $order;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.kaspi.webhook_secret' => 'test-secret']);

        $store = Store::factory()->create();
        $user = User::factory()->retail()->create();
        $this->order = Order::factory()->for($user)->for($store)->create([
            'payment_method' => 'kaspi',
            'payment_status' => 'unpaid',
        ]);
    }

    public function test_valid_webhook_marks_order_paid(): void
    {
        $payload = [
            'order_id' => $this->order->id,
            'status' => 'paid',
        ];

        $response = $this->postJson('/api/kaspi/webhook', $payload, [
            'X-Kaspi-Signature' => hash_hmac('sha256', json_encode($payload), 'test-secret'),
        ]);

        $response->assertOk();
        $this->assertSame('paid', $this->order->fresh()->payment_status);
    }

    public function test_webhook_without_signature_returns_403(): void
    {
        $response = $this->postJson('/api/kaspi/webhook', [
            'order_id' => $this->order->id,
            'status' => 'paid',
        ]);

        $response->assertForbidden();
        $this->assertSame('unpaid', $this->order->fresh()->payment_status);
    }

    public function test_webhook_with_invalid_order_returns_404(): void
    {
        $payload = [
            'order_id' => 999999,
            'status' => 'paid',
        ];

        $response = $this->postJson('/api/kaspi/webhook', $payload, [
            'X-Kaspi-Signature' => hash_hmac('sha256', json_encode($payload), 'test-secret'),
        ]);

        $response->assertNotFound();
    }
}
