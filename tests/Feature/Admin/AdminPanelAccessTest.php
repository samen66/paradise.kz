<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AdminPanelAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    #[Test]
    public function staff_can_access_the_admin_panel(): void
    {
        $panel = Filament::getPanel('admin');

        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $this->assertTrue($admin->canAccessPanel($panel));
        $this->assertTrue($manager->canAccessPanel($panel));
    }

    #[Test]
    public function b2b_clients_cannot_access_the_admin_panel(): void
    {
        $panel = Filament::getPanel('admin');
        $client = User::factory()->b2b()->create();

        $this->assertFalse($client->canAccessPanel($panel));
    }
}
