<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
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
}
