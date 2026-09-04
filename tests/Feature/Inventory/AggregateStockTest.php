<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Models\Product;
use App\Models\Store;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * `products.stock` is the sum of a product's per-warehouse balances, and the
 * catalog falls back to it whenever no warehouse is selected.
 *
 * It used to be recomputed only by the ERP stock sync, so once the app stopped
 * mirroring an ERP every local receipt and sale left it frozen — the catalog
 * would keep advertising stock nobody held. These tests pin the aggregate to
 * the FIFO ledger.
 */
class AggregateStockTest extends TestCase
{
    use RefreshDatabase;

    private FifoInventoryService $inventory;

    private Product $product;

    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();

        $this->inventory = app(FifoInventoryService::class);
        // Start from a known aggregate: the factory seeds a random stock value.
        $this->product = Product::factory()->create(['stock' => 0]);
        $this->store = Store::factory()->create();
    }

    private function aggregate(): float
    {
        return (float) $this->product->fresh()->stock;
    }

    #[Test]
    public function receiving_stock_raises_the_product_aggregate(): void
    {
        $this->inventory->receive($this->product, $this->store, 10, 10_000);

        $this->assertEqualsWithDelta(10.0, $this->aggregate(), 0.001);
    }

    #[Test]
    public function issuing_stock_lowers_the_product_aggregate(): void
    {
        $this->inventory->receive($this->product, $this->store, 10, 10_000);
        $this->inventory->issue($this->product, $this->store, 3);

        $this->assertEqualsWithDelta(7.0, $this->aggregate(), 0.001);
    }

    #[Test]
    public function selling_out_drops_the_aggregate_to_zero(): void
    {
        $this->inventory->receive($this->product, $this->store, 4, 10_000);
        $this->inventory->issue($this->product, $this->store, 4);

        $this->assertEqualsWithDelta(0.0, $this->aggregate(), 0.001);
    }

    #[Test]
    public function the_aggregate_sums_every_warehouse(): void
    {
        $second = Store::factory()->create();

        $this->inventory->receive($this->product, $this->store, 6, 10_000);
        $this->inventory->receive($this->product, $second, 4, 12_000);

        $this->assertEqualsWithDelta(10.0, $this->aggregate(), 0.001);

        $this->inventory->issue($this->product, $second, 4);

        $this->assertEqualsWithDelta(6.0, $this->aggregate(), 0.001);
    }

    #[Test]
    public function the_recompute_command_repairs_a_drifted_aggregate(): void
    {
        $this->inventory->receive($this->product, $this->store, 5, 10_000);

        // Simulate the historical drift: a stale aggregate left behind by the
        // retired ERP sync while the warehouse balance says otherwise.
        Product::query()->where('id', $this->product->id)->update(['stock' => 999]);
        $this->assertEqualsWithDelta(999.0, $this->aggregate(), 0.001);

        $this->artisan('stock:recompute')->assertSuccessful();

        $this->assertEqualsWithDelta(5.0, $this->aggregate(), 0.001);
    }
}
