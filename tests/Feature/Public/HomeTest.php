<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\Banner;
use App\Models\CatalogGroup;
use App\Models\Product;
use App\Models\ProductCollection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class HomeTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_returns_active_banners_in_sort_order(): void
    {
        Banner::factory()->create(['title' => 'Второй', 'sort_order' => 2]);
        Banner::factory()->create(['title' => 'Первый', 'sort_order' => 1]);
        Banner::factory()->inactive()->create(['title' => 'Скрытый']);

        $response = $this->getJson('/api/public/home')->assertOk();

        $this->assertSame(
            ['Первый', 'Второй'],
            collect($response->json('data.banners'))->pluck('title')->all(),
        );
    }

    #[Test]
    public function collections_expose_products_with_retail_prices(): void
    {
        $collection = ProductCollection::factory()->create(['title' => 'Хиты']);
        $product = Product::factory()->create(['retail_price' => 250_000]);
        $collection->products()->attach($product, ['sort_order' => 1]);

        $response = $this->getJson('/api/public/home')->assertOk();

        $this->assertSame('Хиты', $response->json('data.collections.0.title'));
        $this->assertSame($product->id, $response->json('data.collections.0.products.0.id'));
        $this->assertEqualsWithDelta(2500.0, $response->json('data.collections.0.products.0.price'), 0.001);
    }

    #[Test]
    public function restricted_and_inactive_products_are_dropped_from_collections(): void
    {
        $collection = ProductCollection::factory()->create();

        $restricted = Product::factory()->create();
        $restricted->catalogGroups()->attach(CatalogGroup::factory()->create());
        $inactive = Product::factory()->inactive()->create();
        $visible = Product::factory()->create();

        $collection->products()->attach([$restricted->id, $inactive->id, $visible->id]);

        $response = $this->getJson('/api/public/home')->assertOk();

        $this->assertSame(
            [$visible->id],
            collect($response->json('data.collections.0.products'))->pluck('id')->all(),
        );
    }

    #[Test]
    public function inactive_collections_are_hidden(): void
    {
        ProductCollection::factory()->inactive()->create();

        $this->getJson('/api/public/home')
            ->assertOk()
            ->assertJsonCount(0, 'data.collections');
    }
}
