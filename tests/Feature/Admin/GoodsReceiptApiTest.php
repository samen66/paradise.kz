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
use Illuminate\Support\Carbon;
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
    public function total_cost_rounds_half_up_exactly_in_the_list_and_the_show_response(): void
    {
        // quantity 0.820 x unit_cost 75 = 61.5 exactly; half-up rounds to 62.
        // A naive `(float) '0.820' * 75` is 61.49999999999999 in PHP, which
        // floors to 61 — this line is the regression guard for that.
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create(['quantity' => '0.820', 'unit_cost' => 75]);

        $this->getJson('/api/admin/goods-receipts')
            ->assertOk()
            ->assertJsonPath('data.0.id', $receipt->id)
            ->assertJsonPath('data.0.total_cost', 62);

        $this->getJson("/api/admin/goods-receipts/{$receipt->id}")
            ->assertOk()
            ->assertJsonPath('data.total_cost', 62);
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
    public function an_empty_body_creates_a_draft_with_defaults(): void
    {
        Carbon::setTestNow('2026-09-25 10:32:00');
        $manager = $this->actingAsManager();
        Store::factory()->inactive()->create(['name' => 'А-закрыт', 'is_default' => true]);
        $default = Store::factory()->create(['name' => 'Я-основной', 'is_default' => true]);
        Store::factory()->create(['name' => 'Б-другой']);
        $usual = Supplier::factory()->create();
        GoodsReceipt::factory()->create(['user_id' => $manager->id, 'supplier_id' => $usual->id]);
        GoodsReceipt::factory()->create(['user_id' => $manager->id, 'supplier_id' => null]);
        GoodsReceipt::factory()->create(['supplier_id' => Supplier::factory()->create()->id]);

        $id = $this->postJson('/api/admin/goods-receipts', [])
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.store.id', $default->id)
            ->assertJsonPath('data.supplier.id', $usual->id)
            ->json('data.id');

        $receipt = GoodsReceipt::findOrFail($id);
        $this->assertSame($manager->id, $receipt->user_id);
        $this->assertSame('2026-09-25 10:32:00', $receipt->received_at->format('Y-m-d H:i:s'));
    }

    #[Test]
    public function an_explicit_store_and_no_supplier_are_kept(): void
    {
        $manager = $this->actingAsManager();
        Store::factory()->create(['is_default' => true]);
        $chosen = Store::factory()->create();
        GoodsReceipt::factory()->create(['user_id' => $manager->id, 'supplier_id' => Supplier::factory()->create()->id]);

        $this->postJson('/api/admin/goods-receipts', ['store_id' => $chosen->id, 'supplier_id' => null])
            ->assertCreated()
            ->assertJsonPath('data.store.id', $chosen->id)
            ->assertJsonPath('data.supplier', null);
    }

    #[Test]
    public function the_managers_preferred_store_comes_before_the_default(): void
    {
        $manager = $this->actingAsManager();
        Store::factory()->create(['is_default' => true]);
        $preferred = Store::factory()->create();
        $manager->update(['preferred_store_id' => $preferred->id]);

        $this->postJson('/api/admin/goods-receipts', [])
            ->assertCreated()
            ->assertJsonPath('data.store.id', $preferred->id);
    }

    #[Test]
    public function without_an_active_store_a_receipt_is_refused(): void
    {
        $this->actingAsManager();
        Store::factory()->inactive()->create();

        $this->postJson('/api/admin/goods-receipts', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['store_id' => 'Нет активного места хранения.']);
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

    #[Test]
    public function drafts_come_first_then_the_newest(): void
    {
        $this->actingAsManager();
        $postedNew = GoodsReceipt::factory()->posted()->create(['received_at' => '2026-09-25 10:00:00']);
        $draftOld = GoodsReceipt::factory()->create(['received_at' => '2026-09-01 10:00:00']);
        $draftNew = GoodsReceipt::factory()->create(['received_at' => '2026-09-20 10:00:00']);
        $postedOld = GoodsReceipt::factory()->posted()->create(['received_at' => '2026-09-02 10:00:00']);

        $this->assertSame(
            [$draftNew->id, $draftOld->id, $postedNew->id, $postedOld->id],
            collect($this->getJson('/api/admin/goods-receipts')->assertOk()->json('data'))->pluck('id')->all(),
        );
    }
}
