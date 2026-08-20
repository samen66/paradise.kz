# Admin Panel Migration & Products DB Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple ERP sync metadata from the `products` table into `product_external_mappings`, build the Laravel Admin API for product CRUD, and scaffold the `/admin` Next.js app with a product-creation page.

**Architecture:** The `products` table becomes self-sufficient for locally created items. ERP-specific columns (`source`, `external_id`, `external_folder_id`, `synced_at`, `barcodes`, `attributes`) move to a new 1:0..1 relationship in `product_external_mappings`. A new `Admin\ProductController` exposes CRUD behind `auth:sanctum` + `role:admin|manager`. A standalone Next.js app (`/admin`) replaces Filament for product management.

**Tech Stack:** Laravel 11.x (PHP 8.3+), MySQL, Sanctum tokens, spatie/laravel-permission, spatie/laravel-medialibrary, Next.js (App Router, TypeScript), Tailwind CSS v4, zustand, @phosphor-icons/react.

## Global Constraints

- PHP 8.3+, `declare(strict_types=1)` in all new PHP files
- PSR-12, early return, no Options API
- Code/variables/comments in English; user-facing text in Russian
- Conventional Commits (`feat:`, `fix:`, `refactor:`)
- МойСклад is the source of truth — never let the admin panel edit ERP-synced fields directly
- No new composer/npm packages unless explicitly justified
- Tests use `RefreshDatabase` trait; media tests use `Storage::fake()`
- All prices stored in tiyn (kopecks); displayed in tenge

## Spec Reference

Full design spec: [`2026-08-20-admin-panel-and-products-refactor-design.md`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/docs/superpowers/specs/2026-08-20-admin-panel-and-products-refactor-design.md)

---

### Task 1: Database Migration — Create `product_external_mappings` and Refactor `products`

**Files:**
- Create: `database/migrations/2026_08_20_000001_extract_erp_fields_to_product_external_mappings.php`
- Test: `tests/Feature/Migrations/ProductExternalMappingsMigrationTest.php`

**Interfaces:**
- Consumes: Existing `products` table with `source`, `external_id`, `external_folder_id`, `synced_at`, `barcodes`, `attributes` columns.
- Produces: New `product_external_mappings` table; `products` table without those six columns; unique constraint moved from `products(source, external_id)` to `product_external_mappings(source, external_id)`.

- [ ] **Step 1: Write the migration test**

```php
<?php
// tests/Feature/Migrations/ProductExternalMappingsMigrationTest.php

declare(strict_types=1);

namespace Tests\Feature\Migrations;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProductExternalMappingsMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_external_mappings_table_exists(): void
    {
        $this->assertTrue(Schema::hasTable('product_external_mappings'));
    }

    public function test_product_external_mappings_has_expected_columns(): void
    {
        $columns = Schema::getColumnListing('product_external_mappings');

        $this->assertContains('id', $columns);
        $this->assertContains('product_id', $columns);
        $this->assertContains('source', $columns);
        $this->assertContains('external_id', $columns);
        $this->assertContains('external_folder_id', $columns);
        $this->assertContains('synced_at', $columns);
        $this->assertContains('barcodes', $columns);
        $this->assertContains('erp_attributes', $columns);
    }

    public function test_products_table_no_longer_has_erp_columns(): void
    {
        $columns = Schema::getColumnListing('products');

        $this->assertNotContains('source', $columns);
        $this->assertNotContains('external_id', $columns);
        $this->assertNotContains('external_folder_id', $columns);
        $this->assertNotContains('synced_at', $columns);
        $this->assertNotContains('barcodes', $columns);
        $this->assertNotContains('attributes', $columns);
    }

    public function test_products_table_retains_catalog_columns(): void
    {
        $columns = Schema::getColumnListing('products');

        $this->assertContains('name', $columns);
        $this->assertContains('slug', $columns);
        $this->assertContains('retail_price', $columns);
        $this->assertContains('b2b_price', $columns);
        $this->assertContains('is_active', $columns);
        $this->assertContains('category_id', $columns);
        $this->assertContains('brand_id', $columns);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/samenuatkhan/PhpstormProjects/paradise.kz && php artisan test tests/Feature/Migrations/ProductExternalMappingsMigrationTest.php`
Expected: FAIL — `product_external_mappings` table does not exist yet, `products` still has `source`/`external_id` columns.

- [ ] **Step 3: Write the migration**

```php
<?php
// database/migrations/2026_08_20_000001_extract_erp_fields_to_product_external_mappings.php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Create the new table
        Schema::create('product_external_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('source');
            $table->string('external_id');
            $table->string('external_folder_id')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->json('barcodes')->nullable();
            $table->json('erp_attributes')->nullable();
            $table->timestamps();

            $table->unique(['source', 'external_id'], 'uniq_source_external');
            $table->index('product_id', 'idx_product_id');
        });

        // 2. Copy existing ERP data from products → product_external_mappings
        DB::statement('
            INSERT INTO product_external_mappings
                (product_id, source, external_id, external_folder_id, synced_at, barcodes, erp_attributes, created_at, updated_at)
            SELECT id, source, external_id, external_folder_id, synced_at, barcodes, attributes, NOW(), NOW()
            FROM products
            WHERE source IS NOT NULL AND external_id IS NOT NULL
        ');

        // 3. Drop the unique constraint from products
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['source', 'external_id']);
        });

        // 4. Drop the migrated columns from products
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['source']);
            $table->dropColumn([
                'source', 'external_id', 'external_folder_id',
                'synced_at', 'barcodes', 'attributes',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('source')->nullable()->after('id');
            $table->string('external_id')->nullable()->after('source');
            $table->string('external_folder_id')->nullable()->after('external_id');
            $table->timestamp('synced_at')->nullable();
            $table->json('barcodes')->nullable();
            $table->json('attributes')->nullable();
        });

        DB::statement('
            UPDATE products
            INNER JOIN product_external_mappings ON products.id = product_external_mappings.product_id
            SET products.source = product_external_mappings.source,
                products.external_id = product_external_mappings.external_id,
                products.external_folder_id = product_external_mappings.external_folder_id,
                products.synced_at = product_external_mappings.synced_at,
                products.barcodes = product_external_mappings.barcodes,
                products.attributes = product_external_mappings.erp_attributes
        ');

        Schema::table('products', function (Blueprint $table) {
            $table->index('source');
            $table->unique(['source', 'external_id']);
        });

        Schema::dropIfExists('product_external_mappings');
    }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/samenuatkhan/PhpstormProjects/paradise.kz && php artisan test tests/Feature/Migrations/ProductExternalMappingsMigrationTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/samenuatkhan/PhpstormProjects/paradise.kz
git add database/migrations/2026_08_20_000001_extract_erp_fields_to_product_external_mappings.php \
  tests/Feature/Migrations/ProductExternalMappingsMigrationTest.php
git commit -m "feat: extract ERP fields from products into product_external_mappings table"
```

---

### Task 2: Models — `ProductExternalMapping` + Refactor `Product`

**Files:**
- Create: `app/Models/ProductExternalMapping.php`
- Modify: `app/Models/Product.php`
- Modify: `database/factories/ProductFactory.php`
- Create: `database/factories/ProductExternalMappingFactory.php`
- Test: `tests/Unit/Models/ProductExternalMappingTest.php`

**Interfaces:**
- Consumes: `product_external_mappings` table (Task 1).
- Produces:
  - `ProductExternalMapping` model: `belongsTo(Product::class)`, `folder(): BelongsTo`
  - `Product::externalMapping(): HasOne<ProductExternalMapping>`
  - `Product::isErpSynced(): bool` — returns `$this->externalMapping !== null`
  - `Product::folder()` removed (replaced by `$product->externalMapping->folder()`)
  - `ProductFactory::definition()` no longer includes `source`/`external_id`
  - `ProductFactory::erpSynced()` state creates an associated mapping
  - `ProductExternalMappingFactory::definition()` provides test defaults

- [ ] **Step 1: Write the unit test**

```php
<?php
// tests/Unit/Models/ProductExternalMappingTest.php

declare(strict_types=1);

namespace Tests\Unit\Models;

use App\Models\Product;
use App\Models\ProductExternalMapping;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductExternalMappingTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_has_external_mapping_relationship(): void
    {
        $product = Product::factory()->create();
        $mapping = ProductExternalMapping::factory()->create(['product_id' => $product->id]);

        $this->assertTrue($product->externalMapping->is($mapping));
    }

    public function test_mapping_belongs_to_product(): void
    {
        $product = Product::factory()->create();
        $mapping = ProductExternalMapping::factory()->create(['product_id' => $product->id]);

        $this->assertTrue($mapping->product->is($product));
    }

    public function test_is_erp_synced_returns_true_when_mapping_exists(): void
    {
        $product = Product::factory()->create();
        ProductExternalMapping::factory()->create(['product_id' => $product->id]);

        $this->assertTrue($product->fresh()->isErpSynced());
    }

    public function test_is_erp_synced_returns_false_when_no_mapping(): void
    {
        $product = Product::factory()->create();

        $this->assertFalse($product->isErpSynced());
    }

    public function test_product_can_be_created_without_erp_fields(): void
    {
        $product = Product::factory()->create();

        $this->assertDatabaseHas('products', ['id' => $product->id]);
        $this->assertFalse($product->isErpSynced());
    }

    public function test_erp_attributes_and_barcodes_are_cast_to_array(): void
    {
        $product = Product::factory()->create();
        $mapping = ProductExternalMapping::factory()->create([
            'product_id' => $product->id,
            'barcodes' => ['123456789', '987654321'],
            'erp_attributes' => ['Цвет' => 'красный'],
        ]);

        $fresh = $mapping->fresh();
        $this->assertIsArray($fresh->barcodes);
        $this->assertIsArray($fresh->erp_attributes);
        $this->assertEquals(['123456789', '987654321'], $fresh->barcodes);
        $this->assertEquals(['Цвет' => 'красный'], $fresh->erp_attributes);
    }

    public function test_cascade_delete_removes_mapping(): void
    {
        $product = Product::factory()->create();
        ProductExternalMapping::factory()->create(['product_id' => $product->id]);

        $product->delete();

        $this->assertDatabaseMissing('product_external_mappings', ['product_id' => $product->id]);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/samenuatkhan/PhpstormProjects/paradise.kz && php artisan test tests/Unit/Models/ProductExternalMappingTest.php`
Expected: FAIL — `ProductExternalMapping` class does not exist.

- [ ] **Step 3: Create `ProductExternalMapping` model**

```php
<?php
// app/Models/ProductExternalMapping.php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductExternalMappingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductExternalMapping extends Model
{
    /** @use HasFactory<ProductExternalMappingFactory> */
    use HasFactory;

    protected $fillable = [
        'product_id',
        'source',
        'external_id',
        'external_folder_id',
        'synced_at',
        'barcodes',
        'erp_attributes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'barcodes' => 'array',
            'erp_attributes' => 'array',
            'synced_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * The ERP product folder via the external_folder_id.
     *
     * @return BelongsTo<ProductFolder, $this>
     */
    public function folder(): BelongsTo
    {
        return $this->belongsTo(ProductFolder::class, 'external_folder_id', 'external_id');
    }
}
```

- [ ] **Step 4: Create `ProductExternalMappingFactory`**

```php
<?php
// database/factories/ProductExternalMappingFactory.php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Product;
use App\Models\ProductExternalMapping;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ProductExternalMapping>
 */
class ProductExternalMappingFactory extends Factory
{
    protected $model = ProductExternalMapping::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'source' => 'moysklad',
            'external_id' => (string) Str::uuid(),
            'external_folder_id' => null,
            'synced_at' => now(),
            'barcodes' => [],
            'erp_attributes' => [],
        ];
    }
}
```

- [ ] **Step 5: Refactor `Product` model**

Update [`app/Models/Product.php`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Models/Product.php):

**Remove from `$fillable`** (lines 36-65):
```diff
 protected $fillable = [
-    'source',
-    'external_id',
-    'external_folder_id',
     'category_id',
     'brand_id',
     ...
-    'barcodes',
-    'attributes',
     'is_active',
-    'synced_at',
     'b2b_min_order_qty',
     ...
 ];
```

**Remove from `casts()`** (lines 70-89):
```diff
 return [
     ...
-    'barcodes' => 'array',
-    'attributes' => 'array',
     'is_active' => 'boolean',
     ...
-    'synced_at' => 'datetime',
     ...
 ];
```

**Replace `folder()` relationship** (lines 141-144) with:
```php
/**
 * @return \Illuminate\Database\Eloquent\Relations\HasOne<ProductExternalMapping, $this>
 */
public function externalMapping(): \Illuminate\Database\Eloquent\Relations\HasOne
{
    return $this->hasOne(ProductExternalMapping::class);
}

/**
 * Whether this product was imported from an external ERP.
 */
public function isErpSynced(): bool
{
    return $this->externalMapping !== null;
}
```

Add the `HasOne` import at the top:
```php
use Illuminate\Database\Eloquent\Relations\HasOne;
```

- [ ] **Step 6: Update `ProductFactory`**

Update [`database/factories/ProductFactory.php`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/database/factories/ProductFactory.php):

```diff
 public function definition(): array
 {
     $retail = fake()->numberBetween(50_000, 500_000);

     return [
-        'source' => 'moysklad',
-        'external_id' => (string) Str::uuid(),
-        'external_folder_id' => null,
         'name' => fake()->words(3, true),
         'code' => (string) fake()->unique()->numerify('#####'),
         ...
         'is_active' => true,
-        'synced_at' => now(),
     ];
 }
+
+/**
+ * Product with an ERP external mapping (simulates МойСклад sync).
+ */
+public function erpSynced(): static
+{
+    return $this->afterCreating(function (Product $product): void {
+        \App\Models\ProductExternalMapping::factory()->create([
+            'product_id' => $product->id,
+        ]);
+    });
+}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd /Users/samenuatkhan/PhpstormProjects/paradise.kz && php artisan test tests/Unit/Models/ProductExternalMappingTest.php`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
cd /Users/samenuatkhan/PhpstormProjects/paradise.kz
git add app/Models/ProductExternalMapping.php app/Models/Product.php \
  database/factories/ProductExternalMappingFactory.php database/factories/ProductFactory.php \
  tests/Unit/Models/ProductExternalMappingTest.php
git commit -m "feat: add ProductExternalMapping model, refactor Product model"
```

---

### Task 3: Update ERP Sync Jobs to Use `product_external_mappings`

**Files:**
- Modify: [`app/Jobs/Catalog/SyncProductsJob.php`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Jobs/Catalog/SyncProductsJob.php)
- Modify: [`app/Jobs/Catalog/SyncSingleProductJob.php`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Jobs/Catalog/SyncSingleProductJob.php)
- Modify: [`app/Jobs/Catalog/SyncProductImagesJob.php`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Jobs/Catalog/SyncProductImagesJob.php)
- Modify: [`app/Jobs/Catalog/SyncProductVariantsJob.php`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Jobs/Catalog/SyncProductVariantsJob.php)
- Modify: [`app/Jobs/Catalog/SyncStockJob.php`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Jobs/Catalog/SyncStockJob.php)
- Modify: [`app/Jobs/Catalog/DeactivateProductJob.php`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Jobs/Catalog/DeactivateProductJob.php)
- Modify: [`app/Http/Resources/ProductResource.php`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Http/Resources/ProductResource.php)
- Modify: [`app/Http/Controllers/Api/ProductController.php`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Http/Controllers/Api/ProductController.php) (B2B)
- Modify: [`app/Filament/Resources/Products/Schemas/ProductForm.php`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Filament/Resources/Products/Schemas/ProductForm.php)
- Test: `tests/Feature/Catalog/SyncProductsJobRefactorTest.php`

**Interfaces:**
- Consumes: `Product::externalMapping()`, `ProductExternalMapping` model (Task 2).
- Produces: All sync jobs use `product_external_mappings` for `source`/`external_id` lookups. Both tables upserted atomically. All existing functionality preserved.

- [ ] **Step 1: Write the regression test**

```php
<?php
// tests/Feature/Catalog/SyncProductsJobRefactorTest.php

declare(strict_types=1);

namespace Tests\Feature\Catalog;

use App\Contracts\Catalog\CatalogSource;
use App\Jobs\Catalog\SyncProductsJob;
use App\Models\Product;
use App\Models\ProductExternalMapping;
use App\Services\Catalog\Data\CatalogProduct;
use Generator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SyncProductsJobRefactorTest extends TestCase
{
    use RefreshDatabase;

    public function test_sync_creates_product_and_mapping(): void
    {
        $source = $this->mockSource([
            new CatalogProduct(
                externalId: 'ext-001', name: 'Test Product',
                code: 'TP-001', article: 'ART-001',
                description: 'Test description', externalFolderId: null,
                retailPrice: 100_000, b2bPrice: 80_000,
                purchasePrice: 50_000, minPrice: 60_000,
                uom: 'шт', weight: 1.5, volume: 0.01,
                country: 'Китай', supplier: 'Test Supplier',
                barcodes: ['1234567890'],
                attributes: ['Цвет' => 'красный'],
                images: [],
            ),
        ]);

        (new SyncProductsJob())->handle($source);

        $this->assertDatabaseCount('products', 1);
        $this->assertDatabaseCount('product_external_mappings', 1);

        $product = Product::first();
        $this->assertEquals('Test Product', $product->getTranslation('name', 'ru'));
        $this->assertEquals(100_000, $product->retail_price);

        $mapping = ProductExternalMapping::first();
        $this->assertEquals($product->id, $mapping->product_id);
        $this->assertEquals('moysklad', $mapping->source);
        $this->assertEquals('ext-001', $mapping->external_id);
        $this->assertEquals(['1234567890'], $mapping->barcodes);
        $this->assertEquals(['Цвет' => 'красный'], $mapping->erp_attributes);
    }

    public function test_sync_upsert_preserves_is_active(): void
    {
        $product = Product::factory()->create(['is_active' => false]);
        ProductExternalMapping::factory()->create([
            'product_id' => $product->id,
            'source' => 'moysklad',
            'external_id' => 'ext-existing',
        ]);

        $source = $this->mockSource([
            new CatalogProduct(
                externalId: 'ext-existing', name: 'Updated Name',
                code: null, article: null, description: null,
                externalFolderId: null,
                retailPrice: 200_000, b2bPrice: null,
                purchasePrice: null, minPrice: null,
                uom: null, weight: null, volume: null,
                country: null, supplier: null,
                barcodes: [], attributes: [], images: [],
            ),
        ]);

        (new SyncProductsJob())->handle($source);

        $product->refresh();
        $this->assertFalse($product->is_active);
        $this->assertEquals(200_000, $product->retail_price);
    }

    /** @param list<CatalogProduct> $products */
    private function mockSource(array $products): CatalogSource
    {
        $source = $this->createMock(CatalogSource::class);
        $source->method('key')->willReturn('moysklad');
        $source->method('products')->willReturnCallback(
            function () use ($products): Generator { yield from $products; }
        );

        return $source;
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/samenuatkhan/PhpstormProjects/paradise.kz && php artisan test tests/Feature/Catalog/SyncProductsJobRefactorTest.php`
Expected: FAIL — `SyncProductsJob` tries to write `source`/`external_id` into `products` (column doesn't exist).

- [ ] **Step 3: Refactor `SyncProductsJob`**

Rewrite [`SyncProductsJob`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Jobs/Catalog/SyncProductsJob.php):
- `handle()` now separates catalog data from ERP mapping data.
- `flush()` uses a two-phase approach:
  1. Look up existing mappings by `(source, external_id)` to get `product_id`s.
  2. For known products: `UPDATE products SET ... WHERE id IN (...)`.
  3. For new products: `INSERT INTO products`, then `INSERT INTO product_external_mappings`.
  4. For all products: upsert `product_external_mappings` with the ERP metadata.
- `mergeTranslatables()` updated to look up by `product_id` (via the mapping join) instead of by `external_id` directly on products.

- [ ] **Step 4: Refactor `SyncSingleProductJob`**

Same pattern as `SyncProductsJob` but for a single product:
```php
// Find product via mapping, not via products.source
$mapping = ProductExternalMapping::query()
    ->where('source', $sourceKey)
    ->where('external_id', $product->externalId)
    ->first();

// For existing: update the product; update the mapping.
// For new: create the product; create the mapping.
```

- [ ] **Step 5: Refactor `SyncProductImagesJob`**

Change product lookup in [`SyncProductImagesJob::handle()`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Jobs/Catalog/SyncProductImagesJob.php#L39-L48):
```php
// Before:
$product = Product::query()
    ->where('source', $this->source)
    ->where('external_id', $this->externalId)
    ->first();

// After:
$mapping = ProductExternalMapping::query()
    ->where('source', $this->source)
    ->where('external_id', $this->externalId)
    ->first();
$product = $mapping?->product;
```

- [ ] **Step 6: Refactor `SyncProductVariantsJob`**

Change product ID lookup in [`SyncProductVariantsJob::handle()`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Jobs/Catalog/SyncProductVariantsJob.php#L40):
```php
// Before:
$productIds = Product::query()->where('source', $sourceKey)->pluck('id', 'external_id');

// After:
$productIds = ProductExternalMapping::query()
    ->where('source', $sourceKey)
    ->pluck('product_id', 'external_id');
```

- [ ] **Step 7: Refactor `SyncStockJob`**

Change product ID lookup in [`SyncStockJob::handle()`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Jobs/Catalog/SyncStockJob.php#L61):
```php
// Before:
$productIds = Product::query()->where('source', $sourceKey)->pluck('id', 'external_id');

// After:
$productIds = ProductExternalMapping::query()
    ->where('source', $sourceKey)
    ->pluck('product_id', 'external_id');
```

- [ ] **Step 8: Refactor `DeactivateProductJob`**

In [`DeactivateProductJob::handle()`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Jobs/Catalog/DeactivateProductJob.php#L25-L31):
```php
// Before:
Product::query()
    ->where('source', (string) config('erp.provider'))
    ->where('external_id', $this->externalId)
    ->update(['is_active' => false]);

// After:
$mapping = ProductExternalMapping::query()
    ->where('source', (string) config('erp.provider'))
    ->where('external_id', $this->externalId)
    ->first();

if ($mapping !== null) {
    Product::query()->where('id', $mapping->product_id)->update(['is_active' => false]);
}
```

- [ ] **Step 9: Update `ProductResource`**

In [`ProductResource::toArray()`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Http/Resources/ProductResource.php#L28-L112):
```php
// Replace direct field references:
'external_id' => $this->whenLoaded('externalMapping',
    fn () => $this->externalMapping?->external_id),
'external_folder_id' => $this->whenLoaded('externalMapping',
    fn () => $this->externalMapping?->external_folder_id),
'barcodes' => $this->whenLoaded('externalMapping',
    fn () => $this->externalMapping?->barcodes ?? [], []),
'attributes' => $this->whenLoaded('externalMapping',
    fn () => $this->externalMapping?->erp_attributes ?? [], []),
'is_erp_synced' => $this->whenLoaded('externalMapping',
    fn () => $this->externalMapping !== null, false),
```

- [ ] **Step 10: Update B2B `ProductController`**

In [`ProductController`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Http/Controllers/Api/ProductController.php):
- Add `'externalMapping'` to the `with()` call in `index()` and `show()`.
- Update the category filter from `external_folder_id` to `category_id` (if not already done).

- [ ] **Step 11: Update Filament `ProductForm`**

In [`ProductForm`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/app/Filament/Resources/Products/Schemas/ProductForm.php), the "ERP Sync" section (lines 140-181) reads `source`, `external_id`, etc. directly from the product. These now live on the relationship. Update to use `externalMapping.source`, `externalMapping.external_id`, etc. via the Filament relationship path notation, or conditionally show the section only when the mapping exists.

- [ ] **Step 12: Run the regression test**

Run: `cd /Users/samenuatkhan/PhpstormProjects/paradise.kz && php artisan test tests/Feature/Catalog/SyncProductsJobRefactorTest.php`
Expected: PASS

- [ ] **Step 13: Run the full test suite**

Run: `cd /Users/samenuatkhan/PhpstormProjects/paradise.kz && php artisan test`
Expected: All tests pass. Fix any failures from factory/model changes (tests that relied on `Product::factory()` producing `source`/`external_id` should use `->erpSynced()` instead).

- [ ] **Step 14: Commit**

```bash
cd /Users/samenuatkhan/PhpstormProjects/paradise.kz
git add app/Jobs/Catalog/ app/Http/Resources/ProductResource.php \
  app/Http/Controllers/Api/ProductController.php \
  app/Filament/Resources/Products/ tests/
git commit -m "refactor: update all ERP sync jobs and resources to use product_external_mappings"
```

---

### Task 4: Laravel Admin API — Product CRUD

**Files:**
- Create: `app/Http/Controllers/Api/Admin/ProductController.php`
- Create: `app/Http/Requests/Admin/ProductStoreRequest.php`
- Create: `app/Http/Requests/Admin/ProductUpdateRequest.php`
- Create: `app/Http/Resources/Admin/ProductResource.php`
- Modify: [`routes/api.php`](file:///Users/samenuatkhan/PhpstormProjects/paradise.kz/routes/api.php)
- Test: `tests/Feature/Admin/AdminProductControllerTest.php`

**Interfaces:**
- Consumes: `Product` model (Task 2), spatie/laravel-medialibrary, spatie/laravel-permission.
- Produces:
  - `POST /api/admin/products` → 201
  - `GET /api/admin/products` → 200 paginated
  - `GET /api/admin/products/{id}` → 200 with relations
  - `PUT /api/admin/products/{id}` → 200
  - `DELETE /api/admin/products/{id}` → 204
  - Non-admin → 403, Unauthenticated → 401

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Admin/AdminProductControllerTest.php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AdminProductControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('media-library.disk_name'));
        Role::findOrCreate('admin', 'web');
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    }

    public function test_unauthenticated_cannot_access(): void
    {
        $this->getJson('/api/admin/products')->assertUnauthorized();
    }

    public function test_non_admin_cannot_access(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/products')
            ->assertForbidden();
    }

    public function test_admin_can_list_products(): void
    {
        Product::factory()->count(3)->create();
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/products')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_admin_can_create_product(): void
    {
        $category = Category::factory()->create();
        $brand = Brand::factory()->create();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/products', [
                'name' => 'Кресло Палермо',
                'description' => 'Мягкое кресло',
                'category_id' => $category->id,
                'brand_id' => $brand->id,
                'retail_price' => 150_000,
                'b2b_price' => 120_000,
                'is_active' => true,
                'is_new_arrival' => false,
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Кресло Палермо')
            ->assertJsonPath('data.is_erp_synced', false);

        $this->assertDatabaseHas('products', ['retail_price' => 150_000]);
    }

    public function test_admin_can_create_product_with_images(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/products', [
                'name' => 'Test Product',
                'is_active' => true,
                'images' => [UploadedFile::fake()->image('photo1.jpg', 200, 200)],
            ])
            ->assertCreated();

        $this->assertCount(1, Product::first()->getMedia(Product::IMAGE_COLLECTION));
    }

    public function test_admin_can_update_product(): void
    {
        $product = Product::factory()->create(['retail_price' => 100_000]);

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/admin/products/{$product->id}", [
                'name' => 'Updated', 'retail_price' => 200_000,
            ])
            ->assertOk()
            ->assertJsonPath('data.retail_price', 200_000);
    }

    public function test_admin_can_delete_product(): void
    {
        $product = Product::factory()->create();

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/admin/products/{$product->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('products', ['id' => $product->id]);
    }

    public function test_admin_can_show_product(): void
    {
        $product = Product::factory()->create();

        $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $product->id);
    }

    public function test_manager_can_access(): void
    {
        Role::findOrCreate('manager', 'web');
        $manager = User::factory()->create();
        $manager->assignRole('manager');
        Product::factory()->create();

        $this->actingAs($manager, 'sanctum')
            ->getJson('/api/admin/products')
            ->assertOk();
    }

    public function test_create_requires_name(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/products', ['is_active' => true])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/samenuatkhan/PhpstormProjects/paradise.kz && php artisan test tests/Feature/Admin/AdminProductControllerTest.php`
Expected: FAIL — route `/api/admin/products` not defined.

- [ ] **Step 3: Add admin route group to `routes/api.php`**

Append after the `account` group (after line 126):
```php
use App\Http\Controllers\Api\Admin\ProductController as AdminProductController;

Route::prefix('admin')
    ->middleware(['auth:sanctum', 'role:admin|manager'])
    ->group(function () {
        Route::apiResource('products', AdminProductController::class);
    });
```

- [ ] **Step 4: Create `ProductStoreRequest`**

```php
<?php
// app/Http/Requests/Admin/ProductStoreRequest.php
declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ProductStoreRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'code' => ['nullable', 'string', 'max:255'],
            'article' => ['nullable', 'string', 'max:255'],
            'retail_price' => ['nullable', 'integer', 'min:0'],
            'b2b_price' => ['nullable', 'integer', 'min:0'],
            'purchase_price' => ['nullable', 'integer', 'min:0'],
            'min_price' => ['nullable', 'integer', 'min:0'],
            'compare_at_price' => ['nullable', 'integer', 'min:0'],
            'weight' => ['nullable', 'numeric', 'min:0'],
            'volume' => ['nullable', 'numeric', 'min:0'],
            'uom' => ['nullable', 'string', 'max:50'],
            'country' => ['nullable', 'string', 'max:255'],
            'supplier' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
            'is_new_arrival' => ['boolean'],
            'b2b_min_order_qty' => ['nullable', 'integer', 'min:1'],
            'images' => ['nullable', 'array'],
            'images.*' => ['image', 'max:5120'],
        ];
    }
}
```

- [ ] **Step 5: Create `ProductUpdateRequest`**

Same as `ProductStoreRequest` but with `'name' => ['sometimes', 'required', ...]`.

- [ ] **Step 6: Create Admin `ProductResource`**

Admin-specific resource exposing all fields including costs, ERP status badge, formatted prices.

- [ ] **Step 7: Create Admin `ProductController`**

Standard `apiResource` controller with `index()`, `store()`, `show()`, `update()`, `destroy()`. Uses `spatie/laravel-query-builder` for filterable `index()`.

- [ ] **Step 8: Run tests**

Run: `cd /Users/samenuatkhan/PhpstormProjects/paradise.kz && php artisan test tests/Feature/Admin/AdminProductControllerTest.php`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
cd /Users/samenuatkhan/PhpstormProjects/paradise.kz
git add app/Http/Controllers/Api/Admin/ app/Http/Requests/Admin/ \
  app/Http/Resources/Admin/ routes/api.php \
  tests/Feature/Admin/AdminProductControllerTest.php
git commit -m "feat: add Admin Product CRUD API endpoints"
```

---

### Task 5: Scaffold `/admin` Next.js Project

**Files:**
- Create: `admin/` directory (via `create-next-app`)
- Create: `admin/src/lib/api.ts` — fetch wrapper with auth token
- Create: `admin/src/lib/auth.ts` — login/me/logout helpers
- Create: `admin/src/stores/authStore.ts` — zustand auth state
- Modify: `admin/src/app/layout.tsx` — admin shell (sidebar + topbar)
- Modify: `admin/src/app/page.tsx` — dashboard placeholder

**Interfaces:**
- Consumes: Laravel Admin API (`/api/admin/products`, `/api/auth/login`, `/api/auth/me`).
- Produces: Runnable admin app at `http://localhost:3001` with Tailwind v4, zustand, API client.

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/samenuatkhan/PhpstormProjects/paradise.kz
npx -y create-next-app@latest ./admin --ts --tailwind --eslint --app --src-dir --no-import-alias --turbopack
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/samenuatkhan/PhpstormProjects/paradise.kz/admin
npm install zustand @phosphor-icons/react
```

- [ ] **Step 3: Create `admin/src/lib/api.ts`** — API client with token management
- [ ] **Step 4: Create `admin/src/lib/auth.ts`** — auth helpers
- [ ] **Step 5: Create `admin/src/stores/authStore.ts`** — zustand auth store
- [ ] **Step 6: Build admin shell layout** — sidebar with navigation, topbar with user info
- [ ] **Step 7: Dashboard placeholder page**
- [ ] **Step 8: Verify the app runs**

```bash
cd /Users/samenuatkhan/PhpstormProjects/paradise.kz/admin && npm run dev -- --port 3001
```

- [ ] **Step 9: Commit**

```bash
cd /Users/samenuatkhan/PhpstormProjects/paradise.kz
git add admin/
git commit -m "feat: scaffold admin Next.js project with auth and API client"
```

---

### Task 6: Admin Login Page

**Files:**
- Create: `admin/src/app/login/page.tsx`
- Create: `admin/src/components/layout/AuthGuard.tsx`
- Modify: `admin/src/app/layout.tsx` — wrap with AuthGuard

**Interfaces:**
- Consumes: `useAuthStore`, `login()`, `fetchMe()` (Task 5).
- Produces: `/login` page, `AuthGuard` redirects unauthenticated to `/login`.

- [ ] **Step 1: Create `AuthGuard` component** — checks token, fetches `/api/auth/me`, redirects to `/login` if no valid session
- [ ] **Step 2: Create login page** — phone + password form, dark theme matching admin shell
- [ ] **Step 3: Integrate `AuthGuard` into layout**
- [ ] **Step 4: Verify manually** — redirect to login, successful login redirects to dashboard
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add admin login page with auth guard"
```

---

### Task 7: Admin Product List Page

**Files:**
- Create: `admin/src/app/products/page.tsx`
- Create: `admin/src/components/products/ProductTable.tsx`
- Create: `admin/src/components/ui/Table.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/products` (Task 4).
- Produces: `/products` page with searchable, paginated product table. "Создать товар" button links to `/products/create`.

- [ ] **Step 1: Create reusable Table component**
- [ ] **Step 2: Create ProductTable component** — columns: image, name, price, stock, status, ERP badge
- [ ] **Step 3: Create product list page** — search input + ProductTable + pagination
- [ ] **Step 4: Verify manually**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add admin product list page"
```

---

### Task 8: Admin Product Create/Edit Form

**Files:**
- Create: `admin/src/app/products/create/page.tsx`
- Create: `admin/src/app/products/[id]/page.tsx`
- Create: `admin/src/components/products/ProductForm.tsx`
- Create: `admin/src/components/ui/FileUpload.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/products`, `PUT /api/admin/products/{id}`, `GET /api/admin/products/{id}`.
- Produces: Rich form with sections (Основная информация, Медиа, Цены, Категоризация, Физические параметры, Флаги). Multipart/form-data submission for images. Edit page pre-fills from API.

- [ ] **Step 1: Create FileUpload component** — drag-and-drop, preview, reorder
- [ ] **Step 2: Create ProductForm component** — 6 sections per spec §3.2
- [ ] **Step 3: Create product create page** — `POST` on submit, redirect to list
- [ ] **Step 4: Create product edit page** — fetch + pre-fill, `PUT` on submit
- [ ] **Step 5: Verify manually** — create a product with images, verify it appears in storefront
- [ ] **Step 6: Commit**

```bash
git commit -m "feat: add admin product create and edit pages"
```

---

### Task 9: Full Suite Verification & Cleanup

**Files:** No new files

**Interfaces:**
- Consumes: Everything from Tasks 1–8.
- Produces: Clean test suite, verified builds.

- [ ] **Step 1: Run the complete PHP test suite**

```bash
cd /Users/samenuatkhan/PhpstormProjects/paradise.kz && php artisan test
```
Expected: All PASS.

- [ ] **Step 2: Verify admin frontend builds**

```bash
cd /Users/samenuatkhan/PhpstormProjects/paradise.kz/admin && npm run build
```
Expected: No errors.

- [ ] **Step 3: Verify storefront builds (no regressions)**

```bash
cd /Users/samenuatkhan/PhpstormProjects/paradise.kz/storefront && npm run build
```
Expected: No errors.

- [ ] **Step 4: Manual end-to-end verification**

1. `php artisan serve` + `cd admin && npm run dev`
2. Login at `http://localhost:3001/login`
3. Create product with images at `/products/create`
4. Verify product in storefront
5. Verify МойСклад-synced products still display correctly
6. Trigger manual sync: `php artisan tinker --execute="dispatch(new \App\Jobs\Catalog\SyncProductsJob())"`

- [ ] **Step 5: Final commit**

```bash
git commit -m "chore: final cleanup after admin panel migration"
```
