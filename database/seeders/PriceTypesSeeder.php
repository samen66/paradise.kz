<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\PriceType;
use Illuminate\Database\Seeder;

/**
 * The two price types PricingService resolves by code. Admins may add more
 * (e.g. "VIP", promo tiers) via the admin panel without a migration.
 */
class PriceTypesSeeder extends Seeder
{
    public function run(): void
    {
        PriceType::query()->updateOrCreate(['code' => 'retail'], ['name' => 'Розничная', 'sort_order' => 1]);
        PriceType::query()->updateOrCreate(['code' => 'b2b'], ['name' => 'Оптовая (B2B)', 'sort_order' => 2]);
    }
}
