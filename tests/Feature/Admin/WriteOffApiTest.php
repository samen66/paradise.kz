<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Models\Store;
use App\Models\WriteOff;
use App\Models\WriteOffItem;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class WriteOffApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_write_offs(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/write-offs');
    }

    #[Test]
    public function a_draft_is_created_filtered_updated_partially_and_deleted(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create();

        $id = $this->postJson('/api/admin/write-offs', [
            'store_id' => $store->id,
            'reason' => 'damaged',
            'note' => 'Порван чехол',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.label', 'Списание №1')
            ->assertJsonPath('data.total_cost', null)
            ->json('data.id');

        WriteOff::factory()->create(['reason' => 'lost']);

        $this->getJson("/api/admin/write-offs?filter[reason]=damaged&filter[store_id]={$store->id}")
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.items_count', 0);

        $this->putJson("/api/admin/write-offs/{$id}", ['reason' => 'regrading'])
            ->assertOk()
            ->assertJsonPath('data.reason', 'regrading')
            ->assertJsonPath('data.note', 'Порван чехол');

        $this->deleteJson("/api/admin/write-offs/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('write_offs', ['id' => $id]);
    }

    #[Test]
    public function an_unknown_reason_is_refused(): void
    {
        $this->actingAsManager();
        Store::factory()->create();

        $this->postJson('/api/admin/write-offs', ['reason' => 'stolen'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason')
            ->assertJsonMissingValidationErrors('store_id');
    }

    #[Test]
    public function an_empty_body_creates_a_damaged_goods_draft_at_the_default_store(): void
    {
        $manager = $this->actingAsManager();
        Store::factory()->create(['name' => 'Б-другой']);
        $default = Store::factory()->create(['name' => 'Я-основной', 'is_default' => true]);

        $id = $this->postJson('/api/admin/write-offs', [])
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.reason', 'damaged')
            ->assertJsonPath('data.store.id', $default->id)
            ->json('data.id');

        $this->assertDatabaseHas('write_offs', ['id' => $id, 'user_id' => $manager->id]);
    }

    #[Test]
    public function without_an_active_store_a_write_off_is_refused(): void
    {
        $this->actingAsManager();

        $this->postJson('/api/admin/write-offs', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['store_id' => 'Нет активного места хранения.']);
    }

    #[Test]
    public function posting_issues_stock_and_reports_the_cost(): void
    {
        $manager = $this->actingAsManager();
        $store = Store::factory()->create();
        $product = Product::factory()->create();
        $inventory = app(FifoInventoryService::class);
        $inventory->receive($product, $store, 2, 10_000);
        $inventory->receive($product, $store, 2, 30_000);

        $writeOff = WriteOff::factory()->for($store, 'store')->create();
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create(['product_id' => $product->id, 'quantity' => 3]);

        $this->postJson("/api/admin/write-offs/{$writeOff->id}/post")
            ->assertOk()
            ->assertJsonPath('data.status', 'posted')
            ->assertJsonPath('data.user.id', $manager->id)
            ->assertJsonPath('data.total_cost', 50_000);

        $this->assertEqualsWithDelta(1.0, $inventory->onHand($product, $store), 0.001);

        $this->putJson("/api/admin/write-offs/{$writeOff->id}", ['note' => 'x'])->assertUnprocessable();
        $this->deleteJson("/api/admin/write-offs/{$writeOff->id}")->assertUnprocessable();
        $this->postJson("/api/admin/write-offs/{$writeOff->id}/post")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Списание уже проведено.');
    }

    #[Test]
    public function total_cost_rounds_per_movement_like_the_ledger(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create();
        $product = Product::factory()->create();
        $inventory = app(FifoInventoryService::class);
        // Two layers of 0.4 units at 1 тиын each: issue() rounds each draw
        // separately (round(0.4) + round(0.4) = 0), while summing the raw
        // movements first and rounding once gives round(0.8) = 1.
        $inventory->receive($product, $store, 0.4, 1);
        $inventory->receive($product, $store, 0.4, 1);

        $writeOff = WriteOff::factory()->for($store, 'store')->create();
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create(['product_id' => $product->id, 'quantity' => 0.8]);

        $this->postJson("/api/admin/write-offs/{$writeOff->id}/post")
            ->assertOk()
            ->assertJsonPath('data.total_cost', 0);
    }

    #[Test]
    public function a_shortage_is_explained_and_nothing_is_written(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create();
        $product = Product::factory()->create(['name' => ['ru' => 'Диван Атланта']]);
        app(FifoInventoryService::class)->receive($product, $store, 1.5, 10_000);

        $writeOff = WriteOff::factory()->for($store, 'store')->create();
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create(['product_id' => $product->id, 'quantity' => 2]);

        $this->postJson("/api/admin/write-offs/{$writeOff->id}/post")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Не хватает: Диван Атланта — нужно 2, доступно 1.5.');

        $this->assertFalse($writeOff->fresh()->isPosted());
    }

    #[Test]
    public function draft_write_offs_come_first(): void
    {
        $this->actingAsManager();
        $draftOld = WriteOff::factory()->create();
        $posted = WriteOff::factory()->posted()->create();
        $draftNew = WriteOff::factory()->create();

        $this->assertSame(
            [$draftNew->id, $draftOld->id, $posted->id],
            collect($this->getJson('/api/admin/write-offs')->assertOk()->json('data'))->pluck('id')->all(),
        );
    }
}
