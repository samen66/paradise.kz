<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\Address;
use App\Models\Order;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Checkout with a logged-in storefront customer: the same public endpoint,
 * but the order must land on the real account instead of a throwaway guest.
 */
class RetailCheckoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Bus::fake();
    }

    private function stockAt(Store $store, Product $product, float $stock): void
    {
        app(FifoInventoryService::class)->receive($product, $store, $stock, 10_000);
    }

    #[Test]
    public function an_authenticated_retail_customer_gets_the_order_on_their_account(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['retail_price' => 200_000]);
        $this->stockAt($store, $product, 10);

        $user = User::factory()->retail()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/public/checkout', [
            'name' => $user->name,
            'phone' => $user->phone,
            'payment_method' => 'cash',
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertCreated();

        $order = Order::query()->latest('id')->firstOrFail();
        $this->assertSame($user->id, $order->user_id);
        $this->assertSame('P-'.(100_000 + $order->id), $response->json('data.number'));

        // No throwaway guest row was created.
        $this->assertSame(0, User::query()->where('is_guest', true)->count());
    }

    #[Test]
    public function a_saved_address_is_honoured_for_delivery(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['retail_price' => 200_000]);
        $this->stockAt($store, $product, 10);

        $user = User::factory()->retail()->create();
        $address = Address::factory()->create([
            'user_id' => $user->id,
            'city' => 'Алматы',
            'street' => 'Абая',
            'building' => '10',
        ]);

        $this->actingAs($user, 'sanctum')->postJson('/api/public/checkout', [
            'name' => $user->name,
            'phone' => $user->phone,
            'payment_method' => 'cash',
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'delivery' => ['method' => Order::DELIVERY_DELIVERY, 'address_id' => $address->id],
        ])->assertCreated();

        $order = Order::query()->latest('id')->firstOrFail();
        $this->assertSame($address->id, $order->address_id);
        $this->assertSame('Алматы', $order->delivery_city);
    }

    #[Test]
    public function a_foreign_saved_address_is_rejected(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['retail_price' => 200_000]);
        $this->stockAt($store, $product, 10);

        $user = User::factory()->retail()->create();
        $foreignAddress = Address::factory()->create();

        $this->actingAs($user, 'sanctum')->postJson('/api/public/checkout', [
            'name' => $user->name,
            'phone' => $user->phone,
            'payment_method' => 'cash',
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'delivery' => ['method' => Order::DELIVERY_DELIVERY, 'address_id' => $foreignAddress->id],
        ])->assertNotFound();
    }

    #[Test]
    public function a_b2b_token_still_goes_through_the_guest_path(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['retail_price' => 200_000]);
        $this->stockAt($store, $product, 10);

        $b2b = User::factory()->b2b()->approved()->create();

        $this->actingAs($b2b, 'sanctum')->postJson('/api/public/checkout', [
            'name' => 'Куплю как физлицо',
            'phone' => '+77015550000',
            'payment_method' => 'cash',
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertCreated();

        $order = Order::query()->latest('id')->firstOrFail();
        $this->assertNotSame($b2b->id, $order->user_id);
        $this->assertTrue($order->user->is_guest);
    }
}
