<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Brand;
use App\Models\Category;
use App\Models\PriceType;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductStoreStock;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ProductFiltersTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return list<int>
     */
    private function listedIds(string $query): array
    {
        return collect($this->getJson('/api/public/products?'.$query)->assertOk()->json('data'))
            ->pluck('id')
            ->all();
    }

    #[Test]
    public function the_brand_filter_accepts_a_slug_or_an_id(): void
    {
        $brand = Brand::factory()->create(['slug' => 'ikea']);
        $match = Product::factory()->create(['brand_id' => $brand->id]);
        Product::factory()->create();

        $this->assertSame([$match->id], $this->listedIds('filter[brand]=ikea'));
        $this->assertSame([$match->id], $this->listedIds('filter[brand]='.$brand->id));
    }

    #[Test]
    public function the_category_filter_includes_descendant_categories(): void
    {
        $parent = Category::factory()->create(['slug' => 'mebel']);
        $child = Category::factory()->create(['parent_id' => $parent->id]);
        $inChild = Product::factory()->create(['category_id' => $child->id]);
        $inParent = Product::factory()->create(['category_id' => $parent->id]);
        Product::factory()->create(['category_id' => null]);

        $ids = $this->listedIds('filter[category]=mebel');

        $this->assertEqualsCanonicalizing([$inChild->id, $inParent->id], $ids);
    }

    #[Test]
    public function price_filters_operate_on_the_effective_retail_price_in_tenge(): void
    {
        $cheap = Product::factory()->create(['retail_price' => 100_000]);   // 1000 ₸
        $costly = Product::factory()->create(['retail_price' => 300_000]); // 3000 ₸

        $this->assertSame([$costly->id], $this->listedIds('filter[price_min]=2000'));
        $this->assertSame([$cheap->id], $this->listedIds('filter[price_max]=2000'));
    }

    #[Test]
    public function the_price_filter_prefers_the_local_retail_price_row_over_the_legacy_column(): void
    {
        // Legacy column says 3000 ₸, but the local retail price row (500 ₸)
        // is what PricingService actually charges — the filter must agree.
        $retailType = PriceType::factory()->create(['code' => 'retail']);
        $product = Product::factory()->create(['retail_price' => 300_000]);
        ProductPrice::factory()->create([
            'product_id' => $product->id,
            'price_type_id' => $retailType->id,
            'price' => 50_000,
        ]);

        $this->assertSame([$product->id], $this->listedIds('filter[price_max]=600'));
        $this->assertSame([], $this->listedIds('filter[price_min]=2000'));
    }

    #[Test]
    public function products_can_be_sorted_by_price(): void
    {
        $costly = Product::factory()->create(['retail_price' => 300_000]);
        $cheap = Product::factory()->create(['retail_price' => 100_000]);

        $this->assertSame([$cheap->id, $costly->id], $this->listedIds('sort=price'));
        $this->assertSame([$costly->id, $cheap->id], $this->listedIds('sort=-price'));
    }

    #[Test]
    public function the_attribute_filter_matches_any_of_the_requested_values(): void
    {
        $color = Attribute::factory()->create(['slug' => 'color', 'is_filterable' => true]);
        $red = Product::factory()->create();
        $blue = Product::factory()->create();
        $green = Product::factory()->create();
        AttributeValue::factory()->create(['product_id' => $red->id, 'attribute_id' => $color->id, 'value' => 'красный']);
        AttributeValue::factory()->create(['product_id' => $blue->id, 'attribute_id' => $color->id, 'value' => 'синий']);
        AttributeValue::factory()->create(['product_id' => $green->id, 'attribute_id' => $color->id, 'value' => 'зелёный']);

        $ids = $this->listedIds('filter[attr][color]='.rawurlencode('красный,синий'));

        $this->assertEqualsCanonicalizing([$red->id, $blue->id], $ids);
    }

    #[Test]
    public function separate_attributes_combine_with_and(): void
    {
        $color = Attribute::factory()->create(['slug' => 'color', 'is_filterable' => true]);
        $material = Attribute::factory()->create(['slug' => 'material', 'is_filterable' => true]);

        $match = Product::factory()->create();
        AttributeValue::factory()->create(['product_id' => $match->id, 'attribute_id' => $color->id, 'value' => 'красный']);
        AttributeValue::factory()->create(['product_id' => $match->id, 'attribute_id' => $material->id, 'value' => 'кожа']);

        $onlyColor = Product::factory()->create();
        AttributeValue::factory()->create(['product_id' => $onlyColor->id, 'attribute_id' => $color->id, 'value' => 'красный']);

        $this->assertSame(
            [$match->id],
            $this->listedIds('filter[attr][color]='.rawurlencode('красный').'&filter[attr][material]='.rawurlencode('кожа')),
        );
    }

    #[Test]
    public function a_non_filterable_attribute_matches_nothing(): void
    {
        $hidden = Attribute::factory()->create(['slug' => 'internal-grade', 'is_filterable' => false]);
        $product = Product::factory()->create();
        AttributeValue::factory()->create(['product_id' => $product->id, 'attribute_id' => $hidden->id, 'value' => 'A']);

        $this->assertSame([], $this->listedIds('filter[attr][internal-grade]=A'));
    }

    #[Test]
    public function the_in_stock_filter_keeps_only_products_available_at_the_store(): void
    {
        $store = Store::factory()->create(['is_default' => true]);
        $inStock = Product::factory()->create();
        $outOfStock = Product::factory()->create();
        ProductStoreStock::factory()->for($inStock)->for($store)->create(['stock' => 5]);
        ProductStoreStock::factory()->for($outOfStock)->for($store)->create(['stock' => 0]);

        $this->assertSame([$inStock->id], $this->listedIds('filter[in_stock]=1'));
    }
}
