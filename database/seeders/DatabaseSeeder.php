<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RolesAndPermissionsSeeder::class);
        $this->call(PriceTypesSeeder::class);
        // Catalog stock and checkout both need at least one active warehouse.
        $this->call(DefaultStoreSeeder::class);

        User::factory()->create([
            'name' => 'Admin',
            'email' => 'admin@paradise.kz',
        ])->assignRole('admin');
    }
}
