<?php

declare(strict_types=1);

namespace Tests\Feature\B2b;

use App\Models\B2bHomeContent;
use App\Models\Banner;
use App\Models\CatalogGroup;
use App\Models\Product;
use App\Models\ProductCollection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class B2bHomeTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_is_open_without_a_token_and_lists_only_active_b2b_banners(): void
    {
        Banner::factory()->b2bHome()->create(['title' => 'Второй', 'sort_order' => 2]);
        Banner::factory()->b2bHome()->create(['title' => 'Первый', 'sort_order' => 1]);
        Banner::factory()->b2bHome()->inactive()->create(['title' => 'Скрытый']);
        Banner::factory()->create(['title' => 'Магазин']);

        $response = $this->getJson('/api/b2b/home')->assertOk();

        $this->assertSame(['Первый', 'Второй'], collect($response->json('data.banners'))->pluck('title')->all());
    }

    #[Test]
    public function collections_are_the_active_ones_flagged_for_b2b_home(): void
    {
        ProductCollection::factory()->onB2bHome()->create(['title' => 'Лофт', 'description' => 'Металл и дерево']);
        ProductCollection::factory()->onB2bHome()->inactive()->create(['title' => 'Черновик']);
        ProductCollection::factory()->create(['title' => 'Хиты']);

        $response = $this->getJson('/api/b2b/home')->assertOk();

        $response->assertJsonCount(1, 'data.collections')
            ->assertJsonPath('data.collections.0.title', 'Лофт')
            ->assertJsonPath('data.collections.0.description', 'Металл и дерево')
            ->assertJsonPath('data.collections.0.cover', null);
    }

    #[Test]
    public function products_come_without_prices_and_only_from_the_public_catalog(): void
    {
        $collection = ProductCollection::factory()->onB2bHome()->create();
        $visible = Product::factory()->create(['b2b_price' => 200_000, 'retail_price' => 250_000]);
        $restricted = Product::factory()->create();
        $restricted->catalogGroups()->attach(CatalogGroup::factory()->create());
        $collection->products()->attach([$visible->id => ['sort_order' => 1], $restricted->id => ['sort_order' => 2]]);

        $response = $this->getJson('/api/b2b/home')->assertOk();

        $this->assertSame([$visible->id], collect($response->json('data.collections.0.products'))->pluck('id')->all());

        $product = $response->json('data.collections.0.products.0');
        foreach (['price', 'old_price', 'stock', 'in_stock', 'showrooms'] as $key) {
            $this->assertArrayNotHasKey($key, $product);
        }
    }

    #[Test]
    public function about_is_null_until_filled_in_and_then_returned(): void
    {
        $this->getJson('/api/b2b/home')->assertOk()->assertJsonPath('data.about', null);

        B2bHomeContent::current()->update([
            'about_title' => ['ru' => 'Кто мы'],
            'about_text' => ['ru' => 'Шоурум и склад в Алматы'],
        ]);

        $this->getJson('/api/b2b/home')
            ->assertOk()
            ->assertJsonPath('data.about.title', 'Кто мы')
            ->assertJsonPath('data.about.text', 'Шоурум и склад в Алматы')
            ->assertJsonPath('data.about.image', null);
    }
}
