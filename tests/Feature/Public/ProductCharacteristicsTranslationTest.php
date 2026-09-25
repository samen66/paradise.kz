<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ProductVariantAttributeValue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ProductCharacteristicsTranslationTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function characteristics_come_in_the_request_locale_with_ru_as_fallback(): void
    {
        $product = Product::factory()->create();
        $color = Attribute::factory()->create(['name' => ['ru' => 'Цвет', 'kk' => 'Түсі'], 'slug' => 'color']);
        $size = Attribute::factory()->create(['name' => ['ru' => 'Размер'], 'slug' => 'size']);
        AttributeValue::factory()->create(['product_id' => $product->id, 'attribute_id' => $color->id, 'value' => ['ru' => 'Серый', 'kk' => 'Сұр']]);
        AttributeValue::factory()->create(['product_id' => $product->id, 'attribute_id' => $size->id, 'value' => ['ru' => '200x90']]);

        $characteristics = collect($this->getJson("/api/public/products/{$product->id}?locale=kk")->assertOk()->json('data.characteristics'))
            ->keyBy('slug');

        $this->assertSame(['name' => 'Түсі', 'slug' => 'color', 'value' => 'Сұр'], $characteristics['color']);
        $this->assertSame(['name' => 'Размер', 'slug' => 'size', 'value' => '200x90'], $characteristics['size']);
    }

    #[Test]
    public function a_variant_carries_its_structured_characteristics_and_photos(): void
    {
        Storage::fake(config('media-library.disk_name'));
        $product = Product::factory()->create();
        $variant = ProductVariant::factory()->for($product)->create(['characteristics' => ['Цвет' => 'старое']]);
        $color = Attribute::factory()->create(['name' => ['ru' => 'Цвет', 'kk' => 'Түсі'], 'slug' => 'color']);
        ProductVariantAttributeValue::factory()->create([
            'product_variant_id' => $variant->id,
            'attribute_id' => $color->id,
            'value' => ['ru' => 'Серый', 'kk' => 'Сұр'],
        ]);
        $photo = $product->addMedia(UploadedFile::fake()->image('a.jpg'))->toMediaCollection(Product::IMAGE_COLLECTION);
        $variant->images()->attach($photo->id, ['sort_order' => 0]);

        $response = $this->getJson("/api/public/products/{$product->id}?locale=kk")->assertOk();

        $this->assertSame([['name' => 'Түсі', 'slug' => 'color', 'value' => 'Сұр']], $response->json('data.variants.0.characteristics'));
        $this->assertCount(1, $response->json('data.variants.0.images'));
        $this->assertStringContainsString('thumb', (string) $response->json('data.variants.0.images.0.thumb'));
    }

    #[Test]
    public function a_legacy_variant_still_shows_its_erp_characteristics(): void
    {
        $product = Product::factory()->create();
        ProductVariant::factory()->for($product)->create(['characteristics' => ['Цвет' => 'красный']]);

        $this->getJson("/api/public/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.variants.0.characteristics', ['Цвет' => 'красный'])
            ->assertJsonPath('data.variants.0.images', []);
    }
}
