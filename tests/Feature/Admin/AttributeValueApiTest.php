<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class AttributeValueApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_attribute_values(): void
    {
        $product = Product::factory()->create();

        $this->assertStaffOnly('GET', "/api/admin/products/{$product->id}/attribute-values");
    }

    #[Test]
    public function a_value_is_created_updated_and_deleted(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $attribute = Attribute::factory()->create(['name' => 'Цвет']);

        $id = $this->postJson("/api/admin/products/{$product->id}/attribute-values", [
            'attribute_id' => $attribute->id,
            'value' => 'Серый',
        ])->assertCreated()->assertJsonPath('data.attribute.name.ru', 'Цвет')->json('data.id');

        $this->putJson("/api/admin/products/{$product->id}/attribute-values/{$id}", [
            'attribute_id' => $attribute->id,
            'value' => 'Графит',
        ])->assertOk()->assertJsonPath('data.value.ru', 'Графит');

        $this->getJson("/api/admin/products/{$product->id}/attribute-values")->assertOk()->assertJsonCount(1, 'data');

        $this->deleteJson("/api/admin/products/{$product->id}/attribute-values/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('attribute_values', ['id' => $id]);
    }

    #[Test]
    public function one_value_per_attribute_per_product(): void
    {
        $this->actingAsManager();
        $existing = AttributeValue::factory()->create();

        $this->postJson("/api/admin/products/{$existing->product_id}/attribute-values", [
            'attribute_id' => $existing->attribute_id,
            'value' => 'x',
        ])->assertUnprocessable()->assertJsonValidationErrors('attribute_id');
    }

    #[Test]
    public function another_products_value_is_not_found(): void
    {
        $this->actingAsManager();
        $foreign = AttributeValue::factory()->create();
        $product = Product::factory()->create();

        $this->deleteJson("/api/admin/products/{$product->id}/attribute-values/{$foreign->id}")->assertNotFound();
    }
}
