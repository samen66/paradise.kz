<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\ProductStoreStock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class GoodsReceiptItemApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_receipt_lines(): void
    {
        $receipt = GoodsReceipt::factory()->create();

        $this->assertStaffOnly('GET', "/api/admin/goods-receipts/{$receipt->id}/items");
    }

    #[Test]
    public function a_line_is_added_in_tenge_updated_partially_and_removed(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        $product = Product::factory()->create();

        $id = $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", [
            'product_id' => $product->id,
            'quantity' => '2.5',
            'unit_cost' => '1500.50',
        ])->assertCreated()->assertJsonPath('data.product.id', $product->id)->json('data.id');

        $this->assertSame(150_050, GoodsReceiptItem::findOrFail($id)->unit_cost);

        $this->putJson("/api/admin/goods-receipts/{$receipt->id}/items/{$id}", ['quantity' => 3])
            ->assertOk()
            ->assertJsonPath('data.unit_cost', 150_050);
        $this->assertSame('3.000', GoodsReceiptItem::findOrFail($id)->quantity);

        $this->getJson("/api/admin/goods-receipts/{$receipt->id}/items")->assertOk()->assertJsonCount(1, 'data');

        $this->deleteJson("/api/admin/goods-receipts/{$receipt->id}/items/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('goods_receipt_items', ['id' => $id]);
    }

    #[Test]
    public function quantity_and_cost_are_validated(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        $product = Product::factory()->create();

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", [
            'product_id' => $product->id,
            'quantity' => 0,
            'unit_cost' => '1.005',
        ])->assertUnprocessable()->assertJsonValidationErrors(['quantity', 'unit_cost']);

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", [
            'product_id' => $product->id,
            'quantity' => '1.0005',
            'unit_cost' => 1,
        ])->assertUnprocessable()->assertJsonValidationErrors('quantity');
    }

    #[Test]
    public function lines_of_a_posted_receipt_are_frozen(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->posted()->create();
        $item = GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create();

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", [
            'product_id' => Product::factory()->create()->id, 'quantity' => 1, 'unit_cost' => 1,
        ])->assertUnprocessable();
        $this->putJson("/api/admin/goods-receipts/{$receipt->id}/items/{$item->id}", ['quantity' => 9])->assertUnprocessable();
        $this->deleteJson("/api/admin/goods-receipts/{$receipt->id}/items/{$item->id}")->assertUnprocessable();

        $this->assertDatabaseHas('goods_receipt_items', ['id' => $item->id]);
    }

    #[Test]
    public function another_receipts_line_is_not_found(): void
    {
        $this->actingAsManager();
        $foreign = GoodsReceiptItem::factory()->create();
        $receipt = GoodsReceipt::factory()->create();

        $this->deleteJson("/api/admin/goods-receipts/{$receipt->id}/items/{$foreign->id}")->assertNotFound();
    }

    #[Test]
    public function a_line_needs_only_the_product(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $earlier = GoodsReceipt::factory()->posted()->create(['posted_at' => '2026-09-20 10:00:00']);
        GoodsReceiptItem::factory()->for($earlier, 'goodsReceipt')->create(['product_id' => $product->id, 'unit_cost' => 120_000]);
        $receipt = GoodsReceipt::factory()->create();

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", ['product_id' => $product->id])
            ->assertCreated()
            ->assertJsonPath('data.quantity', '1.000')
            ->assertJsonPath('data.unit_cost', 120_000)
            ->assertJsonPath('data.product.id', $product->id);
    }

    #[Test]
    public function without_history_the_line_costs_the_store_average_or_zero(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        $averaged = Product::factory()->create();
        $fresh = Product::factory()->create();
        ProductStoreStock::factory()->create(['product_id' => $averaged->id, 'store_id' => $receipt->store_id, 'stock' => 2, 'avg_cost' => 70_000]);

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", ['product_id' => $averaged->id])
            ->assertCreated()
            ->assertJsonPath('data.unit_cost', 70_000);
        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", ['product_id' => $fresh->id])
            ->assertCreated()
            ->assertJsonPath('data.unit_cost', 0);
    }

    #[Test]
    public function adding_a_product_again_raises_its_line_instead_of_a_second_one(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        $product = Product::factory()->create();

        $id = $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", [
            'product_id' => $product->id, 'quantity' => '2', 'unit_cost' => '1500',
        ])->assertCreated()->json('data.id');

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", ['product_id' => $product->id, 'unit_cost' => '9'])
            ->assertOk()
            ->assertJsonPath('data.id', $id)
            ->assertJsonPath('data.quantity', '3.000')
            ->assertJsonPath('data.unit_cost', 150_000);

        $this->assertSame(1, $receipt->items()->count());
    }

    #[Test]
    public function merging_past_the_maximum_quantity_is_refused(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        $item = GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create(['quantity' => '9999999.000']);

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", ['product_id' => $item->product_id, 'quantity' => '1.5'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('quantity');

        $this->assertSame('9999999.000', $item->fresh()->quantity);
    }
}
