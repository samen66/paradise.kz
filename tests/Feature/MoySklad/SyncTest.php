<?php

declare(strict_types=1);

namespace Tests\Feature\MoySklad;

use App\Jobs\Catalog\DeactivateProductJob;
use App\Jobs\Catalog\SyncProductFoldersJob;
use App\Jobs\Catalog\SyncProductImagesJob;
use App\Jobs\Catalog\SyncProductsJob;
use App\Jobs\Catalog\SyncProductVariantsJob;
use App\Jobs\Catalog\SyncSingleProductJob;
use App\Jobs\Catalog\SyncStockJob;
use App\Jobs\Catalog\SyncStoresJob;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductFolder;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Services\MoySklad\MoySkladService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SyncTest extends TestCase
{
    use RefreshDatabase;

    private const B2B_PRICE_TYPE_ID = '672559f1-cbf3-11e1-9eb9-889ffa6f49fd';

    private const BASE = 'https://api.moysklad.ru/api/remap/1.2';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'moysklad.token' => 'test-token',
            'moysklad.b2b_price_type_id' => self::B2B_PRICE_TYPE_ID,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function folderRow(string $id, string $name, ?string $parentId = null): array
    {
        $row = [
            'id' => $id,
            'name' => $name,
            'pathName' => $name,
        ];

        if ($parentId !== null) {
            $row['productFolder'] = [
                'meta' => ['href' => self::BASE.'/entity/productfolder/'.$parentId],
            ];
        }

        return $row;
    }

    /**
     * @return array<string, mixed>
     */
    private function productRow(string $id, string $name, int $b2bPrice, ?string $folderId = null): array
    {
        $row = [
            'id' => $id,
            'name' => $name,
            'code' => 'C-'.$id,
            'article' => 'A-'.$id,
            'description' => 'desc '.$name,
            'salePrices' => [
                ['value' => 250000, 'priceType' => ['id' => 'retail-type']],
                ['value' => $b2bPrice, 'priceType' => ['id' => self::B2B_PRICE_TYPE_ID]],
            ],
        ];

        if ($folderId !== null) {
            $row['productFolder'] = [
                'meta' => ['href' => self::BASE.'/entity/productfolder/'.$folderId],
            ];
        }

        return $row;
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    private function listResponse(array $rows): array
    {
        return ['rows' => $rows, 'meta' => ['size' => count($rows)]];
    }

    #[Test]
    public function it_upserts_product_folders(): void
    {
        Http::fake([
            self::BASE.'/entity/productfolder*' => Http::response($this->listResponse([
                $this->folderRow('folder-1', 'Мебель'),
                $this->folderRow('folder-2', 'Диваны', 'folder-1'),
            ])),
        ]);

        (new SyncProductFoldersJob)->handle(app(MoySkladService::class));

        $this->assertDatabaseCount('product_folders', 2);
        $this->assertDatabaseHas('product_folders', [
            'external_id' => 'folder-2',
            'name' => 'Диваны',
            'parent_external_id' => 'folder-1',
        ]);
    }

    #[Test]
    public function folder_resync_updates_changed_fields(): void
    {
        ProductFolder::factory()->create([
            'external_id' => 'folder-1',
            'name' => 'Старое имя',
            'path_name' => 'Старое имя',
        ]);

        Http::fake([
            self::BASE.'/entity/productfolder*' => Http::response($this->listResponse([
                $this->folderRow('folder-1', 'Новое имя'),
            ])),
        ]);

        (new SyncProductFoldersJob)->handle(app(MoySkladService::class));

        $this->assertDatabaseCount('product_folders', 1);
        $this->assertDatabaseHas('product_folders', [
            'external_id' => 'folder-1',
            'name' => 'Новое имя',
        ]);
    }

    #[Test]
    public function it_upserts_products_with_b2b_price_in_kopecks_and_synced_at(): void
    {
        Http::fake([
            self::BASE.'/entity/assortment*' => Http::response($this->listResponse([
                $this->productRow('prod-1', 'Диван Люкс', 180000, 'folder-2'),
            ])),
        ]);

        (new SyncProductsJob)->handle(app(MoySkladService::class));

        $this->assertDatabaseCount('products', 1);

        $product = Product::where('external_id', 'prod-1')->firstOrFail();

        $this->assertSame('Диван Люкс', $product->name);
        $this->assertSame(180000, $product->b2b_price);
        $this->assertSame(250000, $product->retail_price);
        $this->assertSame('folder-2', $product->external_folder_id);
        $this->assertTrue($product->is_active);
        $this->assertNotNull($product->synced_at);
    }

    #[Test]
    public function it_dispatches_image_sync_only_for_products_that_have_images(): void
    {
        Bus::fake();

        $withImage = $this->productRow('prod-1', 'С картинкой', 180000);
        $withImage['images'] = ['rows' => [[
            'meta' => [
                'href' => self::BASE.'/entity/product/prod-1/images/img-1',
                'downloadHref' => self::BASE.'/download/img-1',
            ],
            'filename' => 'sofa.png',
            'size' => 14052,
            'updated' => '2026-06-26 10:00:00.000',
        ]]];

        Http::fake([
            self::BASE.'/entity/assortment*' => Http::response($this->listResponse([
                $withImage,
                $this->productRow('prod-2', 'Без картинки', 90000),
            ])),
        ]);

        (new SyncProductsJob)->handle(app(MoySkladService::class));

        // Only prod-1 carries images, so exactly one image-sync job is queued.
        Bus::assertDispatchedTimes(SyncProductImagesJob::class, 1);
    }

    #[Test]
    public function product_resync_does_not_reset_a_manually_disabled_is_active(): void
    {
        // Admin hid this product locally (source-of-truth rule: a re-sync must
        // not flip is_active back to visible).
        Product::factory()->inactive()->create([
            'external_id' => 'prod-1',
            'name' => 'Старое имя',
            'b2b_price' => 100000,
        ]);

        Http::fake([
            self::BASE.'/entity/assortment*' => Http::response($this->listResponse([
                $this->productRow('prod-1', 'Новое имя', 199000),
            ])),
        ]);

        (new SyncProductsJob)->handle(app(MoySkladService::class));

        $product = Product::where('external_id', 'prod-1')->firstOrFail();

        // Synced fields updated...
        $this->assertSame('Новое имя', $product->name);
        $this->assertSame(199000, $product->b2b_price);
        // ...but the local-only flag is preserved.
        $this->assertFalse($product->is_active);
    }

    #[Test]
    public function product_resync_does_not_reset_a_manually_assigned_category_or_brand(): void
    {
        // Admin locally categorised this product (independent of the ERP's own
        // folder tree — a re-sync must not touch or clear it).
        $category = Category::factory()->create();
        $brand = Brand::factory()->create();
        Product::factory()->create([
            'external_id' => 'prod-1',
            'name' => 'Старое имя',
            'category_id' => $category->id,
            'brand_id' => $brand->id,
        ]);

        Http::fake([
            self::BASE.'/entity/assortment*' => Http::response($this->listResponse([
                $this->productRow('prod-1', 'Новое имя', 199000),
            ])),
        ]);

        (new SyncProductsJob)->handle(app(MoySkladService::class));

        $product = Product::where('external_id', 'prod-1')->firstOrFail();

        // Synced field updated...
        $this->assertSame('Новое имя', $product->name);
        // ...but the local-only assignments are preserved.
        $this->assertSame($category->id, $product->category_id);
        $this->assertSame($brand->id, $product->brand_id);
    }

    #[Test]
    public function single_product_sync_fetches_one_product_and_upserts_it(): void
    {
        Http::fake([
            self::BASE.'/entity/product/prod-1*' => Http::response(
                $this->productRow('prod-1', 'Диван Люкс', 180000, 'folder-2'),
            ),
        ]);

        (new SyncSingleProductJob('prod-1'))->handle(app(MoySkladService::class));

        $this->assertDatabaseCount('products', 1);
        $product = Product::where('external_id', 'prod-1')->firstOrFail();
        $this->assertSame('Диван Люкс', $product->name);
        $this->assertSame(180000, $product->b2b_price);
        $this->assertTrue($product->is_active);
    }

    #[Test]
    public function single_product_sync_preserves_a_manually_disabled_is_active(): void
    {
        Product::factory()->inactive()->create([
            'external_id' => 'prod-1',
            'name' => 'Старое имя',
            'b2b_price' => 100000,
        ]);

        Http::fake([
            self::BASE.'/entity/product/prod-1*' => Http::response(
                $this->productRow('prod-1', 'Новое имя', 199000),
            ),
        ]);

        (new SyncSingleProductJob('prod-1'))->handle(app(MoySkladService::class));

        $product = Product::where('external_id', 'prod-1')->firstOrFail();
        $this->assertSame('Новое имя', $product->name);
        $this->assertFalse($product->is_active);
    }

    #[Test]
    public function deactivate_product_job_hides_the_local_mirror(): void
    {
        Product::factory()->create(['external_id' => 'prod-1', 'is_active' => true]);

        (new DeactivateProductJob('prod-1'))->handle();

        $this->assertFalse(Product::where('external_id', 'prod-1')->firstOrFail()->is_active);
    }

    #[Test]
    public function it_upserts_stores(): void
    {
        Http::fake([
            self::BASE.'/entity/store*' => Http::response($this->listResponse([
                ['id' => 'store-1', 'name' => 'Астана'],
                ['id' => 'store-2', 'name' => 'Алматы'],
            ])),
        ]);

        (new SyncStoresJob)->handle(app(MoySkladService::class));

        $this->assertDatabaseCount('stores', 2);
        $this->assertDatabaseHas('stores', [
            'external_id' => 'store-1',
            'name' => 'Астана',
            'is_active' => true,
        ]);
    }

    #[Test]
    public function store_resync_does_not_reset_a_manually_disabled_is_active(): void
    {
        Store::factory()->inactive()->create(['external_id' => 'store-1', 'name' => 'Старое имя']);

        Http::fake([
            self::BASE.'/entity/store*' => Http::response($this->listResponse([
                ['id' => 'store-1', 'name' => 'Новое имя'],
            ])),
        ]);

        (new SyncStoresJob)->handle(app(MoySkladService::class));

        $store = Store::where('external_id', 'store-1')->firstOrFail();
        $this->assertSame('Новое имя', $store->name);
        $this->assertFalse($store->is_active);
    }

    #[Test]
    public function stock_job_upserts_per_store_stock_and_recomputes_the_aggregate(): void
    {
        $product1 = Product::factory()->create(['external_id' => 'prod-1', 'stock' => 0]);
        $product2 = Product::factory()->create(['external_id' => 'prod-2', 'stock' => 0]);
        $untouched = Product::factory()->create(['external_id' => 'prod-3', 'stock' => 7]);

        $store1 = Store::factory()->create(['external_id' => 'store-1']);
        $store2 = Store::factory()->create(['external_id' => 'store-2']);

        Http::fake([
            self::BASE.'/report/stock/bystore/current*' => Http::response([
                ['assortmentId' => 'prod-1', 'storeId' => 'store-1', 'freeStock' => 8],
                ['assortmentId' => 'prod-1', 'storeId' => 'store-2', 'freeStock' => 4.5],
                ['assortmentId' => 'prod-2', 'storeId' => 'store-1', 'freeStock' => 3],
                // prod-9 has no local row → skipped.
                ['assortmentId' => 'prod-9', 'storeId' => 'store-1', 'freeStock' => 99],
            ]),
        ]);

        (new SyncStockJob)->handle(app(MoySkladService::class));

        $this->assertDatabaseHas('product_store_stock', [
            'product_id' => $product1->id,
            'store_id' => $store1->id,
            'stock' => 8,
        ]);
        $this->assertDatabaseHas('product_store_stock', [
            'product_id' => $product1->id,
            'store_id' => $store2->id,
            'stock' => 4.5,
        ]);

        // Aggregate is the sum across stores.
        $this->assertEqualsWithDelta(12.5, (float) $product1->fresh()->stock, 0.001);
        $this->assertEqualsWithDelta(3.0, (float) $product2->fresh()->stock, 0.001);
        // Not in the report → left untouched.
        $this->assertEqualsWithDelta(7.0, (float) $untouched->fresh()->stock, 0.001);
    }

    #[Test]
    public function it_upserts_variants_linked_to_their_parent_and_skips_orphans(): void
    {
        $parent = Product::factory()->create(['external_id' => 'prod-1']);

        Http::fake([
            self::BASE.'/entity/variant*' => Http::response($this->listResponse([
                [
                    'id' => 'var-1',
                    'name' => 'Диван Люкс / красный',
                    'code' => 'V-1',
                    'product' => ['meta' => ['href' => self::BASE.'/entity/product/prod-1']],
                    'salePrices' => [
                        ['value' => 250000, 'priceType' => ['id' => 'retail-type']],
                        ['value' => 180000, 'priceType' => ['id' => self::B2B_PRICE_TYPE_ID]],
                    ],
                    'barcodes' => [['ean13' => '4600000000017']],
                    'characteristics' => [['name' => 'Цвет', 'value' => 'красный']],
                ],
                // Parent product not mirrored locally → skipped.
                [
                    'id' => 'var-orphan',
                    'name' => 'Бесхозная модификация',
                    'product' => ['meta' => ['href' => self::BASE.'/entity/product/prod-unknown']],
                ],
            ])),
        ]);

        (new SyncProductVariantsJob)->handle(app(MoySkladService::class));

        $this->assertDatabaseCount('product_variants', 1);

        $variant = ProductVariant::where('external_id', 'var-1')->firstOrFail();
        $this->assertSame($parent->id, $variant->product_id);
        $this->assertSame(180000, $variant->b2b_price);
        $this->assertSame(['4600000000017'], $variant->barcodes);
        $this->assertSame(['Цвет' => 'красный'], $variant->characteristics);
    }
}
