<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\Product;
use App\Models\Store;
use App\Models\WriteOff;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

/**
 * Сводка для вкладки «Обзор»: стоимость запаса, что заканчивается и
 * кончилось, черновики, последние движения, есть ли активный склад.
 */
class StockSummaryApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    private const URL = '/api/admin/stock/summary';

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        $this->actingAsManager();
        config(['inventory.low_stock_threshold' => 2]);
    }

    #[Test]
    public function an_empty_warehouse_reports_zeros(): void
    {
        $this->getJson(self::URL)->assertOk()
            ->assertJsonPath('data.total_value', 0)
            ->assertJsonPath('data.low', 0)
            ->assertJsonPath('data.out', 0)
            ->assertJsonPath('data.drafts', ['receipts' => 0, 'write_offs' => 0])
            ->assertJsonPath('data.recent_movements', [])
            ->assertJsonPath('data.has_active_store', false);
    }

    #[Test]
    public function it_sums_the_whole_warehouse(): void
    {
        $store = Store::factory()->create(['is_active' => true]);
        $inventory = app(FifoInventoryService::class);
        $sofa = Product::factory()->create(['stock' => 0]);
        $chair = Product::factory()->create(['stock' => 0]);
        Product::factory()->create(['stock' => 0]);
        $inventory->receive($sofa, $store, 5, 100_00);
        $inventory->receive($chair, $store, 1, 50_00);

        $this->getJson(self::URL)->assertOk()
            ->assertJsonPath('data.total_value', 5 * 100_00 + 50_00)
            ->assertJsonPath('data.low', 1)
            ->assertJsonPath('data.out', 1)
            ->assertJsonPath('data.has_active_store', true);
    }

    #[Test]
    public function it_counts_drafts_only(): void
    {
        GoodsReceipt::factory()->count(2)->create();
        GoodsReceipt::factory()->posted()->create();
        WriteOff::factory()->create();
        WriteOff::factory()->posted()->create();

        $this->getJson(self::URL)->assertOk()
            ->assertJsonPath('data.drafts', ['receipts' => 2, 'write_offs' => 1]);
    }

    #[Test]
    public function recent_movements_are_the_last_five_in_the_ledger_format(): void
    {
        $store = Store::factory()->create();
        $inventory = app(FifoInventoryService::class);
        $products = Product::factory()->count(6)->create(['stock' => 0]);

        foreach ($products as $product) {
            $inventory->receive($product, $store, 1, 100_00);
        }

        $movements = $this->getJson(self::URL)->assertOk()->json('data.recent_movements');

        $this->assertCount(5, $movements);
        $this->assertSame($products->last()->id, $movements[0]['product']['id']);
        $this->assertSame('receipt', $movements[0]['type']);
        $this->assertEqualsWithDelta(1.0, $movements[0]['qty_delta'], 0.001);
        $this->assertArrayHasKey('document', $movements[0]);
        $this->assertSame($store->name, $movements[0]['store']['name']);
    }

    #[Test]
    public function it_is_closed_to_everyone_but_staff(): void
    {
        $this->assertStaffOnly('GET', self::URL);
    }
}
