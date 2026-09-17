<?php

declare(strict_types=1);

namespace Tests\Feature\Orders;

use App\Models\Address;
use App\Models\Batch;
use App\Models\CatalogGroup;
use App\Models\CatalogSetting;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\User;
use App\Services\Inventory\FifoInventoryService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class OrderApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Bus::fake();
    }

    private function approvedClient(array $attributes = []): User
    {
        return User::factory()->b2b()->approved()->create($attributes);
    }

    /**
     * Seed on-hand stock the same way a real receipt would: through the FIFO
     * ledger, so order placement's issue() has an actual batch to draw from.
     */
    private function stockAt(Store $store, Product $product, float $stock): void
    {
        if ($stock <= 0) {
            return;
        }

        app(FifoInventoryService::class)->receive($product, $store, $stock, 10_000);
    }

    #[Test]
    public function it_places_an_order_with_snapshotted_per_client_prices(): void
    {
        $user = $this->approvedClient(['discount_percent' => 0]);
        Sanctum::actingAs($user);

        $store = Store::factory()->create();
        $a = Product::factory()->erpSynced()->create(['name' => 'Диван', 'b2b_price' => 200_000]);
        $b = Product::factory()->erpSynced()->create(['name' => 'Стол', 'b2b_price' => 50_000]);
        $this->stockAt($store, $a, 10);
        $this->stockAt($store, $b, 10);

        $response = $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [
                ['product_id' => $a->id, 'quantity' => 2],
                ['product_id' => $b->id, 'quantity' => 3],
            ],
            'comment' => 'Доставить до обеда',
        ]);

        // total = 200000*2 + 50000*3 = 550000 kopecks → 5500.00 ₸
        $response->assertCreated()
            ->assertJsonPath('data.status', Order::STATUS_PENDING)
            ->assertJsonPath('data.comment', 'Доставить до обеда')
            ->assertJsonCount(2, 'data.items');

        $this->assertEqualsWithDelta(5500.0, $response->json('data.total'), 0.001);

        $this->assertDatabaseHas('orders', [
            'user_id' => $user->id,
            'status' => Order::STATUS_PENDING,
            'total' => 550_000,
        ]);

        // Per-client snapshot prices persisted in kopecks.
        $this->assertDatabaseHas('order_items', [
            'product_id' => $a->id,
            'external_product_id' => $a->externalMapping->external_id,
            'name' => 'Диван',
            'price' => 200_000,
        ]);
        $this->assertDatabaseHas('order_items', [
            'product_id' => $b->id,
            'price' => 50_000,
        ]);

        // Item price exposed in major units (₸).
        $prices = collect($response->json('data.items'))->pluck('price')->all();
        $this->assertEqualsWithDelta([2000.0, 500.0], $prices, 0.001);
    }

    #[Test]
    public function snapshot_price_reflects_the_per_client_discount(): void
    {
        $user = $this->approvedClient(['discount_percent' => 10]);
        Sanctum::actingAs($user);

        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['b2b_price' => 200_000]);
        $this->stockAt($store, $product, 5);

        $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertCreated();

        // 200000 - 10% = 180000 kopecks snapshot.
        $this->assertDatabaseHas('order_items', [
            'product_id' => $product->id,
            'price' => 180_000,
        ]);
    }

    #[Test]
    public function ordering_an_invisible_product_is_rejected(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->create();

        // Restricted to a group the user is not in → not visible.
        $hidden = Product::factory()->erpSynced()->create(['name' => 'Скрытый']);
        $hidden->catalogGroups()->attach(CatalogGroup::factory()->create());
        $this->stockAt($store, $hidden, 10);

        $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $hidden->id, 'quantity' => 1]],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('items.0');

        $this->assertDatabaseCount('orders', 0);
    }

    #[Test]
    public function ordering_more_than_stock_is_rejected(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->create(['name' => 'Алматы']);
        $product = Product::factory()->erpSynced()->create(['name' => 'Стул', 'b2b_price' => 50_000]);
        $this->stockAt($store, $product, 3);

        $response = $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 4]],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('items.0');

        $message = $response->json('errors')['items.0'][0];
        $this->assertStringContainsString('складе', $message);
        $this->assertStringContainsString('Алматы', $message);
        $this->assertDatabaseCount('orders', 0);
    }

    #[Test]
    public function one_line_over_stock_rejects_the_whole_order_and_draws_down_nothing(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->create();
        $fine = Product::factory()->erpSynced()->create(['b2b_price' => 50_000]);
        $short = Product::factory()->erpSynced()->create(['b2b_price' => 50_000]);
        $this->stockAt($store, $fine, 10);
        $this->stockAt($store, $short, 2);

        $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [
                ['product_id' => $fine->id, 'quantity' => 4],
                ['product_id' => $short->id, 'quantity' => 3],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('items.1');

        $this->assertDatabaseCount('orders', 0);
        $this->assertEqualsWithDelta(10.0, (float) $fine->fresh()->stock, 0.001);
        $this->assertEqualsWithDelta(2.0, (float) $short->fresh()->stock, 0.001);
    }

    #[Test]
    public function ordering_below_the_minimum_order_quantity_is_rejected(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['name' => 'Кресло', 'b2b_price' => 50_000, 'b2b_min_order_qty' => 4]);
        $this->stockAt($store, $product, 10);

        $response = $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 3]],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('items.0.quantity');

        $message = $response->json('errors')['items.0.quantity'][0];
        $this->assertStringContainsString('Кресло', $message);
        $this->assertStringContainsString('4', $message);
        $this->assertDatabaseCount('orders', 0);
    }

    #[Test]
    public function the_global_default_minimum_applies_when_the_product_has_none(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);
        CatalogSetting::current()->update(['b2b_default_min_order_qty' => 2]);

        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['b2b_price' => 50_000, 'b2b_min_order_qty' => null]);
        $this->stockAt($store, $product, 10);

        $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertStatus(422);

        $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ])->assertCreated();
    }

    #[Test]
    public function stock_at_another_store_does_not_count(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $chosenStore = Store::factory()->create();
        $otherStore = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['b2b_price' => 50_000]);
        $this->stockAt($otherStore, $product, 10);
        $this->stockAt($chosenStore, $product, 0);

        $this->postJson('/api/orders', [
            'store_id' => $chosenStore->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('items.0');

        $this->assertDatabaseCount('orders', 0);
    }

    #[Test]
    public function missing_store_id_is_rejected(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $product = Product::factory()->erpSynced()->create();

        $this->postJson('/api/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('store_id');

        $this->assertDatabaseCount('orders', 0);
    }

    #[Test]
    public function inactive_store_id_is_rejected(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->inactive()->create();
        $product = Product::factory()->erpSynced()->create();
        $this->stockAt($store, $product, 10);

        $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('store_id');
    }

    #[Test]
    public function empty_items_are_rejected(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->create();

        $this->postJson('/api/orders', ['store_id' => $store->id, 'items' => []])
            ->assertStatus(422)
            ->assertJsonValidationErrors('items');
    }

    #[Test]
    public function unapproved_client_cannot_place_an_order(): void
    {
        $user = User::factory()->b2b()->create(); // pending
        Sanctum::actingAs($user);

        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create();
        $this->stockAt($store, $product, 5);

        $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertStatus(403);
    }

    #[Test]
    public function unauthenticated_request_is_rejected(): void
    {
        $this->postJson('/api/orders', ['items' => []])->assertStatus(401);
        $this->getJson('/api/orders')->assertStatus(401);
    }

    #[Test]
    public function index_lists_only_the_clients_own_orders_newest_first(): void
    {
        $user = $this->approvedClient();
        $other = $this->approvedClient();

        $old = Order::factory()->for($user)->create(['created_at' => now()->subDay()]);
        $new = Order::factory()->for($user)->create(['created_at' => now()]);
        Order::factory()->for($other)->create();

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/orders')->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertSame([$new->id, $old->id], $ids);
    }

    #[Test]
    public function show_returns_the_clients_own_order_with_items(): void
    {
        $user = $this->approvedClient();
        $order = Order::factory()->for($user)->create();
        $order->items()->createMany([
            ['external_product_id' => 'm-1', 'name' => 'Товар', 'quantity' => 2, 'price' => 100_000, 'product_id' => null],
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/orders/'.$order->id)
            ->assertOk()
            ->assertJsonPath('data.id', $order->id);

        $this->assertEqualsWithDelta(1000.0, $response->json('data.items.0.price'), 0.001);
    }

    #[Test]
    public function show_returns_404_for_another_clients_order(): void
    {
        $owner = $this->approvedClient();
        $intruder = $this->approvedClient();

        $order = Order::factory()->for($owner)->create();

        Sanctum::actingAs($intruder);

        // 404 (not 403) so the order's existence does not leak.
        $this->getJson('/api/orders/'.$order->id)->assertStatus(404);
    }

    /**
     * An order with `$lines` lines, each pointing at a product that has a photo.
     */
    private function orderWithPhotographedProducts(User $user, int $lines): Order
    {
        Storage::fake(config('media-library.disk_name'));

        $order = Order::factory()->for($user)->create();

        for ($i = 1; $i <= $lines; $i++) {
            $product = Product::factory()->create(['article' => "ART-{$order->id}-{$i}"]);
            $product->addMedia(UploadedFile::fake()->image("p{$i}.jpg"))
                ->toMediaCollection(Product::IMAGE_COLLECTION);

            $order->items()->create([
                'product_id' => $product->id,
                'external_product_id' => null,
                'name' => "Товар {$i}",
                'quantity' => 1,
                'price' => 100_000,
            ]);
        }

        return $order;
    }

    #[Test]
    public function show_returns_the_photo_and_article_of_each_line(): void
    {
        $user = $this->approvedClient();
        $order = $this->orderWithPhotographedProducts($user, 1);
        $product = $order->items()->first()->product;

        Sanctum::actingAs($user);

        $this->getJson('/api/orders/'.$order->id)
            ->assertOk()
            ->assertJsonPath('data.items.0.article', "ART-{$order->id}-1")
            ->assertJsonPath('data.items.0.image', $product->getFirstMedia(Product::IMAGE_COLLECTION)->getUrl('thumb'))
            // The line keeps its own snapshot name, not the live product name.
            ->assertJsonPath('data.items.0.name', 'Товар 1');
    }

    #[Test]
    public function a_line_whose_product_is_gone_has_null_photo_and_article(): void
    {
        $user = $this->approvedClient();
        $order = Order::factory()->for($user)->create();
        $order->items()->create([
            'product_id' => null,
            'external_product_id' => null,
            'name' => 'Удалённый товар',
            'quantity' => 1,
            'price' => 100_000,
        ]);

        Sanctum::actingAs($user);

        $line = $this->getJson('/api/orders/'.$order->id)->assertOk()->json('data.items.0');

        $this->assertArrayHasKey('image', $line);
        $this->assertNull($line['image']);
        $this->assertArrayHasKey('article', $line);
        $this->assertNull($line['article']);
    }

    #[Test]
    public function show_returns_the_payment_status(): void
    {
        $user = $this->approvedClient();
        $order = Order::factory()->for($user)->create(['payment_status' => 'paid']);

        Sanctum::actingAs($user);

        $this->getJson('/api/orders/'.$order->id)
            ->assertOk()
            ->assertJsonPath('data.payment_status', 'paid');
    }

    #[Test]
    public function show_query_count_does_not_grow_with_the_number_of_lines(): void
    {
        $user = $this->approvedClient();
        $small = $this->orderWithPhotographedProducts($user, 1);
        $large = $this->orderWithPhotographedProducts($user, 3);

        Sanctum::actingAs($user);

        $countQueries = function (Order $order): int {
            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->getJson('/api/orders/'.$order->id)->assertOk();
            DB::disableQueryLog();

            return count(DB::getQueryLog());
        };

        $countQueries($small); // warm up per-request caches (roles, settings)

        $this->assertSame($countQueries($small), $countQueries($large));
    }

    #[Test]
    public function index_does_not_expose_line_photos(): void
    {
        $user = $this->approvedClient();
        $this->orderWithPhotographedProducts($user, 1);

        Sanctum::actingAs($user);

        $line = $this->getJson('/api/orders')->assertOk()->json('data.0.items.0');

        $this->assertArrayNotHasKey('image', $line);
        $this->assertArrayNotHasKey('article', $line);
    }

    #[Test]
    public function placing_an_order_draws_down_the_fifo_batch_and_records_a_sale_movement(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['b2b_price' => 50_000]);
        $this->stockAt($store, $product, 10);

        $response = $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 4]],
        ])->assertCreated();

        $orderId = $response->json('data.id');

        $batch = Batch::query()->where('product_id', $product->id)->sole();
        $this->assertEqualsWithDelta(6.0, (float) $batch->qty_left, 0.001);

        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $product->id,
            'store_id' => $store->id,
            'type' => StockMovement::TYPE_SALE,
            'documentable_type' => Order::class,
            'documentable_id' => $orderId,
        ]);

        $this->assertEqualsWithDelta(
            6.0,
            app(FifoInventoryService::class)->onHand($product, $store),
            0.001,
        );
    }

    #[Test]
    public function a_stock_drift_between_the_precheck_and_the_ledger_rejects_the_order_and_changes_nothing(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->create(['name' => 'Астана']);
        $product = Product::factory()->erpSynced()->create(['b2b_price' => 50_000]);
        $this->stockAt($store, $product, 5); // real FIFO batch: 5 units.

        // Simulate the cached projection drifting ahead of the ledger (e.g. a
        // stale ERP mirror write) so the cheap pre-check would wrongly pass.
        ProductStoreStock::query()
            ->where('product_id', $product->id)
            ->where('store_id', $store->id)
            ->update(['stock' => 10]);

        $response = $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 8]],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('items.0');

        $message = $response->json('errors')['items.0'][0];
        $this->assertStringContainsString('недостаточно', $message);
        $this->assertStringContainsString('Астана', $message);

        // Authoritative issue() rolled the whole transaction back: no order,
        // and the batch is untouched (not partially drawn down).
        $this->assertDatabaseCount('orders', 0);
        $this->assertEqualsWithDelta(
            5.0,
            (float) Batch::query()->where('product_id', $product->id)->sole()->qty_left,
            0.001,
        );
    }

    #[Test]
    public function omitting_delivery_defaults_to_free_pickup(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['b2b_price' => 100_000]);
        $this->stockAt($store, $product, 5);

        $response = $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertCreated();

        $response->assertJsonPath('data.delivery_method', 'pickup');
        $this->assertEqualsWithDelta(0.0, $response->json('data.delivery_cost'), 0.001);
        $this->assertEqualsWithDelta(1000.0, $response->json('data.total'), 0.001);
    }

    #[Test]
    public function delivery_with_a_saved_address_snapshots_it_and_adds_the_delivery_cost(): void
    {
        CatalogSetting::factory()->create(['delivery_price' => 150_000]);

        $user = $this->approvedClient();
        Sanctum::actingAs($user);
        $address = Address::factory()->for($user)->create(['city' => 'Алматы', 'street' => 'Абая', 'building' => '10']);

        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['b2b_price' => 100_000]);
        $this->stockAt($store, $product, 5);

        $response = $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'delivery' => ['method' => 'delivery', 'address_id' => $address->id],
        ])->assertCreated();

        $response->assertJsonPath('data.delivery_method', 'delivery')
            ->assertJsonPath('data.delivery_address.city', 'Алматы')
            ->assertJsonPath('data.delivery_address.street', 'Абая');

        // 1000 (item) + 1500 (delivery) = 2500 ₸.
        $this->assertEqualsWithDelta(1500.0, $response->json('data.delivery_cost'), 0.001);
        $this->assertEqualsWithDelta(2500.0, $response->json('data.total'), 0.001);

        $this->assertDatabaseHas('orders', ['address_id' => $address->id, 'delivery_city' => 'Алматы']);
    }

    #[Test]
    public function delivery_with_a_raw_address_snapshots_it_without_linking_an_address_id(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['b2b_price' => 50_000]);
        $this->stockAt($store, $product, 5);

        $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'delivery' => [
                'method' => 'delivery',
                'city' => 'Караганда', 'street' => 'Бухар-Жырау', 'building' => '25', 'apartment' => '3',
            ],
        ])->assertCreated();

        $this->assertDatabaseHas('orders', [
            'address_id' => null,
            'delivery_city' => 'Караганда',
            'delivery_apartment' => '3',
        ]);
    }

    #[Test]
    public function delivery_cost_is_waived_at_or_above_the_free_threshold(): void
    {
        CatalogSetting::factory()->create(['delivery_price' => 100_000, 'free_delivery_from' => 100_000]);

        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['b2b_price' => 100_000]); // subtotal = 1000 ₸ = threshold
        $this->stockAt($store, $product, 5);

        $response = $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'delivery' => ['method' => 'delivery', 'city' => 'Алматы', 'street' => 'Абая', 'building' => '1'],
        ])->assertCreated();

        $this->assertEqualsWithDelta(0.0, $response->json('data.delivery_cost'), 0.001);
        $this->assertEqualsWithDelta(1000.0, $response->json('data.total'), 0.001);
    }

    #[Test]
    public function delivery_requires_city_street_and_building_when_no_saved_address_is_chosen(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['b2b_price' => 50_000]);
        $this->stockAt($store, $product, 5);

        $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'delivery' => ['method' => 'delivery'],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['delivery.city', 'delivery.street', 'delivery.building']);

        $this->assertDatabaseCount('orders', 0);
    }

    #[Test]
    public function a_client_cannot_deliver_to_another_clients_saved_address(): void
    {
        $stranger = $this->approvedClient();
        $address = Address::factory()->for($stranger)->create();

        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->create();
        $product = Product::factory()->erpSynced()->create(['b2b_price' => 50_000]);
        $this->stockAt($store, $product, 5);

        $this->postJson('/api/orders', [
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'delivery' => ['method' => 'delivery', 'address_id' => $address->id],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['delivery.address_id']);

        $this->assertDatabaseCount('orders', 0);
    }
}
