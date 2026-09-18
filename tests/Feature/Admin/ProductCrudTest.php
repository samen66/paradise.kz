<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Brand;
use App\Models\CatalogGroup;
use App\Models\Category;
use App\Models\GoodsReceiptItem;
use App\Models\PriceType;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\WriteOffItem;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * The admin catalog editor (/api/admin/products). Covers the fields that used
 * to arrive from the ERP and are now typed by hand, and the two boundaries that
 * are easy to get wrong: ₸ in / тиын out, and stock never moving from here.
 *
 * It also pins the `issues` every listed product carries — the reasons
 * VisibilityService and PricingService already keep it off the storefront,
 * which until now nothing said out loud. Those rules live in the services and
 * are tested there; what is tested here is that they get reported.
 */
class ProductCrudTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);
    }

    #[Test]
    public function creating_a_product_persists_every_editable_field(): void
    {
        $category = Category::factory()->create();
        $brand = Brand::factory()->create();

        $response = $this->postJson('/api/admin/products', [
            'name' => ['ru' => 'Диван Атланта', 'kk' => 'Атланта диваны'],
            'description' => ['ru' => 'Мягкий диван', 'kk' => 'Жұмсақ диван'],
            'slug' => 'divan-atlanta',
            'seo_title' => ['ru' => 'Диван Атланта купить', 'kk' => 'Атланта диванын сатып алу'],
            'seo_description' => ['ru' => 'Мягкий диван от производителя'],
            'code' => 'SKU-001',
            'article' => 'ART-001',
            'category_id' => $category->id,
            'brand_id' => $brand->id,
            'retail_price' => 150000,
            'b2b_price' => 120000,
            'compare_at_price' => 180000,
            'min_price' => 100000,
            'purchase_price' => 90000,
            'b2b_min_order_qty' => 5,
            'uom' => 'шт',
            'country' => 'Казахстан',
            'supplier' => 'ТОО Поставщик',
            'weight' => 42.5,
            'volume' => 1.25,
            'is_active' => true,
            'is_new_arrival' => true,
        ])->assertCreated();

        $product = Product::findOrFail($response->json('data.id'));

        $this->assertSame('Диван Атланта', $product->getTranslation('name', 'ru'));
        $this->assertSame('Атланта диваны', $product->getTranslation('name', 'kk'));
        $this->assertSame('Мягкий диван', $product->getTranslation('description', 'ru'));
        $this->assertSame('divan-atlanta', $product->slug);
        $this->assertSame('Диван Атланта купить', $product->getTranslation('seo_title', 'ru'));
        $this->assertSame('Атланта диванын сатып алу', $product->getTranslation('seo_title', 'kk'));
        $this->assertSame('Мягкий диван от производителя', $product->getTranslation('seo_description', 'ru'));
        $this->assertSame('SKU-001', $product->code);
        $this->assertSame('ART-001', $product->article);
        $this->assertSame($category->id, $product->category_id);
        $this->assertSame($brand->id, $product->brand_id);
        $this->assertSame(5, $product->b2b_min_order_qty);
        $this->assertSame('шт', $product->uom);
        $this->assertSame('Казахстан', $product->country);
        $this->assertSame('ТОО Поставщик', $product->supplier);
        $this->assertSame('42.500', $product->weight);
        $this->assertSame('1.250', $product->volume);
        $this->assertTrue($product->is_active);
        $this->assertTrue($product->is_new_arrival);
    }

    #[Test]
    public function prices_are_sent_in_tenge_and_stored_in_kopecks(): void
    {
        $response = $this->postJson('/api/admin/products', [
            'name' => ['ru' => 'Стул'],
            'retail_price' => 150000,
            'b2b_price' => 120000,
            'compare_at_price' => 180000.5,
            'min_price' => 100000,
            'purchase_price' => 90000.99,
        ])->assertCreated();

        $product = Product::findOrFail($response->json('data.id'));

        $this->assertSame(15_000_000, $product->retail_price);
        $this->assertSame(12_000_000, $product->b2b_price);
        $this->assertSame(18_000_050, $product->compare_at_price);
        $this->assertSame(10_000_000, $product->min_price);
        $this->assertSame(9_000_099, $product->purchase_price);
    }

    #[Test]
    public function a_price_with_more_than_two_decimals_is_rejected(): void
    {
        $this->postJson('/api/admin/products', [
            'name' => ['ru' => 'Стул'],
            'retail_price' => 1500.005,
        ])->assertStatus(422)->assertJsonValidationErrors('retail_price');
    }

    #[Test]
    public function a_blank_slug_falls_through_to_the_generated_one(): void
    {
        $response = $this->postJson('/api/admin/products', [
            'name' => ['ru' => 'Диван Атланта'],
            'slug' => '',
        ])->assertCreated();

        $product = Product::findOrFail($response->json('data.id'));

        $this->assertSame('divan-atlanta-'.$product->id, $product->slug);
    }

    #[Test]
    public function a_duplicate_slug_is_rejected(): void
    {
        Product::factory()->create(['slug' => 'divan-atlanta']);

        $this->postJson('/api/admin/products', [
            'name' => ['ru' => 'Другой диван'],
            'slug' => 'divan-atlanta',
        ])->assertStatus(422)->assertJsonValidationErrors('slug');
    }

    #[Test]
    public function a_product_may_keep_its_own_slug_on_update(): void
    {
        $product = Product::factory()->create(['slug' => 'divan-atlanta']);

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Диван Атланта'],
            'slug' => 'divan-atlanta',
        ])->assertOk();

        $this->assertSame('divan-atlanta', $product->fresh()->slug);
    }

    #[Test]
    public function updating_does_not_wipe_fields_the_request_omits(): void
    {
        $product = Product::factory()->create([
            'code' => 'SKU-001',
            'article' => 'ART-001',
            'country' => 'Казахстан',
            'supplier' => 'ТОО Поставщик',
            'uom' => 'шт',
            'weight' => 42.5,
            'volume' => 1.25,
            'retail_price' => 15_000_000,
            'b2b_price' => 12_000_000,
            'min_price' => 10_000_000,
            'purchase_price' => 9_000_000,
            'b2b_min_order_qty' => 5,
        ]);

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Новое название'],
            'retail_price' => 199000,
        ])->assertOk();

        $product->refresh();

        $this->assertSame('Новое название', $product->getTranslation('name', 'ru'));
        $this->assertSame(19_900_000, $product->retail_price);

        // Everything the request did not mention is untouched.
        $this->assertSame('SKU-001', $product->code);
        $this->assertSame('ART-001', $product->article);
        $this->assertSame('Казахстан', $product->country);
        $this->assertSame('ТОО Поставщик', $product->supplier);
        $this->assertSame('шт', $product->uom);
        $this->assertSame('42.500', $product->weight);
        $this->assertSame('1.250', $product->volume);
        $this->assertSame(12_000_000, $product->b2b_price);
        $this->assertSame(10_000_000, $product->min_price);
        $this->assertSame(9_000_000, $product->purchase_price);
        $this->assertSame(5, $product->b2b_min_order_qty);
    }

    #[Test]
    public function an_explicit_null_does_clear_an_optional_field(): void
    {
        $product = Product::factory()->create(['article' => 'ART-001']);

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Стул'],
            'article' => null,
        ])->assertOk();

        $this->assertNull($product->fresh()->article);
    }

    #[Test]
    public function seo_meta_is_translatable_and_survives_an_unrelated_update(): void
    {
        $product = Product::factory()->create([
            'seo_title' => ['ru' => 'Заголовок', 'kk' => 'Тақырып'],
            'seo_description' => ['ru' => 'Описание'],
        ]);

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Стул'],
            'retail_price' => 1000,
        ])->assertOk();

        $product->refresh();

        $this->assertSame('Заголовок', $product->getTranslation('seo_title', 'ru'));
        $this->assertSame('Тақырып', $product->getTranslation('seo_title', 'kk'));
        $this->assertSame('Описание', $product->getTranslation('seo_description', 'ru'));
    }

    #[Test]
    public function stock_cannot_be_set_through_the_product_form(): void
    {
        $product = Product::factory()->create(['stock' => 7]);

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Стул'],
            'stock' => 999,
        ])->assertOk();

        $this->assertSame('7.000', $product->fresh()->stock);
    }

    #[Test]
    public function stock_is_ignored_on_create_too(): void
    {
        $response = $this->postJson('/api/admin/products', [
            'name' => ['ru' => 'Стул'],
            'stock' => 999,
        ])->assertCreated();

        $this->assertSame('0.000', Product::findOrFail($response->json('data.id'))->stock);
    }

    /**
     * The exact shape the admin SPA submits: multipart, `_method=PUT`, every
     * scalar as a string, blanks as "", booleans as "1"/"0".
     */
    #[Test]
    public function the_multipart_payload_the_admin_form_sends_round_trips(): void
    {
        $brand = Brand::factory()->create();
        $product = Product::factory()->create([
            'slug' => 'divan-atlanta',
            'article' => 'ART-OLD',
            'is_new_arrival' => false,
        ]);

        $this->post("/api/admin/products/{$product->id}", [
            '_method' => 'PUT',
            'name' => ['ru' => 'Диван Атланта'],
            'slug' => 'divan-atlanta',
            'code' => 'SKU-001',
            'article' => '',
            'category_id' => '',
            'brand_id' => (string) $brand->id,
            'retail_price' => '150000',
            'b2b_price' => '120000.50',
            'compare_at_price' => '',
            'min_price' => '',
            'purchase_price' => '',
            'b2b_min_order_qty' => '5',
            'uom' => 'шт',
            'weight' => '42.5',
            'volume' => '',
            'country' => 'Казахстан',
            'supplier' => '',
            'is_active' => '1',
            'is_new_arrival' => '1',
        ], ['Accept' => 'application/json'])->assertOk();

        $product->refresh();

        $this->assertSame('divan-atlanta', $product->slug);
        $this->assertSame('SKU-001', $product->code);
        $this->assertNull($product->article, 'a blank string clears the field');
        $this->assertSame($brand->id, $product->brand_id);
        $this->assertSame(15_000_000, $product->retail_price);
        $this->assertSame(12_000_050, $product->b2b_price);
        $this->assertNull($product->compare_at_price);
        $this->assertSame(5, $product->b2b_min_order_qty);
        $this->assertSame('42.500', $product->weight);
        $this->assertNull($product->volume);
        $this->assertSame('Казахстан', $product->country);
        $this->assertTrue($product->is_active);
        $this->assertTrue($product->is_new_arrival);
    }

    #[Test]
    public function images_are_no_longer_accepted_by_the_product_form(): void
    {
        Storage::fake(config('media-library.disk_name'));
        $product = Product::factory()->create();

        $this->post("/api/admin/products/{$product->id}", [
            '_method' => 'PUT',
            'name' => ['ru' => 'Диван'],
            'images' => [UploadedFile::fake()->image('sofa.jpg')],
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertCount(0, $product->fresh()->getMedia(Product::IMAGE_COLLECTION));
    }

    #[Test]
    public function a_product_with_stock_movements_cannot_be_deleted(): void
    {
        $movement = StockMovement::factory()->create();

        $this->deleteJson("/api/admin/products/{$movement->product_id}")
            ->assertUnprocessable()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseHas('products', ['id' => $movement->product_id]);
    }

    #[Test]
    public function a_product_without_movements_is_deleted(): void
    {
        $product = Product::factory()->create();

        $this->deleteJson("/api/admin/products/{$product->id}")->assertNoContent();
        $this->assertDatabaseMissing('products', ['id' => $product->id]);
    }

    #[Test]
    public function a_product_referenced_by_a_goods_receipt_cannot_be_deleted(): void
    {
        $item = GoodsReceiptItem::factory()->create();

        $this->deleteJson("/api/admin/products/{$item->product_id}")
            ->assertUnprocessable()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseHas('products', ['id' => $item->product_id]);
    }

    #[Test]
    public function a_product_on_a_write_off_cannot_be_deleted(): void
    {
        $item = WriteOffItem::factory()->create();

        $this->deleteJson("/api/admin/products/{$item->product_id}")
            ->assertUnprocessable()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseHas('products', ['id' => $item->product_id]);
    }

    #[Test]
    public function a_non_admin_may_not_touch_the_catalog(): void
    {
        Sanctum::actingAs(User::factory()->b2b()->approved()->create());

        $this->postJson('/api/admin/products', [
            'name' => ['ru' => 'Стул'],
        ])->assertStatus(403);
    }

    #[Test]
    public function an_unauthenticated_request_is_rejected(): void
    {
        $this->app['auth']->forgetGuards();

        $this->postJson('/api/admin/products', [
            'name' => ['ru' => 'Стул'],
        ])->assertStatus(401);
    }

    #[Test]
    public function an_unknown_brand_is_rejected(): void
    {
        $this->postJson('/api/admin/products', [
            'name' => ['ru' => 'Стул'],
            'brand_id' => 999999,
        ])->assertStatus(422)->assertJsonValidationErrors('brand_id');
    }

    /**
     * A product that reaches the public catalog with nothing to complain about.
     */
    private function healthyProduct(array $attributes = []): Product
    {
        return Product::factory()->create([
            'category_id' => Category::factory(),
            'retail_price' => 199_000,
            'stock' => 5,
            'is_active' => true,
            ...$attributes,
        ]);
    }

    /**
     * @return list<string>
     */
    private function issuesOf(Product $product): array
    {
        $response = $this->getJson('/api/admin/products')->assertOk();

        $row = collect($response->json('data'))->firstWhere('id', $product->id);

        $this->assertNotNull($row, "Product {$product->id} is missing from the list.");
        $this->assertIsArray($row['issues']);

        return $row['issues'];
    }

    #[Test]
    public function it_flags_a_product_with_no_price(): void
    {
        $product = $this->healthyProduct(['retail_price' => null, 'b2b_price' => null]);

        $this->assertContains('no_price', $this->issuesOf($product));
    }

    #[Test]
    public function it_does_not_flag_a_product_priced_through_a_local_price_type(): void
    {
        // No legacy retail_price column, but a local `retail` price row — which
        // is exactly what PricingService resolves first.
        $product = $this->healthyProduct(['retail_price' => null, 'b2b_price' => null]);

        ProductPrice::factory()
            ->for($product)
            ->for(PriceType::factory()->retail(), 'priceType')
            ->create(['price' => 250_000]);

        $this->assertNotContains('no_price', $this->issuesOf($product));
    }

    #[Test]
    public function it_flags_a_product_in_a_catalog_group(): void
    {
        $product = $this->healthyProduct();
        $product->catalogGroups()->attach(CatalogGroup::factory()->create());

        $issues = $this->issuesOf($product);

        $this->assertContains('hidden_by_group', $issues);
        // The product is fine otherwise — being B2B-only is the whole issue.
        $this->assertSame(['hidden_by_group'], $issues);
    }

    #[Test]
    public function it_flags_an_inactive_out_of_stock_product(): void
    {
        $product = $this->healthyProduct(['is_active' => false, 'stock' => 0]);

        $issues = $this->issuesOf($product);

        $this->assertContains('inactive', $issues);
        $this->assertContains('out_of_stock', $issues);
    }

    #[Test]
    public function it_flags_a_product_with_no_category(): void
    {
        $product = $this->healthyProduct(['category_id' => null]);

        $this->assertSame(['no_category'], $this->issuesOf($product));
    }

    #[Test]
    public function it_reports_no_issues_for_a_publishable_product(): void
    {
        $product = $this->healthyProduct();

        // The slug comes from the Product::created hook, so a locally created
        // product is publishable straight away.
        $this->assertNotNull($product->fresh()->slug);
        $this->assertSame([], $this->issuesOf($product));
    }

    #[Test]
    public function the_issues_filter_returns_only_broken_products(): void
    {
        $healthy = $this->healthyProduct();
        $priceless = $this->healthyProduct(['retail_price' => null, 'b2b_price' => null]);
        $grouped = $this->healthyProduct();
        $grouped->catalogGroups()->attach(CatalogGroup::factory()->create());

        $ids = collect($this->getJson('/api/admin/products?filter[issues]=1')->assertOk()->json('data'))
            ->pluck('id')
            ->all();

        $this->assertEqualsCanonicalizing([$priceless->id, $grouped->id], $ids);
        $this->assertNotContains($healthy->id, $ids);
    }

    #[Test]
    public function the_issues_filter_ignores_a_product_that_is_merely_out_of_stock(): void
    {
        $soldOut = $this->healthyProduct(['stock' => 0]);

        // Selling out is a fact of the business, not a product set up wrongly:
        // it earns a badge but must not drown the "only broken" list.
        $this->assertSame(['out_of_stock'], $this->issuesOf($soldOut));

        $ids = collect($this->getJson('/api/admin/products?filter[issues]=1')->assertOk()->json('data'))
            ->pluck('id')
            ->all();

        $this->assertNotContains($soldOut->id, $ids);
    }

    #[Test]
    public function the_filter_is_off_unless_asked_for(): void
    {
        $healthy = $this->healthyProduct();
        $priceless = $this->healthyProduct(['retail_price' => null, 'b2b_price' => null]);

        $ids = collect($this->getJson('/api/admin/products?filter[issues]=0')->assertOk()->json('data'))
            ->pluck('id')
            ->all();

        $this->assertEqualsCanonicalizing([$healthy->id, $priceless->id], $ids);
    }

    #[Test]
    public function it_computes_issues_without_an_n_plus_one(): void
    {
        $this->healthyProduct();

        // Warm the role/permission lookup the auth middleware caches, so that
        // only the listing itself is being counted.
        $this->getJson('/api/admin/products')->assertOk();

        $onePage = $this->countQueriesListingProducts();

        Product::factory()->count(9)->create(['category_id' => Category::factory()]);
        $fullPage = $this->countQueriesListingProducts();

        $this->assertSame(
            $onePage,
            $fullPage,
            'Listing 10 products must cost the same number of queries as listing 1.',
        );
    }

    private function countQueriesListingProducts(): int
    {
        $queries = 0;
        DB::listen(function () use (&$queries): void {
            $queries++;
        });

        $this->getJson('/api/admin/products')->assertOk();

        return $queries;
    }
}
