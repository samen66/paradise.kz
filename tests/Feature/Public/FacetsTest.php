<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Brand;
use App\Models\CatalogGroup;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FacetsTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function facets_list_filterable_attributes_brands_and_the_price_range(): void
    {
        $color = Attribute::factory()->create(['name' => 'Цвет', 'slug' => 'color', 'is_filterable' => true]);
        $brand = Brand::factory()->create(['slug' => 'ikea']);

        $one = Product::factory()->create(['brand_id' => $brand->id, 'retail_price' => 100_000]);
        $two = Product::factory()->create(['retail_price' => 300_000]);
        AttributeValue::factory()->create(['product_id' => $one->id, 'attribute_id' => $color->id, 'value' => 'красный']);
        AttributeValue::factory()->create(['product_id' => $two->id, 'attribute_id' => $color->id, 'value' => 'синий']);

        $response = $this->getJson('/api/public/facets')->assertOk();

        $this->assertSame('color', $response->json('attributes.0.slug'));
        $this->assertEqualsCanonicalizing(
            [['value' => 'красный', 'label' => 'красный'], ['value' => 'синий', 'label' => 'синий']],
            $response->json('attributes.0.values'),
        );
        $this->assertSame('ikea', $response->json('brands.0.slug'));
        $this->assertSame(1, $response->json('brands.0.count'));
        $this->assertEqualsWithDelta(1000.0, $response->json('price.min'), 0.001);
        $this->assertEqualsWithDelta(3000.0, $response->json('price.max'), 0.001);
    }

    #[Test]
    public function non_filterable_attributes_never_appear(): void
    {
        $hidden = Attribute::factory()->create(['slug' => 'internal', 'is_filterable' => false]);
        $product = Product::factory()->create();
        AttributeValue::factory()->create(['product_id' => $product->id, 'attribute_id' => $hidden->id, 'value' => 'X']);

        $this->getJson('/api/public/facets')
            ->assertOk()
            ->assertJsonCount(0, 'attributes');
    }

    #[Test]
    public function facets_are_scoped_to_the_requested_category_subtree(): void
    {
        $color = Attribute::factory()->create(['slug' => 'color', 'is_filterable' => true]);
        $category = Category::factory()->create(['slug' => 'divany']);

        $inside = Product::factory()->create(['category_id' => $category->id, 'retail_price' => 100_000]);
        $outside = Product::factory()->create(['retail_price' => 900_000]);
        AttributeValue::factory()->create(['product_id' => $inside->id, 'attribute_id' => $color->id, 'value' => 'красный']);
        AttributeValue::factory()->create(['product_id' => $outside->id, 'attribute_id' => $color->id, 'value' => 'синий']);

        $response = $this->getJson('/api/public/facets?category=divany')->assertOk();

        $this->assertSame([['value' => 'красный', 'label' => 'красный']], $response->json('attributes.0.values'));
        $this->assertEqualsWithDelta(1000.0, $response->json('price.max'), 0.001);
    }

    #[Test]
    public function facet_labels_follow_the_locale_and_keep_the_ru_key(): void
    {
        $color = Attribute::factory()->create(['name' => ['ru' => 'Цвет', 'kk' => 'Түсі'], 'slug' => 'color', 'is_filterable' => true]);
        $grey = Product::factory()->create();
        $white = Product::factory()->create();
        AttributeValue::factory()->create(['product_id' => $grey->id, 'attribute_id' => $color->id, 'value' => ['ru' => 'Серый', 'kk' => 'Сұр']]);
        // kk не заполнен — подпись откатывается на ru.
        AttributeValue::factory()->create(['product_id' => $white->id, 'attribute_id' => $color->id, 'value' => ['ru' => 'Белый']]);

        $response = $this->getJson('/api/public/facets?locale=kk')->assertOk();

        $this->assertSame('Түсі', $response->json('attributes.0.name'));
        $this->assertEqualsCanonicalizing(
            [['value' => 'Серый', 'label' => 'Сұр'], ['value' => 'Белый', 'label' => 'Белый']],
            $response->json('attributes.0.values'),
        );
    }

    #[Test]
    public function restricted_products_do_not_leak_into_facets(): void
    {
        $color = Attribute::factory()->create(['slug' => 'color', 'is_filterable' => true]);
        $restricted = Product::factory()->create();
        $restricted->catalogGroups()->attach(CatalogGroup::factory()->create());
        AttributeValue::factory()->create(['product_id' => $restricted->id, 'attribute_id' => $color->id, 'value' => 'секретный']);

        $this->getJson('/api/public/facets')
            ->assertOk()
            ->assertJsonCount(0, 'attributes');
    }
}
