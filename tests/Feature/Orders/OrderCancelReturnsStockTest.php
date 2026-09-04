<?php

declare(strict_types=1);

namespace Tests\Feature\Orders;

use App\Models\Order;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\User;
use App\Services\Inventory\FifoInventoryService;
use App\Services\Orders\OrderCancellationService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Cancelling used to be a bare status write, so every cancelled order silently
 * ate its goods: the units were gone from the warehouse and owed to nobody.
 */
class OrderCancelReturnsStockTest extends TestCase
{
    use RefreshDatabase;

    private Store $store;

    private Product $product;

    private User $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->store = Store::factory()->create(['is_default' => true, 'is_active' => true]);
        $this->product = Product::factory()->create(['retail_price' => 100_000, 'stock' => 0]);
        $this->customer = User::factory()->create(['type' => User::TYPE_RETAIL, 'is_approved' => true]);

        app(FifoInventoryService::class)->receive($this->product, $this->store, 10, 7_000);
    }

    private function placeOrderFor(float $quantity): Order
    {
        Sanctum::actingAs($this->customer);

        $this->postJson('/api/public/checkout', [
            'name' => 'Клиент',
            'phone' => '+77011112233',
            'payment_method' => 'cash',
            'store_id' => $this->store->id,
            'items' => [['product_id' => $this->product->id, 'quantity' => $quantity]],
        ])->assertCreated();

        return Order::query()->latest('id')->firstOrFail();
    }

    private function onHand(): float
    {
        return app(FifoInventoryService::class)->onHand($this->product, $this->store);
    }

    #[Test]
    public function cancelling_puts_the_goods_back_on_the_shelf(): void
    {
        $order = $this->placeOrderFor(3);

        $this->assertEqualsWithDelta(7.0, $this->onHand(), 0.001);
        $this->assertEqualsWithDelta(7.0, (float) $this->product->fresh()->stock, 0.001);

        app(OrderCancellationService::class)->cancel($order);

        $this->assertSame(Order::STATUS_CANCELLED, $order->fresh()->status);
        $this->assertEqualsWithDelta(10.0, $this->onHand(), 0.001);
        $this->assertEqualsWithDelta(10.0, (float) $this->product->fresh()->stock, 0.001);
    }

    #[Test]
    public function the_return_is_recorded_at_the_original_cost(): void
    {
        $order = $this->placeOrderFor(2);

        app(OrderCancellationService::class)->cancel($order);

        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $this->product->id,
            'store_id' => $this->store->id,
            'type' => StockMovement::TYPE_RETURN,
            // The cost the sale consumed, not the price the customer paid.
            'unit_cost' => 7_000,
        ]);
    }

    #[Test]
    public function cancelling_twice_never_double_returns_the_stock(): void
    {
        $order = $this->placeOrderFor(3);

        app(OrderCancellationService::class)->cancel($order);

        $this->expectException(ValidationException::class);

        try {
            app(OrderCancellationService::class)->cancel($order->fresh());
        } finally {
            $this->assertEqualsWithDelta(10.0, $this->onHand(), 0.001);
        }
    }

    #[Test]
    public function a_completed_order_cannot_be_cancelled(): void
    {
        $order = $this->placeOrderFor(1);
        $order->update(['status' => Order::STATUS_COMPLETED]);

        $this->expectException(ValidationException::class);

        try {
            app(OrderCancellationService::class)->cancel($order);
        } finally {
            $this->assertEqualsWithDelta(9.0, $this->onHand(), 0.001);
        }
    }

    #[Test]
    public function the_customer_endpoint_returns_the_stock_too(): void
    {
        $order = $this->placeOrderFor(4);
        $order->update(['user_id' => $this->customer->id]);

        Sanctum::actingAs($this->customer);

        $this->patchJson("/api/account/orders/{$order->id}/cancel")->assertOk();

        $this->assertSame(Order::STATUS_CANCELLED, $order->fresh()->status);
        $this->assertEqualsWithDelta(10.0, $this->onHand(), 0.001);
    }

    #[Test]
    public function the_admin_endpoint_returns_the_stock_too(): void
    {
        $order = $this->placeOrderFor(5);

        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        $this->putJson("/api/admin/orders/{$order->id}", ['status' => Order::STATUS_CANCELLED])
            ->assertOk();

        $this->assertSame(Order::STATUS_CANCELLED, $order->fresh()->status);
        $this->assertEqualsWithDelta(10.0, $this->onHand(), 0.001);
    }

    #[Test]
    public function the_admin_endpoint_refuses_a_legacy_status(): void
    {
        $order = $this->placeOrderFor(1);

        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        $this->putJson("/api/admin/orders/{$order->id}", ['status' => 'synced'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }
}
