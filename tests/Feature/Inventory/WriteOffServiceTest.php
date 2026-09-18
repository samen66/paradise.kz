<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\User;
use App\Models\WriteOff;
use App\Models\WriteOffItem;
use App\Services\Inventory\FifoInventoryService;
use App\Services\Inventory\InsufficientStockException;
use App\Services\Inventory\WriteOffService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Tests\TestCase;

class WriteOffServiceTest extends TestCase
{
    use RefreshDatabase;

    private WriteOffService $service;

    private FifoInventoryService $inventory;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(WriteOffService::class);
        $this->inventory = app(FifoInventoryService::class);
    }

    #[Test]
    public function posting_issues_stock_oldest_layer_first_and_marks_the_document(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->create();
        $user = User::factory()->create();

        $this->inventory->receive($product, $store, 2, 10_000);
        $this->inventory->receive($product, $store, 3, 20_000);

        $writeOff = WriteOff::factory()->for($store, 'store')->create();
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create(['product_id' => $product->id, 'quantity' => 4]);

        $this->service->post($writeOff, $user);

        $this->assertTrue($writeOff->isPosted());
        $fresh = $writeOff->fresh();
        $this->assertTrue($fresh->isPosted());
        $this->assertNotNull($fresh->posted_at);
        $this->assertSame($user->id, $fresh->user_id);

        $movements = StockMovement::query()
            ->where('type', StockMovement::TYPE_WRITE_OFF)
            ->where('documentable_type', WriteOff::class)
            ->where('documentable_id', $writeOff->id)
            ->orderBy('id')
            ->get();

        $this->assertCount(2, $movements);
        $this->assertEqualsWithDelta(-2.0, (float) $movements[0]->qty_delta, 0.001);
        $this->assertSame(10_000, (int) $movements[0]->unit_cost);
        $this->assertEqualsWithDelta(-2.0, (float) $movements[1]->qty_delta, 0.001);
        $this->assertSame(20_000, (int) $movements[1]->unit_cost);
        $this->assertSame($user->id, $movements[0]->user_id);

        $this->assertEqualsWithDelta(1.0, $this->inventory->onHand($product, $store), 0.001);
    }

    #[Test]
    public function a_shortage_on_any_line_rolls_back_every_line(): void
    {
        $store = Store::factory()->create();
        $enough = Product::factory()->create();
        $short = Product::factory()->create();

        $this->inventory->receive($enough, $store, 5, 10_000);
        $this->inventory->receive($short, $store, 1, 10_000);

        $writeOff = WriteOff::factory()->for($store, 'store')->create();
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create(['product_id' => $enough->id, 'quantity' => 2]);
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create(['product_id' => $short->id, 'quantity' => 3]);

        try {
            $this->service->post($writeOff);
            $this->fail('Expected InsufficientStockException');
        } catch (InsufficientStockException $exception) {
            $this->assertSame($short->id, $exception->product->id);
            $this->assertEqualsWithDelta(1.0, $exception->available, 0.001);
        }

        $this->assertFalse($writeOff->fresh()->isPosted());
        $this->assertEqualsWithDelta(5.0, $this->inventory->onHand($enough, $store), 0.001);
        $this->assertSame(0, StockMovement::query()->where('type', StockMovement::TYPE_WRITE_OFF)->count());
    }

    #[Test]
    public function a_posted_write_off_cannot_be_posted_again_even_from_a_stale_copy(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->create();
        $this->inventory->receive($product, $store, 5, 10_000);

        $writeOff = WriteOff::factory()->for($store, 'store')->create();
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create(['product_id' => $product->id, 'quantity' => 1]);
        $stale = WriteOff::findOrFail($writeOff->id);

        $this->service->post($writeOff);

        $this->expectException(RuntimeException::class);

        try {
            $this->service->post($stale);
        } finally {
            $this->assertEqualsWithDelta(4.0, $this->inventory->onHand($product, $store), 0.001);
        }
    }

    #[Test]
    public function an_empty_write_off_cannot_be_posted(): void
    {
        $writeOff = WriteOff::factory()->create();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Нельзя провести пустое списание.');

        $this->service->post($writeOff);
    }
}
