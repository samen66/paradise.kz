<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\Batch;
use App\Models\CatalogGroup;
use App\Models\CatalogSetting;
use App\Models\Order;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class GuestCheckoutTest extends TestCase
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
    public function a_guest_can_check_out_without_any_account(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['retail_price' => 200_000]);
        $this->stockAt($store, $product, 10);

        $response = $this->postJson('/api/public/checkout', [
            'name' => 'Айгерим Сатпаева',
            'phone' => '+77011234567',
            'email' => 'aigerim@example.com',
            'payment_method' => 'cash',
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'comment' => 'Позвонить перед доставкой',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.status', Order::STATUS_PENDING)
            ->assertJsonCount(1, 'data.items');

        $this->assertEqualsWithDelta(4000.0, $response->json('data.total'), 0.001);

        $order = Order::query()->latest('id')->first();
        $this->assertNotNull($order->user_id);
        $this->assertSame('aigerim@example.com', $order->contact_email);

        $guest = User::find($order->user_id);
        $this->assertSame('Айгерим Сатпаева', $guest->name);
        $this->assertSame('+77011234567', $guest->phone);
        $this->assertSame(User::TYPE_RETAIL, $guest->type);
        $this->assertTrue($guest->is_approved);

        // The order is worked in the admin panel and stays pending. It used to
        // be pushed to the ERP, which failed on the missing counterparty and
        // flipped every storefront order to `failed`.
        $this->assertSame(Order::STATUS_PENDING, $order->fresh()->status);
    }

    #[Test]
    public function checkout_uses_retail_price_with_no_discount(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['retail_price' => 150_000, 'b2b_price' => 90_000]);
        $this->stockAt($store, $product, 5);

        $this->postJson('/api/public/checkout', [
            'name' => 'Гость',
            'phone' => '+77011112233',
            'payment_method' => 'cash',
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertCreated();

        $this->assertDatabaseHas('order_items', [
            'product_id' => $product->id,
            'price' => 150_000,
        ]);
    }

    #[Test]
    public function checkout_deducts_fifo_stock(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['retail_price' => 100_000]);
        $this->stockAt($store, $product, 10);

        $this->postJson('/api/public/checkout', [
            'name' => 'Гость',
            'phone' => '+77011112233',
            'payment_method' => 'cash',
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 4]],
        ])->assertCreated();

        $batch = Batch::query()->where('product_id', $product->id)->sole();
        $this->assertEqualsWithDelta(6.0, (float) $batch->qty_left, 0.001);
    }

    #[Test]
    public function b2b_grouped_products_cannot_be_checked_out_by_guests(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create();
        $product->catalogGroups()->attach(CatalogGroup::factory()->create());
        $this->stockAt($store, $product, 10);

        $this->postJson('/api/public/checkout', [
            'name' => 'Гость',
            'phone' => '+77011112233',
            'payment_method' => 'cash',
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('items.0');

        $this->assertDatabaseCount('orders', 0);
    }

    #[Test]
    public function ordering_more_than_stock_is_rejected(): void
    {
        $store = Store::factory()->create(['name' => 'Алматы']);
        $product = Product::factory()->erpSynced()->create(['retail_price' => 50_000]);
        $this->stockAt($store, $product, 2);

        $response = $this->postJson('/api/public/checkout', [
            'name' => 'Гость',
            'phone' => '+77011112233',
            'payment_method' => 'cash',
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 5]],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('items.0');

        $message = $response->json('errors')['items.0'][0];
        $this->assertStringContainsString('складе', $message);
        $this->assertDatabaseCount('orders', 0);
    }

    #[Test]
    public function name_phone_store_and_items_are_required(): void
    {
        $this->postJson('/api/public/checkout', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'phone', 'store_id', 'items', 'payment_method']);
    }

    #[Test]
    public function email_is_optional(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['retail_price' => 50_000]);
        $this->stockAt($store, $product, 5);

        $this->postJson('/api/public/checkout', [
            'name' => 'Гость',
            'phone' => '+77011112233',
            'payment_method' => 'cash',
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertCreated();

        $this->assertDatabaseHas('orders', ['contact_email' => null]);
    }

    #[Test]
    public function omitting_delivery_defaults_to_free_pickup(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['retail_price' => 100_000]);
        $this->stockAt($store, $product, 5);

        $response = $this->postJson('/api/public/checkout', [
            'name' => 'Гость', 'phone' => '+77011112233',
            'payment_method' => 'cash',
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertCreated();

        $response->assertJsonPath('data.delivery_method', 'pickup');
        $this->assertEqualsWithDelta(0.0, $response->json('data.delivery_cost'), 0.001);
        $this->assertEqualsWithDelta(1000.0, $response->json('data.total'), 0.001);
    }

    #[Test]
    public function a_guest_can_request_delivery_with_a_raw_address_and_is_charged_the_delivery_fee(): void
    {
        CatalogSetting::factory()->create(['delivery_price' => 150_000]);

        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['retail_price' => 100_000]);
        $this->stockAt($store, $product, 5);

        $response = $this->postJson('/api/public/checkout', [
            'name' => 'Гость', 'phone' => '+77011112233',
            'payment_method' => 'cash',
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'delivery' => [
                'method' => 'delivery',
                'city' => 'Алматы', 'street' => 'Абая', 'building' => '10',
            ],
        ])->assertCreated();

        $response->assertJsonPath('data.delivery_method', 'delivery')
            ->assertJsonPath('data.delivery_address.city', 'Алматы');

        // 1000 (item) + 1500 (delivery) = 2500 ₸.
        $this->assertEqualsWithDelta(1500.0, $response->json('data.delivery_cost'), 0.001);
        $this->assertEqualsWithDelta(2500.0, $response->json('data.total'), 0.001);
        $this->assertDatabaseHas('orders', ['address_id' => null, 'delivery_city' => 'Алматы']);
    }

    #[Test]
    public function a_guest_delivery_checkout_requires_city_street_and_building(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['retail_price' => 50_000]);
        $this->stockAt($store, $product, 5);

        $this->postJson('/api/public/checkout', [
            'name' => 'Гость', 'phone' => '+77011112233',
            'payment_method' => 'cash',
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'delivery' => ['method' => 'delivery'],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['delivery.city', 'delivery.street', 'delivery.building']);

        $this->assertDatabaseCount('orders', 0);
    }

    #[Test]
    public function checkout_with_kaspi_returns_payment_url(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['retail_price' => 50_000]);
        $this->stockAt($store, $product, 5);

        $response = $this->postJson('/api/public/checkout', [
            'name' => 'Гость',
            'phone' => '+77011112233',
            'payment_method' => 'kaspi',
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertCreated();

        $order = Order::query()->latest('id')->first();
        $expectedUrl = config('services.kaspi.payment_base_url').'?order='.$order->number;
        $response->assertJsonPath('payment_url', $expectedUrl);
    }
}
