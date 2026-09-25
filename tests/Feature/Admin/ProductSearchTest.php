<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Support\ProductSearch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ProductSearchTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        $this->actingAsManager();
    }

    /**
     * @return list<int>
     */
    private function productIds(string $search): array
    {
        return collect($this->getJson('/api/admin/products?filter[search]='.rawurlencode($search))->assertOk()->json('data'))
            ->pluck('id')
            ->all();
    }

    /**
     * @return list<int>
     */
    private function stockIds(string $search): array
    {
        return collect($this->getJson('/api/admin/stock/products?filter[search]='.rawurlencode($search))->assertOk()->json('data'))
            ->pluck('product.id')
            ->all();
    }

    #[Test]
    public function any_letter_case_finds_a_cyrillic_name(): void
    {
        $sofa = Product::factory()->create(['name' => ['ru' => 'Диван Осло']]);
        Product::factory()->create(['name' => ['ru' => 'Стол Лофт']]);

        foreach (['диван', 'ДИВАН', 'Диван', 'осло'] as $search) {
            $this->assertSame([$sofa->id], $this->productIds($search), "admin/products: {$search}");
            $this->assertSame([$sofa->id], $this->stockIds($search), "stock/products: {$search}");
        }
    }

    #[Test]
    public function the_kazakh_name_code_and_article_are_searched(): void
    {
        $product = Product::factory()->create([
            'name' => ['ru' => 'Кресло', 'kk' => 'Орындық'],
            'code' => 'PX-501',
            'article' => 'ART-Берн',
        ]);
        Product::factory()->create(['name' => ['ru' => 'Стул'], 'code' => 'Z-1', 'article' => 'Z-2']);

        foreach (['орындық', 'px-501', 'берн'] as $search) {
            $this->assertSame([$product->id], $this->productIds($search), $search);
        }
    }

    #[Test]
    public function renaming_a_product_updates_what_it_is_found_by(): void
    {
        $product = Product::factory()->create(['name' => ['ru' => 'Тумба']]);

        $product->setTranslation('name', 'ru', 'Комод')->save();

        $this->assertSame([], $this->productIds('тумба'));
        $this->assertSame([$product->id], $this->productIds('комод'));
    }

    #[Test]
    public function percent_and_underscore_are_searched_literally(): void
    {
        $discounted = Product::factory()->create(['name' => ['ru' => 'Стол скидка 100%'], 'code' => 'A1', 'article' => 'B1']);
        Product::factory()->create(['name' => ['ru' => 'Стул'], 'code' => 'A2', 'article' => 'B2']);

        $this->assertSame([$discounted->id], $this->productIds('100%'));
        $this->assertSame([], $this->productIds('_'));
    }

    #[Test]
    public function a_comma_in_the_search_is_kept(): void
    {
        $sofa = Product::factory()->create(['name' => ['ru' => 'Диван 2,5 м']]);
        Product::factory()->create(['name' => ['ru' => 'Диван 3 м']]);

        $this->assertSame([$sofa->id], $this->productIds('2,5'));
    }

    #[Test]
    public function backfill_fills_products_saved_before_the_column_existed(): void
    {
        $product = Product::factory()->create(['name' => ['ru' => 'Шкаф Норд']]);
        DB::table('products')->where('id', $product->id)->update(['search_text' => null]);

        $this->assertSame(1, ProductSearch::backfill());
        $this->assertSame([$product->id], Product::query()->search('шкаф')->pluck('id')->all());
    }

    #[Test]
    public function search_text_is_not_exposed_by_the_api(): void
    {
        Product::factory()->create(['name' => ['ru' => 'Диван']]);

        $this->assertArrayNotHasKey('search_text', $this->getJson('/api/admin/products')->assertOk()->json('data.0'));
    }
}
