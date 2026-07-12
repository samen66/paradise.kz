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
    public function posting_an_empty_receipt_throws(): void
    {
        $receipt = GoodsReceipt::factory()->create();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Нельзя провести пустую приёмку.');

        $this->service->post($receipt);
    }
}
