<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Events\ProductUpdated;
use App\Jobs\RevalidateStorefrontCacheJob;
use App\Models\CatalogSetting;
use App\Models\Product;
use App\Models\Store;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * FifoInventoryService writes `products.stock` with a raw UPDATE, so the
 * ProductObserver never sees a stock change. Without an explicit announcement
 * the storefront kept showing the old quantity: no live ProductUpdated
 * broadcast and no purge of the cached catalog pages.
 */
class StockChangeBroadcastTest extends TestCase
{
    use RefreshDatabase;

    private FifoInventoryService $inventory;

    private Product $product;

    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();

        $this->inventory = app(FifoInventoryService::class);
        $this->product = Product::factory()->create(['stock' => 0]);
        $this->store = Store::factory()->create();

        Event::fake([ProductUpdated::class]);
        Queue::fake();
    }

    #[Test]
    public function receiving_stock_broadcasts_the_new_quantity(): void
    {
        $this->inventory->receive($this->product, $this->store, 12, 10_000);

        Event::assertDispatched(
            ProductUpdated::class,
            fn (ProductUpdated $event): bool => $event->product->is($this->product)
                && abs((float) $event->product->stock - 12.0) < 0.001,
        );
    }

    #[Test]
    public function issuing_stock_broadcasts_the_new_quantity(): void
    {
        $this->inventory->receive($this->product, $this->store, 12, 10_000);
        $this->inventory->issue($this->product, $this->store, 5);

        Event::assertDispatched(
            ProductUpdated::class,
            fn (ProductUpdated $event): bool => abs((float) $event->product->stock - 7.0) < 0.001,
        );
    }

    #[Test]
    public function the_broadcast_carries_the_storefront_warehouse_stock_next_to_the_aggregate(): void
    {
        // Guests browse without a store_id, so the storefront shows the
        // default warehouse — the live figure must be that one, not the sum.
        $default = Store::factory()->create(['is_active' => true, 'is_default' => true]);
        $this->inventory->receive($this->product, $default, 7, 10_000);
        $this->inventory->receive($this->product, $this->store, 30, 10_000);

        $payload = (new ProductUpdated($this->product->fresh()))->broadcastWith();

        $this->assertEqualsWithDelta(37.0, $payload['stock'], 0.001);
        $this->assertEqualsWithDelta(7.0, $payload['retail_stock'], 0.001);
        $this->assertTrue($payload['retail_in_stock']);
    }

    #[Test]
    public function the_broadcast_hides_the_retail_quantity_when_the_catalog_setting_does(): void
    {
        CatalogSetting::current()->update(['show_stock_quantity' => false]);
        $this->inventory->receive($this->product, $this->store, 4, 10_000);

        $payload = (new ProductUpdated($this->product->fresh()))->broadcastWith();

        $this->assertNull($payload['retail_stock']);
        $this->assertTrue($payload['retail_in_stock']);
    }

    #[Test]
    public function a_stock_change_purges_the_storefront_catalog_cache(): void
    {
        $this->inventory->receive($this->product, $this->store, 3, 10_000);

        Queue::assertPushed(RevalidateStorefrontCacheJob::class);
    }
}
