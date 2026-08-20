<?php

declare(strict_types=1);

namespace Tests\Feature\Catalog;

use App\Models\CatalogGroup;
use App\Models\CatalogSetting;
use App\Models\ClientProductPrice;
use App\Models\Product;
use App\Models\ProductFolder;
use App\Models\ProductStoreStock;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CatalogApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function approvedClient(array $attributes = []): User
    {
        return User::factory()->b2b()->approved()->create($attributes);
    }

    #[Test]
    public function unapproved_user_is_blocked_from_products(): void
    {
        $user = User::factory()->b2b()->create(); // pending
        Sanctum::actingAs($user);

        $this->getJson('/api/products')->assertStatus(403);
    }

    #[Test]
    public function unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/products')->assertStatus(401);
        $this->getJson('/api/categories')->assertStatus(401);
    }

    #[Test]
    public function products_lists_only_visible_products(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $visible = Product::factory()->create(['name' => 'Открытый товар']);

        // Restricted to a group the user does not belong to → hidden.
        $hidden = Product::factory()->create(['name' => 'Скрытый товар']);
        $hidden->catalogGroups()->attach(CatalogGroup::factory()->create());

        $response = $this->getJson('/api/products')->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertContains($visible->id, $ids);
        $this->assertNotContains($hidden->id, $ids);
    }

    #[Test]
    public function inactive_products_are_excluded(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $active = Product::factory()->create();
        $inactive = Product::factory()->inactive()->create();

        $ids = collect($this->getJson('/api/products')->json('data'))->pluck('id')->all();

        $this->assertContains($active->id, $ids);
        $this->assertNotContains($inactive->id, $ids);
    }

    #[Test]
    public function per_client_price_reflects_the_discount(): void
    {
        $user = $this->approvedClient(['discount_percent' => 10]);
        Sanctum::actingAs($user);

        // b2b_price 200000 kopecks → 10% off = 180000 → 1800.00 ₸
        $product = Product::factory()->create(['b2b_price' => 200_000]);

        $response = $this->getJson('/api/products')->assertOk();

        $this->assertEqualsWithDelta(1800.0, $response->json('data.0.price'), 0.001);
    }

    #[Test]
    public function explicit_override_wins_over_the_discount(): void
    {
        $user = $this->approvedClient(['discount_percent' => 50]);
        Sanctum::actingAs($user);

        $product = Product::factory()->create(['b2b_price' => 200_000]);

        ClientProductPrice::factory()->create([
            'user_id' => $user->id,
            'product_id' => $product->id,
            'price' => 99_900, // kopecks → 999.00 ₸
        ]);

        $response = $this->getJson('/api/products')->assertOk();

        $this->assertEqualsWithDelta(999.0, $response->json('data.0.price'), 0.001);
    }

    #[Test]
    public function in_stock_flag_is_false_for_zero_stock_products(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->create();
        $product = Product::factory()->create();
        ProductStoreStock::factory()->for($product)->for($store)->create(['stock' => 0]);

        $response = $this->getJson('/api/products?store_id='.$store->id)
            ->assertOk()
            ->assertJsonPath('data.0.in_stock', false);

        $this->assertEqualsWithDelta(0.0, $response->json('data.0.stock'), 0.001);
    }

    #[Test]
    public function in_stock_flag_is_true_for_stocked_products(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->create();
        $product = Product::factory()->create();
        ProductStoreStock::factory()->for($product)->for($store)->create(['stock' => 5]);

        $this->getJson('/api/products?store_id='.$store->id)
            ->assertOk()
            ->assertJsonPath('data.0.in_stock', true)
            ->assertJsonPath('data.0.stock', 5);
    }

    #[Test]
    public function stock_quantity_is_hidden_when_admin_disables_it(): void
    {
        CatalogSetting::factory()->hidingStockQuantity()->create();

        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $store = Store::factory()->create();
        $product = Product::factory()->create();
        ProductStoreStock::factory()->for($product)->for($store)->create(['stock' => 5]);

        $this->getJson('/api/products?store_id='.$store->id)
            ->assertOk()
            ->assertJsonPath('data.0.in_stock', true)
            ->assertJsonMissingPath('data.0.stock');
    }

    #[Test]
    public function stock_quantity_is_hidden_from_variants_when_admin_disables_it(): void
    {
        CatalogSetting::factory()->hidingStockQuantity()->create();

        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $product = Product::factory()->create();
        ProductVariant::factory()->for($product)->create(['stock' => 3]);

        $this->getJson('/api/products/'.$product->id)
            ->assertOk()
            ->assertJsonPath('data.variants.0.in_stock', true)
            ->assertJsonMissingPath('data.variants.0.stock');
    }

    #[Test]
    public function stock_falls_back_to_zero_when_no_store_is_resolved(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        Product::factory()->create();

        // No stores exist at all → StoreResolver resolves null → stock is 0.
        $this->getJson('/api/products')
            ->assertOk()
            ->assertJsonPath('data.0.in_stock', false)
            ->assertJsonPath('data.0.stock', 0);
    }

    #[Test]
    public function product_response_exposes_mirrored_image_urls(): void
    {
        Storage::fake(config('media-library.disk_name'));

        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        Product::factory()->withImage()->create();

        $response = $this->getJson('/api/products')->assertOk();

        $image = $response->json('data.0.images.0');
        $this->assertArrayHasKey('thumb', $image);
        $this->assertArrayHasKey('medium', $image);
        $this->assertArrayHasKey('full', $image);

        // Served from our own disk, never the old expiring proxy URL.
        $this->assertStringContainsString('/storage/', (string) $response->json('data.0.image'));
        $this->assertStringNotContainsString('/api/moysklad/image', (string) $response->json('data.0.image'));
    }

    #[Test]
    public function products_without_images_expose_an_empty_gallery(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        Product::factory()->create();

        $this->getJson('/api/products')
            ->assertOk()
            ->assertJsonPath('data.0.images', [])
            ->assertJsonPath('data.0.image', null);
    }

    #[Test]
    public function search_filter_narrows_results(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $match = Product::factory()->create(['name' => 'Уникальный Диван Люкс']);
        Product::factory()->create(['name' => 'Обычный Стол']);

        $url = '/api/products?'.http_build_query(['filter' => ['search' => 'Уникальный']]);

        $response = $this->getJson($url)->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertSame([$match->id], $ids);
    }

    #[Test]
    public function category_filter_narrows_results(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $folder = ProductFolder::factory()->create();
        $inFolder = Product::factory()->create();
        $inFolder->externalMapping()->save(\App\Models\ProductExternalMapping::factory()->make(['external_folder_id' => $folder->external_id]));
        $notInFolder = Product::factory()->create();
        $notInFolder->externalMapping()->save(\App\Models\ProductExternalMapping::factory()->make(['external_folder_id' => null]));

        $response = $this->getJson('/api/products?filter[category]='.$folder->external_id)->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertSame([$inFolder->id], $ids);
    }

    #[Test]
    public function products_are_paginated_at_24_per_page(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        Product::factory()->count(30)->create();

        $response = $this->getJson('/api/products')->assertOk();

        $this->assertCount(24, $response->json('data'));
        $this->assertSame(30, $response->json('meta.total'));
    }

    #[Test]
    public function product_detail_returns_the_product_with_description(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $product = Product::factory()->create([
            'description' => 'Подробное описание товара',
            'b2b_price' => 150_000,
        ]);

        $response = $this->getJson('/api/products/'.$product->id)
            ->assertOk()
            ->assertJsonPath('data.id', $product->id)
            ->assertJsonPath('data.description', 'Подробное описание товара');

        $this->assertEqualsWithDelta(1500.0, $response->json('data.price'), 0.001);
    }

    #[Test]
    public function product_detail_exposes_mirrored_barcodes_attributes_and_variants(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $product = Product::factory()->create([
            'b2b_price' => 150_000,
            'country' => 'Казахстан',
            'supplier' => 'ТОО Поставщик',
        ]);
        $product->externalMapping()->save(\App\Models\ProductExternalMapping::factory()->make([
            'barcodes' => ['4600000000017'],
            'erp_attributes' => ['Материал' => 'дерево'],
        ]));

        ProductVariant::factory()->for($product)->create([
            'name' => 'красный',
            'characteristics' => ['Цвет' => 'красный'],
            'barcodes' => ['4600000000024'],
            'stock' => 3,
        ]);

        $this->getJson('/api/products/'.$product->id)
            ->assertOk()
            ->assertJsonPath('data.country', 'Казахстан')
            ->assertJsonPath('data.supplier', 'ТОО Поставщик')
            ->assertJsonPath('data.barcodes', ['4600000000017'])
            ->assertJsonPath('data.attributes', ['Материал' => 'дерево'])
            ->assertJsonPath('data.variants.0.name', 'красный')
            ->assertJsonPath('data.variants.0.characteristics', ['Цвет' => 'красный'])
            ->assertJsonPath('data.variants.0.in_stock', true);
    }

    #[Test]
    public function product_detail_returns_404_for_an_invisible_product(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        // Restricted to a group the user is not in → must 404, not 403.
        $hidden = Product::factory()->create();
        $hidden->catalogGroups()->attach(CatalogGroup::factory()->create());

        $this->getJson('/api/products/'.$hidden->id)->assertStatus(404);
    }

    #[Test]
    public function categories_returns_the_folders(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $parent = ProductFolder::factory()->create(['name' => 'Мебель']);
        $child = ProductFolder::factory()->create([
            'name' => 'Диваны',
            'parent_external_id' => $parent->external_id,
        ]);

        $response = $this->getJson('/api/categories')->assertOk();

        $response->assertJsonCount(2, 'data');

        $byId = collect($response->json('data'))->keyBy('id');

        $this->assertSame($parent->external_id, $byId[$parent->id]['external_id']);
        $this->assertNull($byId[$parent->id]['parent_external_id']);
        $this->assertSame($parent->external_id, $byId[$child->id]['parent_external_id']);
    }
}
