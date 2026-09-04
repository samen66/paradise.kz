<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\CatalogGroup;
use App\Models\Category;
use App\Models\PriceType;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductStoreStock;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PublicCatalogTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_requires_no_authentication(): void
    {
        $this->getJson('/api/public/products')->assertOk();
        $this->getJson('/api/public/categories')->assertOk();
    }

    #[Test]
    public function ungrouped_active_products_are_listed_with_retail_pricing(): void
    {
        $product = Product::factory()->create(['retail_price' => 250_000]);

        $response = $this->getJson('/api/public/products')->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($product->id, $ids);
        $this->assertEqualsWithDelta(2500.0, $response->json('data.0.price'), 0.001);
    }

    #[Test]
    public function b2b_grouped_products_never_appear_in_the_public_catalog(): void
    {
        $restricted = Product::factory()->create(['name' => 'Оптовый товар']);
        $restricted->catalogGroups()->attach(CatalogGroup::factory()->create());

        $response = $this->getJson('/api/public/products')->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertNotContains($restricted->id, $ids);
    }

    #[Test]
    public function inactive_products_are_excluded(): void
    {
        $active = Product::factory()->create();
        $inactive = Product::factory()->inactive()->create();

        $ids = collect($this->getJson('/api/public/products')->json('data'))->pluck('id')->all();

        $this->assertContains($active->id, $ids);
        $this->assertNotContains($inactive->id, $ids);
    }

    #[Test]
    public function b2b_price_and_client_discounts_never_affect_the_public_price(): void
    {
        // A "b2b" local price type exists and even has a row for this product,
        // but a guest must only ever see the retail tier.
        $b2bType = PriceType::factory()->b2b()->create();
        $product = Product::factory()->create(['retail_price' => 100_000]);
        ProductPrice::factory()->create([
            'product_id' => $product->id,
            'price_type_id' => $b2bType->id,
            'price' => 40_000,
        ]);

        $response = $this->getJson('/api/public/products')->assertOk();

        $this->assertEqualsWithDelta(1000.0, $response->json('data.0.price'), 0.001);
    }

    #[Test]
    public function is_new_arrival_flag_is_exposed_as_is_new(): void
    {
        $newArrival = Product::factory()->create(['is_new_arrival' => true]);
        $regular = Product::factory()->create(['is_new_arrival' => false]);

        $response = $this->getJson('/api/public/products')->assertOk();

        $byId = collect($response->json('data'))->keyBy('id');
        $this->assertTrue($byId[$newArrival->id]['is_new']);
        $this->assertFalse($byId[$regular->id]['is_new']);
    }

    #[Test]
    public function compare_at_price_becomes_old_price_only_when_above_the_resolved_price(): void
    {
        $discounted = Product::factory()->create(['retail_price' => 100_000, 'compare_at_price' => 150_000]);
        $stale = Product::factory()->create(['retail_price' => 100_000, 'compare_at_price' => 90_000]);

        $response = $this->getJson('/api/public/products')->assertOk();

        $byId = collect($response->json('data'))->keyBy('id');
        $this->assertEqualsWithDelta(1500.0, $byId[$discounted->id]['old_price'], 0.001);
        $this->assertNull($byId[$stale->id]['old_price']);
    }

    #[Test]
    public function stock_reflects_the_default_store_when_none_is_requested(): void
    {
        $default = Store::factory()->create(['is_default' => true, 'name' => 'Б-склад']);
        Store::factory()->create(['is_default' => false, 'name' => 'А-склад']);
        $product = Product::factory()->create();
        ProductStoreStock::factory()->for($product)->for($default)->create(['stock' => 7]);

        $this->getJson('/api/public/products')
            ->assertOk()
            ->assertJsonPath('data.0.in_stock', true)
            ->assertJsonPath('data.0.stock', 7);
    }

    #[Test]
    public function category_filter_narrows_results_by_local_category(): void
    {
        $category = Category::factory()->create();
        $inCategory = Product::factory()->create(['category_id' => $category->id]);
        Product::factory()->create(['category_id' => null]);

        $response = $this->getJson('/api/public/products?filter[category]='.$category->id)->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertSame([$inCategory->id], $ids);
    }

    #[Test]
    public function product_detail_returns_404_for_a_b2b_grouped_product(): void
    {
        $restricted = Product::factory()->create();
        $restricted->catalogGroups()->attach(CatalogGroup::factory()->create());

        $this->getJson('/api/public/products/'.$restricted->id)->assertStatus(404);
    }

    #[Test]
    public function product_detail_returns_the_public_product_with_description(): void
    {
        $product = Product::factory()->create([
            'description' => 'Описание для витрины',
            'retail_price' => 120_000,
        ]);

        $response = $this->getJson('/api/public/products/'.$product->id)
            ->assertOk()
            ->assertJsonPath('data.id', $product->id)
            ->assertJsonPath('data.description', 'Описание для витрины');

        $this->assertEqualsWithDelta(1200.0, $response->json('data.price'), 0.001);
    }

    #[Test]
    public function product_detail_exposes_seo_meta_for_the_storefront_head(): void
    {
        $product = Product::factory()->create([
            'seo_title' => ['ru' => 'Диван Атланта купить в Алматы'],
            'seo_description' => ['ru' => 'Мягкий диван от производителя'],
        ]);

        $this->getJson('/api/public/products/'.$product->id)
            ->assertOk()
            ->assertJsonPath('data.seo_title', 'Диван Атланта купить в Алматы')
            ->assertJsonPath('data.seo_description', 'Мягкий диван от производителя');
    }

    #[Test]
    public function categories_returns_only_active_local_categories(): void
    {
        $parent = Category::factory()->create(['name' => 'Мебель']);
        $child = Category::factory()->create(['name' => 'Диваны', 'parent_id' => $parent->id]);
        $inactive = Category::factory()->inactive()->create();

        $response = $this->getJson('/api/public/categories')->assertOk();
        $response->assertJsonCount(2, 'data');

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($parent->id, $ids);
        $this->assertContains($child->id, $ids);
        $this->assertNotContains($inactive->id, $ids);
    }
}
