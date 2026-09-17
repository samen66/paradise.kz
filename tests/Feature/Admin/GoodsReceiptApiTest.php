<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\Store;
use App\Models\Supplier;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class GoodsReceiptApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_receipts(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/goods-receipts');
    }

    #[Test]
    public function it_lists_receipts_with_totals_and_filters(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create();
        $draft = GoodsReceipt::factory()->for($store, 'store')->create();
        GoodsReceiptItem::factory()->for($draft, 'goodsReceipt')->create(['quantity' => 2, 'unit_cost' => 150_000]);
        GoodsReceiptItem::factory()->for($draft, 'goodsReceipt')->create(['quantity' => 1.5, 'unit_cost' => 10_000]);
        GoodsReceipt::factory()->posted()->create();

        $this->getJson('/api/admin/goods-receipts')
            ->assertOk()
            ->assertJsonPath('total', 2);

        $this->getJson("/api/admin/goods-receipts?filter[status]=draft&filter[store_id]={$store->id}")
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $draft->id)
            ->assertJsonPath('data.0.items_count', 2)
            ->assertJsonPath('data.0.total_cost', 315_000)
            ->assertJsonPath('data.0.store.id', $store->id);
    }

    #[Test]
    public function a_draft_is_created_shown_updated_partially_and_deleted(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create();
        $supplier = Supplier::factory()->create();

        $id = $this->postJson('/api/admin/goods-receipts', [
            'store_id' => $store->id,
            'supplier_id' => $supplier->id,
            'number' => 'ПН-17',
            'received_at' => '2026-09-17 10:00:00',
            'note' => 'Первая партия',
        ])->assertCreated()->assertJsonPath('data.status', 'draft')->json('data.id');

        $this->putJson("/api/admin/goods-receipts/{$id}", ['number' => 'ПН-18'])
            ->assertOk()
            ->assertJsonPath('data.number', 'ПН-18')
            ->assertJsonPath('data.supplier.id', $supplier->id);

        $this->getJson("/api/admin/goods-receipts/{$id}")
            ->assertOk()
            ->assertJsonPath('data.store.id', $store->id)
            ->assertJsonPath('data.items', [])
            ->assertJsonPath('data.total_cost', 0);

        $this->deleteJson("/api/admin/goods-receipts/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('goods_receipts', ['id' => $id]);
    }

    #[Test]
    public function the_store_is_required_on_create(): void
    {
        $this->actingAsManager();

        $this->postJson('/api/admin/goods-receipts', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('store_id');
    }

    #[Test]
    public function posting_receives_the_stock_and_freezes_the_document(): void
    {
        $manager = $this->actingAsManager();
        $store = Store::factory()->create();
        $product = Product::factory()->create();
        $receipt = GoodsReceipt::factory()->for($store, 'store')->create();
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create(['product_id' => $product->id, 'quantity' => 3, 'unit_cost' => 50_000]);

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/post")
            ->assertOk()
            ->assertJsonPath('data.status', 'posted')
            ->assertJsonPath('data.user.id', $manager->id);

        $this->assertEqualsWithDelta(3.0, app(FifoInventoryService::class)->onHand($product, $store), 0.001);

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/post")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Приёмка уже проведена.');
        $this->putJson("/api/admin/goods-receipts/{$receipt->id}", ['number' => 'X'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Документ проведён — изменить нельзя.');
        $this->deleteJson("/api/admin/goods-receipts/{$receipt->id}")->assertUnprocessable();
        $this->assertEqualsWithDelta(3.0, app(FifoInventoryService::class)->onHand($product, $store), 0.001);
    }

    #[Test]
    public function an_empty_receipt_is_not_posted(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/post")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Нельзя провести пустую приёмку.');
    }
}
