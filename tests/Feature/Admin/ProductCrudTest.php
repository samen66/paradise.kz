<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\CatalogGroup;
use App\Models\Category;
use App\Models\PriceType;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * The admin product list, and the `issues` it reports for every product.
 *
 * A product silently missing from the storefront is the manager's blind spot:
 * VisibilityService and PricingService already decide it is not publishable,
 * but nothing said so out loud. These tests pin what gets reported — they do
 * not re-test those services, which own the rules.
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
