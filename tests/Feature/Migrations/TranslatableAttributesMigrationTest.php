<?php

declare(strict_types=1);

namespace Tests\Feature\Migrations;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class TranslatableAttributesMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function migration(): object
    {
        return require database_path('migrations/2026_09_25_000002_make_attribute_names_and_values_translatable.php');
    }

    #[Test]
    public function plain_names_and_values_become_the_ru_translation(): void
    {
        $migration = $this->migration();
        $migration->down();

        $product = Product::factory()->create();
        $attributeId = DB::table('attributes')->insertGetId(['name' => 'Цвет', 'slug' => 'color', 'is_filterable' => true]);
        DB::table('attribute_values')->insert(['product_id' => $product->id, 'attribute_id' => $attributeId, 'value' => 'Серый']);

        $migration->up();

        $this->assertSame(['ru' => 'Цвет'], json_decode((string) DB::table('attributes')->value('name'), true));
        $this->assertSame(['ru' => 'Серый'], json_decode((string) DB::table('attribute_values')->value('value'), true));
    }

    #[Test]
    public function down_keeps_the_ru_text(): void
    {
        $product = Product::factory()->create();
        $attributeId = DB::table('attributes')->insertGetId([
            'name' => json_encode(['ru' => 'Цвет', 'kk' => 'Түсі'], JSON_UNESCAPED_UNICODE),
            'slug' => 'color',
            'is_filterable' => false,
        ]);
        DB::table('attribute_values')->insert([
            'product_id' => $product->id,
            'attribute_id' => $attributeId,
            'value' => json_encode(['ru' => 'Серый', 'kk' => 'Сұр'], JSON_UNESCAPED_UNICODE),
        ]);

        $this->migration()->down();

        $this->assertSame('Цвет', DB::table('attributes')->value('name'));
        $this->assertSame('Серый', DB::table('attribute_values')->value('value'));

        $this->migration()->up();
    }
}
