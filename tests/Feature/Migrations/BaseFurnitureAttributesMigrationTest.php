<?php

declare(strict_types=1);

namespace Tests\Feature\Migrations;

use App\Models\Attribute;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class BaseFurnitureAttributesMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function migration(): object
    {
        return require database_path('migrations/2026_09_25_000005_add_base_furniture_attributes.php');
    }

    #[Test]
    public function the_test_database_starts_without_them(): void
    {
        $this->assertFalse(Attribute::query()->where('slug', 'color')->exists());
    }

    #[Test]
    public function base_attributes_are_added_in_ru_and_kk(): void
    {
        $migration = $this->migration();
        $migration->up(force: true);

        $this->assertSame(count($migration::ATTRIBUTES), Attribute::query()->whereIn('slug', array_keys($migration::ATTRIBUTES))->count());

        $color = Attribute::query()->where('slug', 'color')->firstOrFail();
        $this->assertSame(['ru' => 'Цвет', 'kk' => 'Түсі'], $color->getTranslations('name'));
        $this->assertTrue($color->is_filterable);
        $this->assertFalse(Attribute::query()->where('slug', 'width')->firstOrFail()->is_filterable);
    }

    #[Test]
    public function running_again_adds_nothing_and_keeps_manager_edits(): void
    {
        $this->migration()->up(force: true);
        $color = Attribute::query()->where('slug', 'color')->firstOrFail();
        $color->replaceTranslations('name', ['ru' => 'Цвет корпуса']);
        $color->is_filterable = false;
        $color->save();
        $before = Attribute::query()->count();

        $this->migration()->up(force: true);

        $this->assertSame($before, Attribute::query()->count());
        $color->refresh();
        $this->assertSame(['ru' => 'Цвет корпуса'], $color->getTranslations('name'));
        $this->assertFalse($color->is_filterable);
    }

    #[Test]
    public function an_attribute_with_the_same_ru_name_under_another_slug_is_not_duplicated(): void
    {
        DB::table('attributes')->insert([
            'name' => json_encode(['ru' => ' цвет '], JSON_UNESCAPED_UNICODE),
            'slug' => 'cvet',
            'is_filterable' => true,
        ]);

        $this->migration()->up(force: true);

        $this->assertFalse(Attribute::query()->where('slug', 'color')->exists());
        $this->assertTrue(Attribute::query()->where('slug', 'sleeping-area')->exists());
    }

    #[Test]
    public function down_removes_only_unused_base_attributes(): void
    {
        $this->migration()->up(force: true);
        $product = Product::factory()->create();
        $used = Attribute::query()->where('slug', 'upholstery')->firstOrFail();
        DB::table('attribute_values')->insert([
            'product_id' => $product->id,
            'attribute_id' => $used->id,
            'value' => json_encode(['ru' => 'Велюр'], JSON_UNESCAPED_UNICODE),
        ]);
        $own = Attribute::factory()->create(['slug' => 'manager-made']);

        $this->migration()->down();

        $this->assertTrue(Attribute::query()->whereKey($used->id)->exists());
        $this->assertTrue(Attribute::query()->whereKey($own->id)->exists());
        $this->assertFalse(Attribute::query()->where('slug', 'color')->exists());
        $this->assertSame(1, DB::table('attribute_values')->where('attribute_id', $used->id)->count());
    }
}
