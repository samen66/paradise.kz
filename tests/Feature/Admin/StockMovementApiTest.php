<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\Order;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\WriteOff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class StockMovementApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_read_movements(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/stock-movements');
    }

    #[Test]
    public function a_movement_is_presented_with_its_document(): void
    {
        $manager = $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create(['number' => 'ПН-7']);
        StockMovement::factory()->create([
            'store_id' => $receipt->store_id,
            'type' => StockMovement::TYPE_RECEIPT,
            'qty_delta' => 5,
            'unit_cost' => 10_000,
            'balance_after' => 5,
            'user_id' => $manager->id,
            'documentable_type' => GoodsReceipt::class,
            'documentable_id' => $receipt->id,
        ]);

        $this->getJson('/api/admin/stock-movements')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.type', 'receipt')
            ->assertJsonPath('data.0.qty_delta', 5)
            ->assertJsonPath('data.0.store.id', $receipt->store_id)
            ->assertJsonPath('data.0.user.id', $manager->id)
            ->assertJsonPath('data.0.document', ['type' => 'receipt', 'id' => $receipt->id, 'label' => 'Приёмка ПН-7']);
    }

    #[Test]
    public function write_off_and_order_documents_are_labelled(): void
    {
        $this->actingAsManager();
        $writeOff = WriteOff::factory()->create();
        $order = Order::factory()->create();
        StockMovement::factory()->create(['documentable_type' => WriteOff::class, 'documentable_id' => $writeOff->id, 'created_at' => now()->subMinute()]);
        StockMovement::factory()->create(['documentable_type' => Order::class, 'documentable_id' => $order->id, 'created_at' => now()]);
        StockMovement::factory()->create(['documentable_type' => null, 'documentable_id' => null, 'created_at' => now()->subHour()]);

        $response = $this->getJson('/api/admin/stock-movements')->assertOk();

        $response->assertJsonPath('data.0.document', ['type' => 'order', 'id' => $order->id, 'label' => 'Заказ '.$order->fresh()->number]);
        $response->assertJsonPath('data.1.document', ['type' => 'write_off', 'id' => $writeOff->id, 'label' => 'Списание №'.$writeOff->id]);
        $response->assertJsonPath('data.2.document', null);
    }

    #[Test]
    public function movements_are_filtered(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create();
        $product = Product::factory()->create();
        $receipt = GoodsReceipt::factory()->create();

        $match = StockMovement::factory()->create([
            'store_id' => $store->id,
            'product_id' => $product->id,
            'type' => StockMovement::TYPE_WRITE_OFF,
            'created_at' => Carbon::parse('2026-09-10 12:00:00'),
        ]);
        StockMovement::factory()->create(['store_id' => $store->id, 'product_id' => $product->id, 'type' => StockMovement::TYPE_SALE, 'created_at' => Carbon::parse('2026-09-10 13:00:00')]);
        StockMovement::factory()->create(['product_id' => $product->id, 'type' => StockMovement::TYPE_WRITE_OFF, 'created_at' => Carbon::parse('2026-09-10 14:00:00')]);
        StockMovement::factory()->create(['store_id' => $store->id, 'product_id' => $product->id, 'type' => StockMovement::TYPE_WRITE_OFF, 'created_at' => Carbon::parse('2026-09-12 09:00:00')]);
        $byDocument = StockMovement::factory()->create(['documentable_type' => GoodsReceipt::class, 'documentable_id' => $receipt->id]);

        $this->getJson("/api/admin/stock-movements?filter[store_id]={$store->id}&filter[product_id]={$product->id}&filter[type]=write_off&filter[from]=2026-09-10&filter[to]=2026-09-10")
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $match->id);

        $this->getJson("/api/admin/stock-movements?filter[document]=receipt:{$receipt->id}")
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $byDocument->id);
    }

    #[Test]
    public function from_and_to_as_exact_instants_follow_the_managers_local_day(): void
    {
        $this->actingAsManager();

        // 2026-09-16 19:30 UTC is 2026-09-17 00:30 in Almaty (UTC+5): inside
        // the manager's "17.09" day.
        $inAlmatyDay = StockMovement::factory()->create(['created_at' => Carbon::parse('2026-09-16 19:30:00', 'UTC')]);
        // 2026-09-17 19:30 UTC is 2026-09-18 00:30 in Almaty: outside it.
        StockMovement::factory()->create(['created_at' => Carbon::parse('2026-09-17 19:30:00', 'UTC')]);

        $this->getJson('/api/admin/stock-movements?filter[from]=2026-09-17T00:00:00%2B05:00&filter[to]=2026-09-17T23:59:59%2B05:00')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $inAlmatyDay->id);
    }

    #[Test]
    public function an_unknown_document_kind_matches_nothing(): void
    {
        $this->actingAsManager();
        StockMovement::factory()->create();

        $this->getJson('/api/admin/stock-movements?filter[document]=invoice:1')
            ->assertOk()
            ->assertJsonPath('total', 0);
    }

    #[Test]
    public function an_invalid_date_filter_matches_nothing_instead_of_erroring(): void
    {
        $this->actingAsManager();
        StockMovement::factory()->create();

        $this->getJson('/api/admin/stock-movements?filter[from]=not-a-date')
            ->assertOk()
            ->assertJsonPath('total', 0);
    }
}
