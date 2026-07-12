<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Models\Batch;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\StockMovement;
use App\Models\Store;
use App\Services\Inventory\FifoInventoryService;
use App\Services\Inventory\InsufficientStockException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FifoInventoryServiceTest extends TestCase
{
    use RefreshDatabase;

    private FifoInventoryService $inventory;

    private Product $product;

    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();
        $this->inventory = new FifoInventoryService;
        $this->product = Product::factory()->create();
        $this->store = Store::factory()->create();
    }

    #[Test]
    public function receiving_stock_creates_a_batch_a_movement_and_updates_the_projection(): void
    {
        $batch = $this->inventory->receive($this->product, $this->store, 10, 10_000);

        $this->assertEqualsWithDelta(10.0, (float) $batch->qty_in, 0.001);
        $this->assertEqualsWithDelta(10.0, (float) $batch->qty_left, 0.001);

        $this->assertEqualsWithDelta(10.0, $this->inventory->onHand($this->product, $this->store), 0.001);

        $this->assertDatabaseHas('product_store_stock', [
            'product_id' => $this->product->id,
            'store_id' => $this->store->id,
            'avg_cost' => 10_000,
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $this->product->id,
            'store_id' => $this->store->id,
            'batch_id' => $batch->id,
            'type' => StockMovement::TYPE_RECEIPT,
            'unit_cost' => 10_000,
        ]);
    }

    #[Test]
    public function issuing_consumes_batches_oldest_first_and_returns_fifo_cost(): void
    {
        $first = $this->inventory->receive($this->product, $this->store, 10, 10_000);
        $second = $this->inventory->receive($this->product, $this->store, 10, 15_000);

        // Weighted average of both layers: (10·10000 + 10·15000) / 20 = 12500.
        $this->assertDatabaseHas('product_store_stock', [
            'product_id' => $this->product->id,
            'avg_cost' => 12_500,
        ]);

        // Sell 15: 10 from the first layer @10000 + 5 from the second @15000.
        $costOfGoodsSold = $this->inventory->issue($this->product, $this->store, 15);

        $this->assertSame(10 * 10_000 + 5 * 15_000, $costOfGoodsSold);

        $this->assertEqualsWithDelta(0.0, (float) $first->refresh()->qty_left, 0.001);
        $this->assertEqualsWithDelta(5.0, (float) $second->refresh()->qty_left, 0.001);

        // Only the newer, pricier layer remains → projection reflects it.
        $this->assertEqualsWithDelta(5.0, $this->inventory->onHand($this->product, $this->store), 0.001);
        $this->assertDatabaseHas('product_store_stock', [
            'product_id' => $this->product->id,
            'avg_cost' => 15_000,
        ]);
    }

    #[Test]
    public function issuing_records_a_ledger_line_per_consumed_layer_with_running_balance(): void
    {
        $this->inventory->receive($this->product, $this->store, 10, 10_000);
        $this->inventory->receive($this->product, $this->store, 10, 15_000);

        $this->inventory->issue($this->product, $this->store, 15, StockMovement::TYPE_SALE);

        $sales = StockMovement::query()
            ->where('type', StockMovement::TYPE_SALE)
            ->orderBy('id')
            ->get();

        $this->assertCount(2, $sales);

        // First layer fully drawn: -10, balance 20 → 10.
        $this->assertEqualsWithDelta(-10.0, (float) $sales[0]->qty_delta, 0.001);
        $this->assertEqualsWithDelta(10.0, (float) $sales[0]->balance_after, 0.001);
        $this->assertSame(10_000, $sales[0]->unit_cost);

        // Second layer partially drawn: -5, balance 10 → 5.
        $this->assertEqualsWithDelta(-5.0, (float) $sales[1]->qty_delta, 0.001);
        $this->assertEqualsWithDelta(5.0, (float) $sales[1]->balance_after, 0.001);
        $this->assertSame(15_000, $sales[1]->unit_cost);
    }

    #[Test]
    public function issuing_more_than_available_throws_and_changes_nothing(): void
    {
        $batch = $this->inventory->receive($this->product, $this->store, 5, 10_000);

        try {
            $this->inventory->issue($this->product, $this->store, 10);
            $this->fail('Expected InsufficientStockException was not thrown.');
        } catch (InsufficientStockException $exception) {
            $this->assertSame(10.0, $exception->requested);
            $this->assertSame(5.0, $exception->available);
        }

        // Transaction rolled back: layer untouched, no sale movement written.
        $this->assertEqualsWithDelta(5.0, (float) $batch->refresh()->qty_left, 0.001);
        $this->assertEqualsWithDelta(5.0, $this->inventory->onHand($this->product, $this->store), 0.001);
        $this->assertDatabaseMissing('stock_movements', [
            'type' => StockMovement::TYPE_SALE,
        ]);
    }

    #[Test]
    public function issuing_the_exact_on_hand_quantity_empties_every_layer(): void
    {
        $this->inventory->receive($this->product, $this->store, 4, 10_000);
        $this->inventory->receive($this->product, $this->store, 6, 20_000);

        $costOfGoodsSold = $this->inventory->issue($this->product, $this->store, 10);

        $this->assertSame(4 * 10_000 + 6 * 20_000, $costOfGoodsSold);
        $this->assertEqualsWithDelta(0.0, $this->inventory->onHand($this->product, $this->store), 0.001);
        $this->assertSame(0, Batch::query()->where('qty_left', '>', 0)->count());

        // Empty warehouse → no average cost.
        $this->assertNull(ProductStoreStock::query()
            ->where('product_id', $this->product->id)
            ->where('store_id', $this->store->id)
            ->value('avg_cost'));
    }
}
