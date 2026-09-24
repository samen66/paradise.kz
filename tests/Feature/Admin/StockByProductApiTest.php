<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Models\Store;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

/**
 * Остатки по товару: строка — товар, итог по всем местам хранения (или по
 * выбранному), стоимость, статус «заканчивается / нет в наличии».
 */
class StockByProductApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    private const URL = '/api/admin/stock/products';

    private Store $showroom;

    private Store $warehouse;

    private FifoInventoryService $inventory;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        $this->actingAsManager();
        config(['inventory.low_stock_threshold' => 2]);

        $this->showroom = Store::factory()->create(['name' => 'Шоурум']);
        $this->warehouse = Store::factory()->create(['name' => 'Рыскулова']);
        $this->inventory = app(FifoInventoryService::class);
    }

    private function product(string $name, ?float $minStock = null): Product
    {
        return Product::factory()->create(['name' => ['ru' => $name], 'stock' => 0, 'min_stock' => $minStock]);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function row(array $rows, Product $product): ?array
    {
        return collect($rows)->firstWhere('id', $product->id);
    }

    #[Test]
    public function one_row_per_product_with_totals_and_a_store_breakdown(): void
    {
        $sofa = $this->product('Диван Осло');
        $this->inventory->receive($sofa, $this->showroom, 4, 178_000_00);
        $this->inventory->receive($sofa, $this->warehouse, 8, 181_000_00);

        $response = $this->getJson(self::URL)->assertOk();
        $row = $this->row($response->json('data'), $sofa);

        $this->assertNotNull($row);
        $this->assertCount(1, collect($response->json('data'))->where('id', $sofa->id));
        $this->assertEqualsWithDelta(12.0, $row['stock'], 0.001);
        $this->assertSame(4 * 178_000_00 + 8 * 181_000_00, $row['stock_value']);
        $this->assertSame((int) round((4 * 178_000_00 + 8 * 181_000_00) / 12), $row['avg_cost']);
        $this->assertSame('ok', $row['status']);
        $this->assertSame('Диван Осло', $row['product']['name']['ru']);
        $this->assertSame(['Шоурум', 'Рыскулова'], array_column($row['stores'], 'name'));
        $this->assertEqualsWithDelta(4.0, $row['stores'][0]['stock'], 0.001);
        $this->assertSame(4 * 178_000_00, $row['stores'][0]['stock_value']);
    }

    #[Test]
    public function a_product_never_received_is_listed_as_out(): void
    {
        $table = $this->product('Стол Лофт');

        $row = $this->row($this->getJson(self::URL)->assertOk()->json('data'), $table);

        $this->assertNotNull($row);
        $this->assertEqualsWithDelta(0.0, $row['stock'], 0.001);
        $this->assertSame('out', $row['status']);
        $this->assertNull($row['avg_cost']);
        $this->assertSame(0, $row['stock_value']);
        $this->assertSame([], $row['stores']);
    }

    #[Test]
    public function low_uses_the_product_minimum_or_the_default(): void
    {
        $chair = $this->product('Стул Вена', minStock: 10);
        $armchair = $this->product('Кресло Берн');
        $bed = $this->product('Кровать Аврора');
        $this->inventory->receive($chair, $this->showroom, 6, 10_000_00);
        $this->inventory->receive($armchair, $this->showroom, 2, 10_000_00);
        $this->inventory->receive($bed, $this->showroom, 3, 10_000_00);

        $rows = $this->getJson(self::URL)->assertOk()->json('data');

        $this->assertSame('low', $this->row($rows, $chair)['status']);
        $this->assertEqualsWithDelta(10.0, $this->row($rows, $chair)['min_stock'], 0.001);
        $this->assertSame('low', $this->row($rows, $armchair)['status']);
        $this->assertEqualsWithDelta(2.0, $this->row($rows, $armchair)['min_stock'], 0.001);
        $this->assertSame('ok', $this->row($rows, $bed)['status']);
    }

    #[Test]
    public function status_follows_the_selected_store(): void
    {
        $sofa = $this->product('Диван Осло');
        $this->inventory->receive($sofa, $this->warehouse, 8, 10_000_00);

        $all = $this->row($this->getJson(self::URL)->json('data'), $sofa);
        $showroomOnly = $this->row(
            $this->getJson(self::URL.'?filter[store_id]='.$this->showroom->id)->json('data'),
            $sofa,
        );

        $this->assertSame('ok', $all['status']);
        $this->assertSame('out', $showroomOnly['status']);
        $this->assertEqualsWithDelta(0.0, $showroomOnly['stock'], 0.001);
    }

    #[Test]
    public function the_store_breakdown_skips_empty_records(): void
    {
        $sofa = $this->product('Диван Осло');
        $this->inventory->receive($sofa, $this->showroom, 1, 10_000_00);
        $this->inventory->issue($sofa, $this->showroom, 1);
        $this->inventory->receive($sofa, $this->warehouse, 3, 10_000_00);

        $row = $this->row($this->getJson(self::URL)->json('data'), $sofa);

        $this->assertSame(['Рыскулова'], array_column($row['stores'], 'name'));
    }

    #[Test]
    public function composite_products_are_left_out(): void
    {
        $kit = $this->product('Комплект Гостиная');
        $this->inventory->receive($kit, $this->showroom, 5, 10_000_00);
        DB::table('products')->where('id', $kit->id)->update(['is_composite' => true]);

        $response = $this->getJson(self::URL)->assertOk();

        $this->assertNull($this->row($response->json('data'), $kit));
        $this->assertSame(0, $response->json('meta.counts.all'));
        $this->assertSame(0, $response->json('meta.total_value'));
    }

    #[Test]
    public function filters_by_status_search_and_product(): void
    {
        $sofa = $this->product('Диван Осло');
        $chair = $this->product('Стул Вена');
        $table = $this->product('Стол Лофт');
        $this->inventory->receive($sofa, $this->showroom, 9, 10_000_00);
        $this->inventory->receive($chair, $this->showroom, 1, 10_000_00);

        $ids = fn (string $query): array => array_column($this->getJson(self::URL.$query)->assertOk()->json('data'), 'id');

        $this->assertSame([$chair->id], $ids('?filter[status]=low'));
        $this->assertSame([$table->id], $ids('?filter[status]=out'));
        $this->assertSame([$sofa->id], $ids('?filter[search]='.rawurlencode('Осло')));
        $this->assertSame([$chair->id], $ids('?filter[product_id]='.$chair->id));
    }

    #[Test]
    public function counts_and_total_value_ignore_the_status_filter(): void
    {
        $sofa = $this->product('Диван Осло');
        $chair = $this->product('Стул Вена');
        $this->product('Стол Лофт');
        $this->inventory->receive($sofa, $this->showroom, 9, 10_000_00);
        $this->inventory->receive($chair, $this->showroom, 1, 5_000_00);

        $this->getJson(self::URL.'?filter[status]=out')
            ->assertOk()
            ->assertJsonPath('meta.counts', ['all' => 3, 'low' => 1, 'out' => 1])
            ->assertJsonPath('meta.total_value', 9 * 10_000_00 + 1 * 5_000_00)
            ->assertJsonCount(1, 'data');
    }

    #[Test]
    public function sorts_by_name_by_default_and_by_stock_on_request(): void
    {
        $b = $this->product('Бра Луна');
        $a = $this->product('Абажур Лён');
        $this->inventory->receive($b, $this->showroom, 5, 1_000_00);
        $this->inventory->receive($a, $this->showroom, 1, 1_000_00);

        $this->assertSame([$a->id, $b->id], array_column($this->getJson(self::URL)->json('data'), 'id'));
        $this->assertSame([$b->id, $a->id], array_column($this->getJson(self::URL.'?sort=-stock')->json('data'), 'id'));
        $this->assertSame([$a->id, $b->id], array_column($this->getJson(self::URL.'?sort=nonsense')->json('data'), 'id'));
    }

    #[Test]
    public function an_unknown_status_is_rejected(): void
    {
        $this->getJson(self::URL.'?filter[status]=foo')->assertUnprocessable();
    }

    #[Test]
    public function it_is_closed_to_everyone_but_staff(): void
    {
        $this->assertStaffOnly('GET', self::URL);
    }
}
