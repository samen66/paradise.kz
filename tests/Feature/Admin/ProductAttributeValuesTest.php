<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Product;
use App\Services\Catalog\AttributeValueSync;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ProductAttributeValuesTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        $this->actingAsManager();
    }

    #[Test]
    public function a_new_product_is_created_with_its_characteristics(): void
    {
        $size = Attribute::factory()->create(['name' => ['ru' => 'Размер', 'kk' => 'Өлшемі']]);

        $response = $this->postJson('/api/admin/products', [
            'name' => ['ru' => 'Кровать'],
            'attribute_values' => [
                ['attribute_id' => $size->id, 'value' => ['ru' => '200x90 см', 'kk' => '200x90 см']],
            ],
        ])->assertCreated();

        $response
            ->assertJsonPath('data.attribute_values.0.attribute_id', $size->id)
            ->assertJsonPath('data.attribute_values.0.value.ru', '200x90 см')
            ->assertJsonPath('data.attribute_values.0.attribute.name.kk', 'Өлшемі');
        $this->assertSame(1, AttributeValue::query()->where('product_id', $response->json('data.id'))->count());
    }

    #[Test]
    public function saving_makes_the_characteristics_exactly_the_given_set(): void
    {
        $product = Product::factory()->create();
        [$color, $size, $material] = Attribute::factory()->count(3)->create();
        AttributeValue::factory()->create(['product_id' => $product->id, 'attribute_id' => $color->id, 'value' => ['ru' => 'Серый']]);
        AttributeValue::factory()->create(['product_id' => $product->id, 'attribute_id' => $size->id, 'value' => ['ru' => '90']]);

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Кровать'],
            'attribute_values' => [
                ['attribute_id' => $size->id, 'value' => ['ru' => '120']],
                ['attribute_id' => $material->id, 'value' => ['ru' => 'Дуб', 'kk' => 'Емен']],
            ],
        ])->assertOk();

        $values = $product->attributeValues()->get()->keyBy('attribute_id');
        $this->assertFalse($values->has($color->id));
        $this->assertSame('120', $values[$size->id]->getTranslation('value', 'ru'));
        $this->assertSame(['ru' => 'Дуб', 'kk' => 'Емен'], $values[$material->id]->getTranslations('value'));
    }

    #[Test]
    public function without_the_key_the_characteristics_stay(): void
    {
        $product = Product::factory()->create();
        AttributeValue::factory()->create(['product_id' => $product->id]);

        $this->putJson("/api/admin/products/{$product->id}", ['name' => ['ru' => 'Кровать']])->assertOk();

        $this->assertSame(1, $product->attributeValues()->count());
    }

    #[Test]
    public function an_empty_multipart_field_removes_them_all(): void
    {
        $product = Product::factory()->create();
        AttributeValue::factory()->count(2)->create(['product_id' => $product->id]);

        // The admin form is multipart: an empty set travels as "".
        $this->post("/api/admin/products/{$product->id}", [
            '_method' => 'PUT',
            'name' => ['ru' => 'Кровать'],
            'attribute_values' => '',
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertSame(0, $product->attributeValues()->count());
    }

    #[Test]
    public function a_cleared_kk_is_dropped_so_ru_shows_instead(): void
    {
        $product = Product::factory()->create();
        $color = Attribute::factory()->create();
        AttributeValue::factory()->create(['product_id' => $product->id, 'attribute_id' => $color->id, 'value' => ['ru' => 'Серый', 'kk' => 'Сұр']]);

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Кровать'],
            'attribute_values' => [['attribute_id' => $color->id, 'value' => ['ru' => 'Серый', 'kk' => '']]],
        ])->assertOk();

        $this->assertSame(['ru' => 'Серый'], $product->attributeValues()->first()->getTranslations('value'));
    }

    #[Test]
    public function the_same_attribute_twice_is_a_row_error(): void
    {
        $product = Product::factory()->create();
        $color = Attribute::factory()->create();

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Кровать'],
            'attribute_values' => [
                ['attribute_id' => $color->id, 'value' => ['ru' => 'Серый']],
                ['attribute_id' => $color->id, 'value' => ['ru' => 'Белый']],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors('attribute_values.1.attribute_id');
    }

    #[Test]
    public function a_row_needs_an_existing_attribute_and_a_ru_value(): void
    {
        $product = Product::factory()->create();

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Кровать'],
            'attribute_values' => [['attribute_id' => 999_999, 'value' => ['kk' => 'Сұр']]],
        ])->assertUnprocessable()->assertJsonValidationErrors(['attribute_values.0.attribute_id', 'attribute_values.0.value.ru']);
    }

    #[Test]
    public function a_failed_sync_rolls_the_new_product_back(): void
    {
        $color = Attribute::factory()->create();
        $this->mock(AttributeValueSync::class)->shouldReceive('sync')->andThrow(new RuntimeException('boom'));

        $this->postJson('/api/admin/products', [
            'name' => ['ru' => 'Кровать'],
            'attribute_values' => [['attribute_id' => $color->id, 'value' => ['ru' => 'Серый']]],
        ])->assertServerError();

        $this->assertSame(0, Product::query()->count());
    }

    #[Test]
    public function the_product_card_lists_its_characteristics(): void
    {
        $product = Product::factory()->create();
        AttributeValue::factory()->create(['product_id' => $product->id, 'value' => ['ru' => 'Серый']]);

        $this->getJson("/api/admin/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.attribute_values.0.value.ru', 'Серый');
    }
}
