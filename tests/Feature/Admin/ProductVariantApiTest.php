<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Attribute;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ProductVariantApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        Storage::fake(config('media-library.disk_name'));
    }

    private function photo(Product $product, string $name = 'a.jpg'): Media
    {
        return $product->addMedia(UploadedFile::fake()->image($name))->toMediaCollection(Product::IMAGE_COLLECTION);
    }

    #[Test]
    public function only_staff_may_manage_variants(): void
    {
        $product = Product::factory()->create();

        $this->assertStaffOnly('GET', "/api/admin/products/{$product->id}/variants");
    }

    #[Test]
    public function a_variant_is_created_locally_with_prices_in_tiyn(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();

        $response = $this->postJson("/api/admin/products/{$product->id}/variants", [
            'name' => 'Диван, серый',
            'code' => 'SOFA-GREY',
            'retail_price' => '150000',
            'b2b_price' => 120000.5,
            'barcodes' => ['4870000000011'],
        ])->assertCreated();

        $variant = ProductVariant::findOrFail($response->json('data.id'));

        $this->assertSame('local', $variant->source);
        $this->assertNotEmpty($variant->external_id);
        $this->assertSame(15_000_000, $variant->retail_price);
        $this->assertSame(12_000_050, $variant->b2b_price);
        $this->assertSame(['4870000000011'], $variant->barcodes);

        $response->assertJsonMissingPath('data.external_id')
            ->assertJsonMissingPath('data.source')
            ->assertJsonMissingPath('data.synced_at');
    }

    #[Test]
    public function stock_and_erp_fields_are_not_accepted(): void
    {
        $this->actingAsManager();
        $variant = ProductVariant::factory()->create(['stock' => 3, 'external_id' => 'keep-me']);

        $this->putJson("/api/admin/products/{$variant->product_id}/variants/{$variant->id}", [
            'name' => 'Новое имя',
            'stock' => 999,
            'external_id' => 'changed',
            'source' => 'changed',
        ])->assertOk();

        $variant->refresh();
        $this->assertSame('Новое имя', $variant->name);
        $this->assertSame('3.000', $variant->stock);
        $this->assertSame('keep-me', $variant->external_id);
    }

    #[Test]
    public function a_variant_is_listed_and_deleted(): void
    {
        $this->actingAsManager();
        $variant = ProductVariant::factory()->create();

        $this->getJson("/api/admin/products/{$variant->product_id}/variants")->assertOk()->assertJsonCount(1, 'data');
        $this->deleteJson("/api/admin/products/{$variant->product_id}/variants/{$variant->id}")->assertNoContent();
        $this->assertDatabaseMissing('product_variants', ['id' => $variant->id]);
    }

    #[Test]
    public function another_products_variant_is_not_found(): void
    {
        $this->actingAsManager();
        $foreign = ProductVariant::factory()->create();
        $product = Product::factory()->create();

        $this->putJson("/api/admin/products/{$product->id}/variants/{$foreign->id}", ['name' => 'x'])->assertNotFound();
    }

    #[Test]
    public function a_variant_keeps_its_characteristics_and_photos_in_order(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $color = Attribute::factory()->create(['name' => ['ru' => 'Цвет', 'kk' => 'Түсі']]);
        $first = $this->photo($product, 'a.jpg');
        $second = $this->photo($product, 'b.jpg');

        $this->postJson("/api/admin/products/{$product->id}/variants", [
            'name' => 'Серый',
            'attribute_values' => [['attribute_id' => $color->id, 'value' => ['ru' => 'Серый', 'kk' => 'Сұр']]],
            'media_ids' => [$second->id, $first->id],
        ])
            ->assertCreated()
            ->assertJsonPath('data.attribute_values.0.value.kk', 'Сұр')
            ->assertJsonPath('data.attribute_values.0.attribute.name.ru', 'Цвет')
            ->assertJsonPath('data.images.0.id', $second->id)
            ->assertJsonPath('data.images.1.id', $first->id);

        $this->getJson("/api/admin/products/{$product->id}/variants")
            ->assertOk()
            ->assertJsonPath('data.0.images.0.id', $second->id)
            ->assertJsonPath('data.0.attribute_values.0.value.ru', 'Серый');
    }

    #[Test]
    public function a_photo_of_another_product_is_refused(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $foreign = $this->photo(Product::factory()->create());

        $this->postJson("/api/admin/products/{$product->id}/variants", ['name' => 'Серый', 'media_ids' => [$foreign->id]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('media_ids.0');
    }

    #[Test]
    public function an_update_without_media_ids_keeps_the_photos(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $variant = ProductVariant::factory()->for($product)->create();
        $photo = $this->photo($product);
        $variant->images()->attach($photo->id, ['sort_order' => 0]);

        $this->putJson("/api/admin/products/{$product->id}/variants/{$variant->id}", ['name' => 'Белый'])
            ->assertOk()
            ->assertJsonPath('data.images.0.id', $photo->id);
    }

    #[Test]
    public function deleting_a_gallery_photo_unmarks_it_on_variants(): void
    {
        $product = Product::factory()->create();
        $variant = ProductVariant::factory()->for($product)->create();
        $photo = $this->photo($product);
        $variant->images()->attach($photo->id, ['sort_order' => 0]);

        $photo->delete();

        $this->assertDatabaseMissing('product_variant_media', ['product_variant_id' => $variant->id]);
    }
}
