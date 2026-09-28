<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Attribute;
use App\Models\AttributeValue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class CatalogSlugTest extends TestCase
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
    public function an_attribute_without_a_slug_gets_one_from_its_ru_name(): void
    {
        $this->postJson('/api/admin/attributes', ['name' => ['ru' => 'Размер', 'kk' => 'Өлшемі']])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'razmer')
            ->assertJsonPath('data.name.kk', 'Өлшемі');

        $this->postJson('/api/admin/attributes', ['name' => ['ru' => 'Размер']])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'razmer-2');
    }

    #[Test]
    public function a_name_with_nothing_to_transliterate_falls_back(): void
    {
        $this->postJson('/api/admin/attributes', ['name' => ['ru' => '!!!']])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'attribute');
    }

    #[Test]
    public function a_long_name_still_gets_a_slug_that_fits_the_column(): void
    {
        $slug = $this->postJson('/api/admin/attributes', ['name' => ['ru' => str_repeat('щ', 255)]])
            ->assertCreated()
            ->json('data.slug');

        $this->assertLessThanOrEqual(255, strlen($slug));
        $this->assertMatchesRegularExpression('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug);
    }

    #[Test]
    public function an_explicit_slug_is_still_validated(): void
    {
        Attribute::factory()->create(['slug' => 'color']);

        $this->postJson('/api/admin/attributes', ['name' => ['ru' => 'Цвет'], 'slug' => 'color'])
            ->assertUnprocessable()->assertJsonValidationErrors('slug');
        $this->postJson('/api/admin/attributes', ['name' => ['ru' => 'Цвет'], 'slug' => 'Цвет!'])
            ->assertUnprocessable()->assertJsonValidationErrors('slug');
    }

    #[Test]
    public function the_ru_name_is_required(): void
    {
        $this->postJson('/api/admin/attributes', ['name' => ['kk' => 'Түсі']])
            ->assertUnprocessable()->assertJsonValidationErrors('name.ru');
    }

    #[Test]
    public function an_update_without_a_slug_keeps_it_and_a_cleared_kk_is_dropped(): void
    {
        $attribute = Attribute::factory()->create(['name' => ['ru' => 'Цвет', 'kk' => 'Түсі'], 'slug' => 'color']);

        $this->putJson("/api/admin/attributes/{$attribute->id}", ['name' => ['ru' => 'Цвет корпуса', 'kk' => '']])
            ->assertOk()
            ->assertJsonPath('data.slug', 'color');

        $this->assertSame(['ru' => 'Цвет корпуса'], $attribute->refresh()->getTranslations('name'));
    }

    #[Test]
    public function brands_and_categories_get_a_slug_too(): void
    {
        $this->postJson('/api/admin/brands', ['name' => ['ru' => 'Икея']])
            ->assertCreated()->assertJsonPath('slug', 'ikeia');
        $this->postJson('/api/admin/categories', ['name' => ['ru' => 'Диваны']])
            ->assertCreated()->assertJsonPath('slug', 'divany');
    }

    #[Test]
    public function the_list_counts_how_many_products_use_an_attribute(): void
    {
        $used = Attribute::factory()->create(['name' => ['ru' => 'А']]);
        Attribute::factory()->create(['name' => ['ru' => 'Б']]);
        AttributeValue::factory()->count(2)->create(['attribute_id' => $used->id]);

        $this->getJson('/api/admin/attributes')
            ->assertOk()
            ->assertJsonPath('data.0.values_count', 2)
            ->assertJsonPath('data.1.values_count', 0);
    }
}
