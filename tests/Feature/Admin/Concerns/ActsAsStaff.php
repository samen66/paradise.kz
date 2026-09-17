<?php

declare(strict_types=1);

namespace Tests\Feature\Admin\Concerns;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Laravel\Sanctum\Sanctum;

/**
 * Shared setup for the /api/admin/* tests: roles seeded, a manager signed in,
 * and one assertion for the access rule every admin endpoint shares.
 */
trait ActsAsStaff
{
    protected function setUpStaff(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    protected function actingAsManager(): User
    {
        $manager = User::factory()->create();
        $manager->assignRole('manager');
        Sanctum::actingAs($manager);

        return $manager;
    }

    /**
     * A guest gets 401 and a B2B client 403 — only admin|manager pass.
     *
     * @param  array<string, mixed>  $payload
     */
    protected function assertStaffOnly(string $method, string $uri, array $payload = []): void
    {
        $this->app['auth']->forgetGuards();
        $this->json($method, $uri, $payload)->assertUnauthorized();

        Sanctum::actingAs(User::factory()->b2b()->approved()->create());
        $this->json($method, $uri, $payload)->assertForbidden();
    }
}
