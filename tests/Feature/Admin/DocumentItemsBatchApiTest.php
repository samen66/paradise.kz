<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\WriteOff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class DocumentItemsBatchApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_add_a_batch(): void
    {
        $receipt = GoodsReceipt::factory()->create();

        $this->assertStaffOnly('POST', "/api/admin/goods-receipts/{$receipt->id}/items/batch", ['items' => []]);
    }

    #[Test]
    public function a_receipt_batch_adds_new_lines_and_merges_repeats(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        [$a, $b, $c] = Product::factory()->count(3)->create()->all();
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create(['product_id' => $a->id, 'quantity' => '2', 'unit_cost' => 10_000]);
        $earlier = GoodsReceipt::factory()->posted()->create();
        GoodsReceiptItem::factory()->for($earlier, 'goodsReceipt')->create(['product_id' => $c->id, 'unit_cost' => 50_000]);

        $lines = collect($this->postJson("/api/admin/goods-receipts/{$receipt->id}/items/batch", ['items' => [
            ['product_id' => $a->id, 'quantity' => 1],
            ['product_id' => $b->id, 'quantity' => '3'],
            ['product_id' => $b->id, 'quantity' => '2.5'],
            ['product_id' => $c->id],
        ]])->assertOk()->assertJsonCount(3, 'data')->json('data'))->keyBy('product_id');

        $this->assertSame('3.000', $lines[$a->id]['quantity']);
        $this->assertSame(10_000, $lines[$a->id]['unit_cost']);
        $this->assertSame('5.500', $lines[$b->id]['quantity']);
        $this->assertSame('1.000', $lines[$c->id]['quantity']);
        $this->assertSame(50_000, $lines[$c->id]['unit_cost']);
        $this->assertSame($c->id, $lines[$c->id]['product']['id']);
    }

    #[Test]
    public function a_write_off_batch_answers_with_what_is_available(): void
    {
        $this->actingAsManager();
        $writeOff = WriteOff::factory()->create();
        $product = Product::factory()->create();
        ProductStoreStock::factory()->create(['product_id' => $product->id, 'store_id' => $writeOff->store_id, 'stock' => 4]);

        $this->postJson("/api/admin/write-offs/{$writeOff->id}/items/batch", ['items' => [['product_id' => $product->id, 'quantity' => 2]]])
            ->assertOk()
            ->assertJsonPath('data.0.quantity', '2.000')
            ->assertJsonPath('data.0.available', 4);
    }

    #[Test]
    public function the_batch_is_validated(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        $product = Product::factory()->create();

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items/batch", ['items' => []])
            ->assertUnprocessable()->assertJsonValidationErrors('items');

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items/batch", [
            'items' => array_fill(0, 201, ['product_id' => $product->id]),
        ])->assertUnprocessable()->assertJsonValidationErrors('items');

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items/batch", ['items' => [
            ['product_id' => 999_999],
            ['product_id' => $product->id, 'quantity' => 0],
        ]])->assertUnprocessable()->assertJsonValidationErrors(['items.0.product_id', 'items.1.quantity']);

        $this->assertSame(0, $receipt->items()->count());
    }

    #[Test]
    public function an_overflowing_batch_saves_nothing(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        $full = GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create(['quantity' => '9999999.000']);
        $other = Product::factory()->create();

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items/batch", ['items' => [
            ['product_id' => $other->id, 'quantity' => 1],
            ['product_id' => $full->product_id, 'quantity' => 1],
        ]])->assertUnprocessable()->assertJsonValidationErrors('quantity');

        $this->assertSame(1, $receipt->items()->count());
        $this->assertSame('9999999.000', $full->fresh()->quantity);
    }

    #[Test]
    public function a_posted_document_takes_no_batch(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->posted()->create();

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items/batch", ['items' => [['product_id' => Product::factory()->create()->id]]])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Документ проведён — изменить нельзя.');

        $this->assertSame(0, $receipt->items()->count());
    }
}
