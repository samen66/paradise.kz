<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\CatalogSetting;
use App\Models\Product;
use App\Models\Store;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * A resolved warehouse answers for its own stock — zero included.
 *
 * The catalog used to read `$storeStock > 0 ? $storeStock : $product->stock`,
 * which meant a sold-out warehouse silently fell back to the all-warehouse
 * aggregate: the storefront advertised the product as in stock, the cart
 * agreed, and checkout then rejected the line with a 422. These tests pin the
 * honest behaviour on all three surfaces (catalog, cart, checkout).
 */
class StockVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private Store $store;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->store = Store::factory()->create(['is_active' => true, 'is_default' => true]);
        // A stale aggregate is exactly the state the old fallback masked.
        $this->product = Product::factory()->create([
            'retail_price' => 100_000,
            'stock' => 5,
        ]);
    }

    private function receive(float $quantity): void
    {
        app(FifoInventoryService::class)->receive($this->product, $this->store, $quantity, 10_000);
    }

    #[Test]
    public function a_warehouse_with_no_stock_reports_out_of_stock(): void
    {
        $response = $this->getJson('/api/public/products?store_id='.$this->store->id)->assertOk();

        $row = collect($response->json('data'))->firstWhere('id', $this->product->id);

        $this->assertNotNull($row, 'Товар должен быть в каталоге, просто без остатка.');
        $this->assertFalse($row['in_stock']);
    }

    #[Test]
    public function stock_received_into_the_warehouse_becomes_visible(): void
    {
        $this->receive(3);

        $response = $this->getJson('/api/public/products?store_id='.$this->store->id)->assertOk();
        $row = collect($response->json('data'))->firstWhere('id', $this->product->id);

        $this->assertTrue($row['in_stock']);

        if (CatalogSetting::current()->show_stock_quantity) {
            $this->assertEqualsWithDelta(3.0, (float) $row['stock'], 0.001);
        }
    }

    #[Test]
    public function the_in_stock_filter_excludes_a_sold_out_product(): void
    {
        $this->receive(2);
        app(FifoInventoryService::class)->issue($this->product, $this->store, 2);

        $response = $this->getJson('/api/public/products?store_id='.$this->store->id.'&filter[in_stock]=1')
            ->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertNotContains($this->product->id, $ids);
    }

    #[Test]
    public function the_cart_flags_a_sold_out_line_instead_of_promising_it(): void
    {
        $response = $this->postJson('/api/public/cart/validate', [
            'store_id' => $this->store->id,
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ])->assertOk();

        $line = $response->json('data.items.0');

        $this->assertFalse($line['available']);
        $this->assertSame('insufficient_stock', $line['problem']);
        $this->assertEqualsWithDelta(0.0, (float) $line['stock'], 0.001);
    }

    #[Test]
    public function checkout_rejects_a_product_the_warehouse_does_not_hold(): void
    {
        $this->postJson('/api/public/checkout', [
            'name' => 'Гость',
            'phone' => '+77011112233',
            'payment_method' => 'cash',
            'store_id' => $this->store->id,
            'items' => [['product_id' => $this->product->id, 'quantity' => 1]],
        ])->assertStatus(422)->assertJsonValidationErrors('items.0');
    }
}
