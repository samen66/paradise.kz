<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use App\Services\Inventory\FifoInventoryService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StockApiTest extends TestCase
{
    use RefreshDatabase;

    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->store = Store::factory()->create(['name' => 'Основной склад']);
    }

    private function actAsAdmin(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);
    }

    #[Test]
    public function it_lists_on_hand_stock_per_product_and_warehouse(): void
    {
        $this->actAsAdmin();

        $product = Product::factory()->create(['name' => 'Кровать Аврора', 'stock' => 0]);
        app(FifoInventoryService::class)->receive($product, $this->store, 6, 25_000);

        $response = $this->getJson('/api/admin/stock')->assertOk();

        $row = collect($response->json('data'))->firstWhere('product_id', $product->id);

        $this->assertNotNull($row);
        $this->assertEqualsWithDelta(6.0, (float) $row['stock'], 0.001);
        $this->assertSame(25_000, (int) $row['avg_cost']);
        $this->assertSame('Основной склад', $row['store']['name']);
    }

    #[Test]
    public function the_low_filter_surfaces_what_has_run_out(): void
    {
        $this->actAsAdmin();

        $stocked = Product::factory()->create(['stock' => 0]);
        $soldOut = Product::factory()->create(['stock' => 0]);

        $inventory = app(FifoInventoryService::class);
        $inventory->receive($stocked, $this->store, 4, 10_000);
        $inventory->receive($soldOut, $this->store, 2, 10_000);
        $inventory->issue($soldOut, $this->store, 2);

        $ids = collect($this->getJson('/api/admin/stock?filter[low]=0')->assertOk()->json('data'))
            ->pluck('product_id')
            ->all();

        $this->assertContains($soldOut->id, $ids);
        $this->assertNotContains($stocked->id, $ids);
    }

    #[Test]
    public function it_is_closed_to_everyone_but_staff(): void
    {
        $this->getJson('/api/admin/stock')->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create(['type' => User::TYPE_RETAIL]));
        $this->getJson('/api/admin/stock')->assertForbidden();
    }
}
