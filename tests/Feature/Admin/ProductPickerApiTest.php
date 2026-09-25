<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Category;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ProductPickerApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        $this->store = Store::factory()->create();
    }

    /**
     * @return list<int>
     */
    private function ids(string $query = ''): array
    {
        return collect($this->getJson("/api/admin/product-picker?store_id={$this->store->id}{$query}")->assertOk()->json('data'))
            ->pluck('id')
            ->all();
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function product(string $name, array $attributes = []): Product
    {
        return Product::factory()->create(['name' => ['ru' => $name], ...$attributes]);
    }

    private function receivedAt(Product $product, Store $store, string $receivedAt): void
    {
        $receipt = GoodsReceipt::factory()->for($store, 'store')->create(['received_at' => $receivedAt]);
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create(['product_id' => $product->id]);
    }

    #[Test]
    public function only_staff_may_pick_products(): void
    {
        $this->assertStaffOnly('GET', "/api/admin/product-picker?store_id={$this->store->id}");
    }

    #[Test]
    public function the_store_is_required(): void
    {
        $this->actingAsManager();

        $this->getJson('/api/admin/product-picker')->assertUnprocessable()->assertJsonValidationErrors('store_id');
    }

    #[Test]
    public function rows_carry_the_documents_store_stock_and_skip_composites(): void
    {
        $this->actingAsManager();
        $other = Store::factory()->create();
        $sofa = $this->product('Диван', ['code' => 'S-1', 'article' => 'A-1', 'uom' => 'шт']);
        $table = $this->product('Стол');
        $kit = $this->product('Гарнитур');
        DB::table('products')->where('id', $kit->id)->update(['is_composite' => true]);
        ProductStoreStock::factory()->create(['product_id' => $sofa->id, 'store_id' => $this->store->id, 'stock' => 5, 'avg_cost' => 70_000]);
        ProductStoreStock::factory()->create(['product_id' => $sofa->id, 'store_id' => $other->id, 'stock' => 7]);

        $response = $this->getJson("/api/admin/product-picker?store_id={$this->store->id}")
            ->assertOk()
            ->assertJsonPath('per_page', 30)
            ->assertJsonPath('total', 2);

        $this->assertSame([$sofa->id, $table->id], collect($response->json('data'))->pluck('id')->all());
        $response->assertJsonPath('data.0.name.ru', 'Диван')
            ->assertJsonPath('data.0.code', 'S-1')
            ->assertJsonPath('data.0.article', 'A-1')
            ->assertJsonPath('data.0.uom', 'шт')
            ->assertJsonPath('data.0.on_hand', 5)
            ->assertJsonPath('data.0.suggested_unit_cost', 70_000)
            ->assertJsonPath('data.1.on_hand', 0)
            ->assertJsonPath('data.1.suggested_unit_cost', 0);
    }

    #[Test]
    public function search_ignores_letter_case(): void
    {
        $this->actingAsManager();
        $sofa = $this->product('Диван Осло');
        $this->product('Стол');

        $this->assertSame([$sofa->id], $this->ids('&filter[search]='.rawurlencode('диван')));
    }

    #[Test]
    public function a_category_includes_its_subcategories(): void
    {
        $this->actingAsManager();
        $furniture = Category::factory()->create();
        $sofas = Category::factory()->create(['parent_id' => $furniture->id]);
        $lamps = Category::factory()->create();
        $chair = $this->product('Кресло', ['category_id' => $furniture->id]);
        $sofa = $this->product('Диван', ['category_id' => $sofas->id]);
        $this->product('Лампа', ['category_id' => $lamps->id]);

        $this->assertSame([$sofa->id, $chair->id], $this->ids("&filter[category_id]={$furniture->id}"));
    }

    #[Test]
    public function recent_lists_products_received_at_this_store_newest_first(): void
    {
        $this->actingAsManager();
        $older = $this->product('А старый');
        $newer = $this->product('Б новый');
        $elsewhere = $this->product('В на другом складе');
        $this->product('Г не принимали');
        $this->receivedAt($older, $this->store, '2026-09-20 10:00:00');
        $this->receivedAt($newer, $this->store, '2026-09-24 10:00:00');
        $this->receivedAt($elsewhere, Store::factory()->create(), '2026-09-25 10:00:00');

        $this->assertSame([$newer->id, $older->id], $this->ids('&filter[recent]=1'));
    }

    #[Test]
    public function in_stock_keeps_only_what_is_on_hand_at_the_store(): void
    {
        $this->actingAsManager();
        $sofa = $this->product('Диван');
        $table = $this->product('Стол');
        ProductStoreStock::factory()->create(['product_id' => $sofa->id, 'store_id' => $this->store->id, 'stock' => 2]);
        ProductStoreStock::factory()->create(['product_id' => $table->id, 'store_id' => $this->store->id, 'stock' => 0]);

        $this->assertSame([$sofa->id], $this->ids('&filter[in_stock]=1'));
    }

    #[Test]
    public function the_list_is_paged_by_thirty(): void
    {
        $this->actingAsManager();
        Product::factory()->count(31)->create();

        $this->getJson("/api/admin/product-picker?store_id={$this->store->id}&page=2")
            ->assertOk()
            ->assertJsonPath('total', 31)
            ->assertJsonPath('last_page', 2)
            ->assertJsonCount(1, 'data');
    }
}
