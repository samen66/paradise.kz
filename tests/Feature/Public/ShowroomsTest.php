<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\CatalogGroup;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ShowroomsTest extends TestCase
{
    use RefreshDatabase;

    private function stock(Store $store, float $quantity, array $product = []): Product
    {
        $model = Product::factory()->create($product);
        ProductStoreStock::factory()->for($model)->for($store)->create(['stock' => $quantity]);

        return $model;
    }

    #[Test]
    public function only_published_showrooms_are_listed_in_order(): void
    {
        $second = Store::factory()->showroom()->create(['name' => 'Б', 'sort_order' => 2]);
        $first = Store::factory()->showroom()->create(['name' => 'А', 'sort_order' => 1]);
        Store::factory()->showroom()->create(['show_on_site' => false]);
        Store::factory()->showroom()->create(['is_active' => false]);
        Store::factory()->showroom()->create(['type' => 'warehouse']);
        Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT, 'slug' => null, 'show_on_site' => true]);

        $this->getJson('/api/public/showrooms')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $first->id)
            ->assertJsonPath('data.1.id', $second->id)
            ->assertJsonPath('data.0.weekly_hours.0', ['open' => '10:00', 'close' => '21:00'])
            ->assertJsonPath('data.0.services', ['pickup', 'consult'])
            ->assertJsonPath('data.0.photos', [])
            ->assertJsonMissingPath('data.0.is_default');
    }

    #[Test]
    public function counts_and_preview_take_only_visible_products_in_stock(): void
    {
        $showroom = Store::factory()->showroom()->create();
        $other = Store::factory()->showroom()->create();

        $most = $this->stock($showroom, 9);
        $this->stock($showroom, 2);
        $this->stock($showroom, 0);
        $this->stock($showroom, 5, ['is_active' => false]);
        $grouped = $this->stock($showroom, 7);
        $grouped->catalogGroups()->attach(CatalogGroup::factory()->create());
        $this->stock($other, 4);

        $this->getJson("/api/public/showrooms/{$showroom->slug}")
            ->assertOk()
            ->assertJsonPath('data.products_count', 2)
            ->assertJsonCount(2, 'data.products_preview')
            ->assertJsonPath('data.products_preview.0.id', $most->id)
            ->assertJsonStructure(['data' => ['products_preview' => [['id', 'slug', 'name', 'image']]]]);
    }

    #[Test]
    public function the_preview_holds_at_most_five_products(): void
    {
        $showroom = Store::factory()->showroom()->create();

        for ($i = 0; $i < 7; $i++) {
            $this->stock($showroom, 1);
        }

        $this->getJson('/api/public/showrooms')
            ->assertJsonPath('data.0.products_count', 7)
            ->assertJsonCount(5, 'data.0.products_preview');
    }

    #[Test]
    public function a_draft_or_unknown_showroom_is_not_found(): void
    {
        $draft = Store::factory()->showroom()->create(['show_on_site' => false]);

        $this->getJson("/api/public/showrooms/{$draft->slug}")->assertNotFound();
        $this->getJson('/api/public/showrooms/nope')->assertNotFound();
    }

    #[Test]
    public function translated_fields_follow_the_locale(): void
    {
        $showroom = Store::factory()->showroom()->create([
            'landmark' => ['ru' => 'У метро', 'kk' => 'Метро жанында'],
        ]);

        $this->getJson("/api/public/showrooms/{$showroom->slug}?locale=kk")
            ->assertJsonPath('data.landmark', 'Метро жанында');
        $this->getJson("/api/public/showrooms/{$showroom->slug}")
            ->assertJsonPath('data.landmark', 'У метро');
    }

    #[Test]
    public function a_product_links_only_published_showrooms(): void
    {
        $published = Store::factory()->showroom()->create(['slug' => 'esentai']);
        $switchedOff = Store::factory()->showroom()->create(['is_active' => false]);
        $warehouse = Store::factory()->create(['type' => 'warehouse']);
        $product = Product::factory()->create(['retail_price' => 100_000]);

        foreach ([$published, $switchedOff, $warehouse] as $store) {
            ProductStoreStock::factory()->for($product)->for($store)->create(['stock' => 3]);
        }

        $showrooms = collect($this->getJson("/api/public/products/{$product->id}")->assertOk()->json('data.showrooms'))
            ->keyBy('store.id');

        $this->assertSame('esentai', $showrooms[$published->id]['store']['slug']);
        $this->assertNull($showrooms[$switchedOff->id]['store']['slug']);
        $this->assertNull($showrooms[$warehouse->id]['store']['slug']);
    }
}
