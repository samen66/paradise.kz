<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductFolder;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Local/demo data so the catalog + SPA are browsable without a live MoySklad
 * sync. Run with: `php artisan db:seed --class=DemoSeeder`.
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

        ProductFolder::factory()
            ->count(4)
            ->create()
            ->each(function (ProductFolder $folder): void {
                Product::factory()
                    ->count(6)
                    ->create(['external_folder_id' => $folder->external_id]);
            });
    }
}
