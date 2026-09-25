<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Attribute;
use App\Models\AttributeValue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class AttributeApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_attributes(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/attributes');
    }

    #[Test]
    public function it_lists_attributes_by_name(): void
    {
        $this->actingAsManager();
        Attribute::factory()->create(['name' => 'Цвет']);
        Attribute::factory()->create(['name' => 'Материал']);

        $this->getJson('/api/admin/attributes')
            ->assertOk()
            ->assertJsonPath('data.0.name.ru', 'Материал')
            ->assertJsonPath('data.1.name.ru', 'Цвет');
    }

    #[Test]
    public function it_creates_updates_and_deletes_an_attribute(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/attributes', [
            'name' => 'Цвет',
            'slug' => 'color',
            'is_filterable' => true,
        ])->assertCreated()->json('data.id');

        $this->putJson("/api/admin/attributes/{$id}", [
            'name' => 'Цвет обивки',
            'slug' => 'color',
            'is_filterable' => false,
        ])->assertOk()->assertJsonPath('data.name.ru', 'Цвет обивки');

        $this->assertDatabaseHas('attributes', ['id' => $id, 'slug' => 'color', 'is_filterable' => false]);

        $this->deleteJson("/api/admin/attributes/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('attributes', ['id' => $id]);
    }

    #[Test]
    public function the_slug_must_be_unique_and_well_formed(): void
    {
        $this->actingAsManager();
        Attribute::factory()->create(['slug' => 'color']);

        $this->postJson('/api/admin/attributes', ['name' => 'Цвет', 'slug' => 'color'])
            ->assertUnprocessable()->assertJsonValidationErrors('slug');

        $this->postJson('/api/admin/attributes', ['name' => 'Цвет', 'slug' => 'Цвет!'])
            ->assertUnprocessable()->assertJsonValidationErrors('slug');
    }

    #[Test]
    public function an_attribute_keeps_its_own_slug_on_update(): void
    {
        $this->actingAsManager();
        $attribute = Attribute::factory()->create(['slug' => 'color']);

        $this->putJson("/api/admin/attributes/{$attribute->id}", ['name' => 'Цвет', 'slug' => 'color'])
            ->assertOk();
    }

    #[Test]
    public function an_attribute_in_use_cannot_be_deleted(): void
    {
        $this->actingAsManager();
        $value = AttributeValue::factory()->create();

        $this->deleteJson("/api/admin/attributes/{$value->attribute_id}")
            ->assertUnprocessable()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseHas('attributes', ['id' => $value->attribute_id]);
    }
}
