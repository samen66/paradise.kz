<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductFolder;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Local/demo data so the catalog + SPA are browsable on a fresh database. Run with: `php artisan db:seed --class=DemoSeeder`.
 *
 * NOT part of DatabaseSeeder — keep production free of fake catalog data.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RolesAndPermissionsSeeder::class);

        // A ready-to-use approved B2B client for logging into the SPA.
        User::factory()->b2b()->approved()->create([
            'name' => 'Demo Reseller',
            'email' => 'reseller@paradise.kz',
            'company_name' => 'ТОО Демо Партнёр',
            'discount_percent' => 10,
        ]);

        $categories = [
            ['name' => 'Гостиная', 'slug' => 'gostinaya', 'children' => [
                ['name' => 'Диваны', 'slug' => 'divany'],
                ['name' => 'Кресла', 'slug' => 'kresla'],
                ['name' => 'Тумбы под ТВ', 'slug' => 'tumby-pod-tv'],
            ]],
            ['name' => 'Спальня', 'slug' => 'spalnya', 'children' => [
                ['name' => 'Кровати', 'slug' => 'krovati'],
                ['name' => 'Шкафы', 'slug' => 'shkafy'],
                ['name' => 'Комоды', 'slug' => 'komody'],
            ]],
            ['name' => 'Кухня', 'slug' => 'kuhnya', 'children' => [
                ['name' => 'Столы', 'slug' => 'stoly'],
                ['name' => 'Стулья', 'slug' => 'stulya'],
            ]],
            ['name' => 'Офис', 'slug' => 'ofis', 'children' => [
                ['name' => 'Офисные кресла', 'slug' => 'ofisnye-kresla'],
            ]],
        ];

        foreach ($categories as $idx => $cat) {
            $parent = Category::factory()->create([
                'name' => ['ru' => $cat['name'], 'kk' => $cat['name']],
                'slug' => $cat['slug'],
                'sort_order' => $idx,
                'is_active' => true,
            ]);
            foreach ($cat['children'] as $childIdx => $child) {
                Category::factory()->create([
                    'name' => ['ru' => $child['name'], 'kk' => $child['name']],
                    'slug' => $child['slug'],
                    'parent_id' => $parent->id,
                    'sort_order' => $childIdx,
                    'is_active' => true,
                ]);
            }
        }

        ProductFolder::factory()
            ->count(4)
            ->create()
            ->each(function (ProductFolder $folder): void {
                Product::factory()
                    ->count(6)
                    ->create([
                        'external_folder_id' => $folder->external_id,
                        'category_id' => Category::inRandomOrder()->whereNotNull('parent_id')->first()->id ?? null,
                    ]);
            });
    }
}
