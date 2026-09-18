<?php

declare(strict_types=1);

namespace Tests\Feature\Catalog;

use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * A B2B client awaiting approval browses the catalog but never receives
 * prices or stock — the keys are absent from the JSON, not just null.
 */
class UnapprovedCatalogTest extends TestCase
{
    use RefreshDatabase;

    private const COMMERCIAL_KEYS = ['price', 'old_price', 'stock', 'in_stock', 'showrooms'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    /**
     * @param  array<string, mixed>  $product
     */
    private function assertNoCommercialKeys(array $product): void
    {
        foreach (self::COMMERCIAL_KEYS as $key) {
            $this->assertArrayNotHasKey($key, $product, "Unapproved client must not receive `{$key}`");
        }
    }

    #[Test]
    public function the_listing_has_products_but_no_prices_or_stock(): void
    {
        Sanctum::actingAs(User::factory()->b2b()->create());
        $store = Store::factory()->create();
        $product = Product::factory()->create(['b2b_price' => 200_000, 'compare_at_price' => 300_000]);
        ProductStoreStock::factory()->for($product)->for($store)->create(['stock' => 5]);

        $response = $this->getJson('/api/products?store_id='.$store->id)->assertOk();

        $response->assertJsonPath('data.0.id', $product->id);
        $this->assertNoCommercialKeys($response->json('data.0'));
    }

    #[Test]
    public function the_detail_hides_prices_and_variant_stock(): void
    {
        Sanctum::actingAs(User::factory()->b2b()->create());
        $product = Product::factory()->create(['b2b_price' => 200_000]);
        ProductVariant::factory()->for($product)->create(['stock' => 3]);

        $response = $this->getJson('/api/products/'.$product->id)->assertOk();

        $this->assertNoCommercialKeys($response->json('data'));
        $this->assertArrayNotHasKey('stock', $response->json('data.variants.0'));
        $this->assertArrayNotHasKey('in_stock', $response->json('data.variants.0'));
        $this->assertNotNull($response->json('data.variants.0.name'));
    }

    #[Test]
    public function the_in_stock_filter_reveals_nothing(): void
    {
        Sanctum::actingAs(User::factory()->b2b()->create());
        $store = Store::factory()->create();
        $stocked = Product::factory()->create();
        $empty = Product::factory()->create();
        ProductStoreStock::factory()->for($stocked)->for($store)->create(['stock' => 5]);
        ProductStoreStock::factory()->for($empty)->for($store)->create(['stock' => 0]);

        $response = $this->getJson('/api/products?store_id='.$store->id.'&filter[in_stock]=1')->assertOk();

        $this->assertEqualsCanonicalizing(
            [$stocked->id, $empty->id],
            collect($response->json('data'))->pluck('id')->all(),
        );
    }

    #[Test]
    public function categories_are_open_to_an_unapproved_client(): void
    {
        Sanctum::actingAs(User::factory()->b2b()->create());

        $this->getJson('/api/categories')->assertOk();
    }

    #[Test]
    public function cart_orders_and_addresses_stay_closed(): void
    {
        Sanctum::actingAs(User::factory()->b2b()->create());

        $this->postJson('/api/cart/validate', ['items' => []])->assertForbidden();
        $this->getJson('/api/orders')->assertForbidden();
        $this->postJson('/api/orders', [])->assertForbidden();
        $this->getJson('/api/addresses')->assertForbidden();
    }

    #[Test]
    public function an_approved_client_still_gets_prices_and_stock(): void
    {
        Sanctum::actingAs(User::factory()->b2b()->approved()->create());
        $store = Store::factory()->create();
        $product = Product::factory()->create(['b2b_price' => 200_000]);
        ProductStoreStock::factory()->for($product)->for($store)->create(['stock' => 5]);

        $this->getJson('/api/products?store_id='.$store->id)
            ->assertOk()
            ->assertJsonPath('data.0.price', 2000)
            ->assertJsonPath('data.0.in_stock', true)
            ->assertJsonPath('data.0.stock', 5);
    }

    #[Test]
    public function the_storefront_still_shows_retail_prices(): void
    {
        Product::factory()->create(['retail_price' => 250_000]);

        $response = $this->getJson('/api/public/products')->assertOk();

        $this->assertEqualsWithDelta(2500.0, $response->json('data.0.price'), 0.001);
        $this->assertArrayHasKey('in_stock', $response->json('data.0'));
    }
}
