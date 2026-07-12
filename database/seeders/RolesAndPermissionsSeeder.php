<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Roles for the B2B MVP. Permissions stay coarse for now; the admin panel
     * is gated by role and the API by the `is_approved` flag.
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (['admin', 'manager', 'b2b_customer'] as $role) {
            Role::findOrCreate($role, 'web');
        }
    }
}
