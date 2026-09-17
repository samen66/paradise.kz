<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Models\Batch;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Store;
use App\Services\Inventory\FifoInventoryService;
use App\Services\Inventory\GoodsReceiptService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Tests\TestCase;

class GoodsReceiptServiceTest extends TestCase
{
    use RefreshDatabase;

    private GoodsReceiptService $service;

    private FifoInventoryService $inventory;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(GoodsReceiptService::class);
        $this->inventory = app(FifoInventoryService::class);
    }

    #[Test]
    public function posting_a_receipt_creates_a_batch_and_movement_per_line_and_locks_it(): void
    {
        $store = Store::factory()->create();
        $productA = Product::factory()->create();
        $productB = Product::factory()->create();

        $receipt = GoodsReceipt::factory()->for($store, 'store')->create();
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create([
            'product_id' => $productA->id, 'quantity' => 10, 'unit_cost' => 10_000,
        ]);
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create([
            'product_id' => $productB->id, 'quantity' => 5, 'unit_cost' => 20_000,
        ]);

        $this->service->post($receipt);

        $receipt->refresh();
        $this->assertTrue($receipt->isPosted());
        $this->assertNotNull($receipt->posted_at);

        $batchA = Batch::query()->where('product_id', $productA->id)->sole();
        $this->assertEqualsWithDelta(10.0, (float) $batchA->qty_in, 0.001);
        $this->assertSame(10_000, $batchA->unit_cost);

        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $productA->id,
            'store_id' => $store->id,
            'type' => StockMovement::TYPE_RECEIPT,
            'documentable_type' => GoodsReceipt::class,
            'documentable_id' => $receipt->id,
        ]);

        $this->assertEqualsWithDelta(10.0, $this->inventory->onHand($productA, $store), 0.001);
        $this->assertEqualsWithDelta(5.0, $this->inventory->onHand($productB, $store), 0.001);
    }

    #[Test]
    public function posting_an_already_posted_receipt_throws_and_does_not_double_stock(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->create();

        $receipt = GoodsReceipt::factory()->for($store, 'store')->create();
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create([
            'product_id' => $product->id, 'quantity' => 5, 'unit_cost' => 10_000,
        ]);

        $this->service->post($receipt);
        $this->assertSame(1, Batch::query()->count());

        try {
            $this->service->post($receipt);
            $this->fail('Expected RuntimeException was not thrown.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Приёмка уже проведена.', $exception->getMessage());
        }

        // No second layer, on-hand unchanged.
        $this->assertSame(1, Batch::query()->count());
        $this->assertEqualsWithDelta(5.0, $this->inventory->onHand($product, $store), 0.001);
    }

    #[Test]
    public function a_stale_copy_cannot_post_the_receipt_a_second_time(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->create();

        $receipt = GoodsReceipt::factory()->for($store, 'store')->create();
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create([
            'product_id' => $product->id, 'quantity' => 5, 'unit_cost' => 10_000,
        ]);
        // Loaded before posting — as a second browser tab or Filament would hold it.
        $stale = GoodsReceipt::findOrFail($receipt->id);

        $this->service->post($receipt);

        try {
            $this->service->post($stale);
            $this->fail('Expected RuntimeException');
        } catch (RuntimeException $exception) {
            $this->assertSame('Приёмка уже проведена.', $exception->getMessage());
        }

        $this->assertEqualsWithDelta(5.0, $this->inventory->onHand($product, $store), 0.001);
        $this->assertSame(1, StockMovement::query()->where('documentable_id', $receipt->id)->where('documentable_type', GoodsReceipt::class)->count());
    }

    #[Test]
    public function posting_an_empty_receipt_throws(): void
    {
        $receipt = GoodsReceipt::factory()->create();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Нельзя провести пустую приёмку.');

        $this->service->post($receipt);
    }

    #[Test]
    public function line_cost_rounds_the_exact_half_up_instead_of_flooring_a_float_rounding_error(): void
    {
        // 0.820 * 75 = 61.5 exactly; half-up rounds to 62. A float multiply
        // ((float) '0.820' * 75 === 61.49999999999999) would floor to 61.
        $item = GoodsReceiptItem::factory()->create(['quantity' => '0.820', 'unit_cost' => 75]);

        $this->assertSame(62, $item->lineCost());
    }

    #[Test]
    public function line_cost_does_not_overflow_for_a_large_quantity_and_unit_cost(): void
    {
        // Both values sit near their validated maxima (quantity up to
        // 9999999.999, unit_cost up to 9999999999 тиын). A formula that
        // multiplies milli-quantity by unit_cost before dividing back down
        // overflows here: milli(1000000.001) = 1000000001, and
        // 1000000001 * 9999999999 = 10000000008999999999 — about 1.0e19,
        // past PHP_INT_MAX (~9.223e18) — while the true rounded line cost is
        // a modest 1.0e16 and must come out exact:
        //   1000000.001 * 9999999999 = 10000000008999999.999
        //   half-up -> 10000000009000000
        $item = GoodsReceiptItem::factory()->create([
            'quantity' => '1000000.001',
            'unit_cost' => 9_999_999_999,
        ]);

        $this->assertSame(10_000_000_009_000_000, $item->lineCost());
    }
}
