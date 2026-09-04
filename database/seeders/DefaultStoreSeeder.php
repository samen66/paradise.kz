<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Store;
use Illuminate\Database\Seeder;

/**
 * Guarantees the application always has one active warehouse.
 *
 * Warehouses used to arrive from the ERP sync, so a fresh database had none
 * until the first sync ran. Nothing creates them implicitly any more, and a
 * store-less install fails in ways that are hard to read: StoreResolver returns
 * null so the catalog shows no stock, and OrderPlacementService's
 * `Store::findOrFail($storeId)` 404s the whole checkout.
 *
 * Idempotent — safe to re-run; it never demotes an existing default.
 */
class DefaultStoreSeeder extends Seeder
{
    public function run(): void
    {
        if (Store::query()->where('is_active', true)->exists()) {
            return;
        }

        Store::query()->create([
            'source' => 'local',
            'external_id' => null,
            'name' => 'Основной склад',
            'code' => 'MAIN',
            'type' => 'warehouse',
            'address' => null,
            'is_default' => true,
            'is_active' => true,
        ]);
    }
}
