<?php

declare(strict_types=1);

namespace Tests\Feature\Orders;

use App\Models\CatalogGroup;
use App\Models\CatalogSetting;
use App\Models\ClientProductPrice;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use App\Services\Inventory\FifoInventoryService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * POST /api/cart/validate — the B2B portal's pre-checkout check: per-client
 * wholesale prices, the client's own catalog visibility, stock at the chosen
 * warehouse and the minimum order quantity. It reports the same problems
 * POST /api/orders would reject, so the cart can show them first.
 */
class B2bCartValidateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Bus::fake();
    }

    private function actingAsClient(array $attributes = []): User
    {
        $user = User::factory()->b2b()->approved()->create(['discount_percent' => 0, ...$attributes]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function stockAt(Store $store, Product $product, float $stock): void
    {
        app(FifoInventoryService::class)->receive($product, $store, $stock, 10_000);
    }

    #[Test]
    public function valid_lines_come_back_with_wholesale_prices_stock_and_totals(): void
    {
        $this->actingAsClient();
        $store = Store::factory()->create(['is_default' => true]);
        $product = Product::factory()->create(['b2b_price' => 200_000, 'retail_price' => 900_000, 'b2b_min_order_qty' => 2]);
        $this->stockAt($store, $product, 5);
        CatalogSetting::current()->update(['delivery_price' => 100_000, 'free_delivery_from' => null]);

        $this->postJson('/api/cart/validate', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 3]],
        ])
            ->assertOk()
            ->assertJsonPath('data.store_id', $store->id)
            ->assertJsonPath('data.items.0.available', true)
            ->assertJsonPath('data.items.0.problem', null)
            ->assertJsonPath('data.items.0.price', 2000)
            ->assertJsonPath('data.items.0.stock', 5)
            ->assertJsonPath('data.items.0.min_qty', 2)
            ->assertJsonPath('data.subtotal', 6000)
            ->assertJsonPath('data.delivery_cost', 1000)
            ->assertJsonPath('data.total_with_delivery', 7000);
    }

    #[Test]
    public function the_per_client_price_override_wins(): void
    {
        $user = $this->actingAsClient();
        $store = Store::factory()->create(['is_default' => true]);
        $product = Product::factory()->create(['b2b_price' => 200_000]);
        $this->stockAt($store, $product, 5);
        ClientProductPrice::query()->create(['user_id' => $user->id, 'product_id' => $product->id, 'price' => 150_000]);

        $this->postJson('/api/cart/validate', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])
            ->assertOk()
            ->assertJsonPath('data.items.0.price', 1500);
    }

    #[Test]
    public function asking_for_more_than_the_chosen_warehouse_holds_is_flagged_with_the_real_stock(): void
    {
        $this->actingAsClient();
        $chosen = Store::factory()->create(['is_default' => true]);
        $other = Store::factory()->create();
        $product = Product::factory()->create(['b2b_price' => 200_000]);
        $this->stockAt($chosen, $product, 5);
        // Plenty elsewhere must not help: the order ships from one warehouse.
        $this->stockAt($other, $product, 100);

        $this->postJson('/api/cart/validate', [
            'store_id' => $chosen->id,
            'items' => [['product_id' => $product->id, 'quantity' => 6]],
        ])
            ->assertOk()
            ->assertJsonPath('data.items.0.available', false)
            ->assertJsonPath('data.items.0.problem', 'insufficient_stock')
            ->assertJsonPath('data.items.0.stock', 5)
            ->assertJsonPath('data.subtotal', 0);
    }

    #[Test]
    public function exactly_the_stock_on_hand_is_allowed(): void
    {
        $this->actingAsClient();
        $store = Store::factory()->create(['is_default' => true]);
        $product = Product::factory()->create(['b2b_price' => 200_000]);
        $this->stockAt($store, $product, 5);

        $this->postJson('/api/cart/validate', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 5]],
        ])
            ->assertOk()
            ->assertJsonPath('data.items.0.available', true);
    }

    #[Test]
    public function a_quantity_below_the_minimum_order_is_flagged(): void
    {
        $this->actingAsClient();
        $store = Store::factory()->create(['is_default' => true]);
        $product = Product::factory()->create(['b2b_price' => 200_000, 'b2b_min_order_qty' => 3]);
        $this->stockAt($store, $product, 10);

        $this->postJson('/api/cart/validate', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ])
            ->assertOk()
            ->assertJsonPath('data.items.0.available', false)
            ->assertJsonPath('data.items.0.problem', 'below_min_qty')
            ->assertJsonPath('data.items.0.min_qty', 3);
    }

    #[Test]
    public function hidden_missing_and_unpriced_products_are_flagged_without_failing_the_request(): void
    {
        $this->actingAsClient();
        $store = Store::factory()->create(['is_default' => true]);

        $hidden = Product::factory()->create(['b2b_price' => 200_000]);
        $hidden->catalogGroups()->attach(CatalogGroup::factory()->create());
        $this->stockAt($store, $hidden, 10);

        $unpriced = Product::factory()->create(['b2b_price' => null, 'retail_price' => null]);
        $this->stockAt($store, $unpriced, 10);

        $this->postJson('/api/cart/validate', [
            'store_id' => $store->id,
            'items' => [
                ['product_id' => $hidden->id, 'quantity' => 1],
                ['product_id' => 999_999, 'quantity' => 1],
                ['product_id' => $unpriced->id, 'quantity' => 1],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.items.0.problem', 'unavailable')
            ->assertJsonPath('data.items.1.problem', 'unavailable')
            ->assertJsonPath('data.items.2.problem', 'no_price')
            ->assertJsonPath('data.subtotal', 0);
    }

    #[Test]
    public function without_a_store_id_the_clients_default_warehouse_is_used(): void
    {
        $this->actingAsClient();
        Store::factory()->create(['is_default' => false, 'name' => 'Я']);
        $default = Store::factory()->create(['is_default' => true, 'name' => 'А']);
        $product = Product::factory()->create(['b2b_price' => 200_000]);
        $this->stockAt($default, $product, 4);

        $this->postJson('/api/cart/validate', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])
            ->assertOk()
            ->assertJsonPath('data.store_id', $default->id)
            ->assertJsonPath('data.items.0.stock', 4);
    }

    #[Test]
    public function a_retail_customer_cannot_use_the_b2b_cart_check(): void
    {
        Sanctum::actingAs(User::factory()->retail()->approved()->create());

        $this->postJson('/api/cart/validate', [
            'items' => [['product_id' => 1, 'quantity' => 1]],
        ])->assertForbidden();
    }

    #[Test]
    public function a_guest_cannot_use_the_b2b_cart_check(): void
    {
        $this->postJson('/api/cart/validate', [
            'items' => [['product_id' => 1, 'quantity' => 1]],
        ])->assertUnauthorized();
    }

    #[Test]
    public function an_empty_cart_or_zero_quantity_is_a_validation_error(): void
    {
        $this->actingAsClient();

        $this->postJson('/api/cart/validate', ['items' => []])
            ->assertStatus(422)
            ->assertJsonValidationErrors('items');

        $this->postJson('/api/cart/validate', ['items' => [['product_id' => 1, 'quantity' => 0]]])
            ->assertStatus(422)
            ->assertJsonValidationErrors('items.0.quantity');
    }

    #[Test]
    public function the_full_workflow_check_order_then_check_again_shows_the_reduced_stock(): void
    {
        $user = $this->actingAsClient();
        $store = Store::factory()->create(['is_default' => true]);
        $product = Product::factory()->create(['b2b_price' => 200_000]);
        $this->stockAt($store, $product, 5);
        $cart = ['store_id' => $store->id, 'items' => [['product_id' => $product->id, 'quantity' => 3]]];

        $this->postJson('/api/cart/validate', $cart)
            ->assertOk()
            ->assertJsonPath('data.items.0.available', true);

        $this->postJson('/api/orders', $cart)->assertCreated();

        // The same cart again: only 2 are left, so it is now over the stock…
        $this->postJson('/api/cart/validate', $cart)
            ->assertOk()
            ->assertJsonPath('data.items.0.problem', 'insufficient_stock')
            ->assertJsonPath('data.items.0.stock', 2);

        // …and ordering it anyway is rejected without touching the stock.
        $this->postJson('/api/orders', $cart)
            ->assertStatus(422)
            ->assertJsonValidationErrors('items.0');

        $this->assertSame(1, $user->orders()->count());
        $this->assertEqualsWithDelta(2.0, (float) $product->fresh()->stock, 0.001);
    }
}
