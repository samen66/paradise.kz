<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\Store;
use App\Services\Inventory\SuggestedUnitCost;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SuggestedUnitCostTest extends TestCase
{
    use RefreshDatabase;

    private function receiptLine(Product $product, Store $store, int $unitCost, ?string $postedAt): void
    {
        $receipt = GoodsReceipt::factory()->for($store, 'store')->create([
            'status' => $postedAt === null ? GoodsReceipt::STATUS_DRAFT : GoodsReceipt::STATUS_POSTED,
            'posted_at' => $postedAt,
        ]);
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create(['product_id' => $product->id, 'unit_cost' => $unitCost]);
    }

    #[Test]
    public function the_latest_posted_receipt_wins_on_any_store(): void
    {
        $product = Product::factory()->create();
        $here = Store::factory()->create();
        $there = Store::factory()->create();
        $this->receiptLine($product, $here, 100_000, '2026-09-01 10:00:00');
        $this->receiptLine($product, $there, 120_000, '2026-09-20 10:00:00');
        $this->receiptLine($product, $here, 999_999, null);
        ProductStoreStock::factory()->create(['product_id' => $product->id, 'store_id' => $here->id, 'stock' => 3, 'avg_cost' => 70_000]);

        $this->assertSame(120_000, app(SuggestedUnitCost::class)->for($product->id, $here->id));
    }

    #[Test]
    public function without_posted_receipts_the_store_average_cost_is_used(): void
    {
        $product = Product::factory()->create();
        $here = Store::factory()->create();
        $there = Store::factory()->create();
        $this->receiptLine($product, $here, 999_999, null);
        ProductStoreStock::factory()->create(['product_id' => $product->id, 'store_id' => $here->id, 'stock' => 3, 'avg_cost' => 70_000]);
        ProductStoreStock::factory()->create(['product_id' => $product->id, 'store_id' => $there->id, 'stock' => 3, 'avg_cost' => 90_000]);

        $this->assertSame(70_000, app(SuggestedUnitCost::class)->for($product->id, $here->id));
    }

    #[Test]
    public function a_product_with_no_history_costs_zero(): void
    {
        $product = Product::factory()->create();
        $store = Store::factory()->create();

        $this->assertSame(0, app(SuggestedUnitCost::class)->for($product->id, $store->id));
    }

    #[Test]
    public function for_many_answers_every_requested_product(): void
    {
        $known = Product::factory()->create();
        $unknown = Product::factory()->create();
        $store = Store::factory()->create();
        $this->receiptLine($known, $store, 55_000, '2026-09-20 10:00:00');

        $this->assertSame(
            [$known->id => 55_000, $unknown->id => 0],
            app(SuggestedUnitCost::class)->forMany([$known->id, $unknown->id], $store->id),
        );
        $this->assertSame([], app(SuggestedUnitCost::class)->forMany([], $store->id));
    }
}
