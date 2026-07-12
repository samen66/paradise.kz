<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Filament\Resources\Users\Pages\CreateUser;
use App\Filament\Resources\Users\Pages\ListUsers;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CreateUserTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        Filament::setCurrentPanel(Filament::getPanel('admin'));

        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $this->actingAs($admin);
    }

    #[Test]
    public function creating_a_user_here_assigns_the_b2b_customer_role(): void
    {
        Livewire::test(CreateUser::class)
            ->fillForm([
                'name' => 'ТОО Клиент',
                'email' => 'newclient@example.com',
                'password' => 'secret123',
                'phone' => '+77001112233',
                'company_name' => 'ТОО Клиент',
                'company_bin' => '123456789012',
                'is_approved' => false,
                'discount_percent' => 0,
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $user = User::where('email', 'newclient@example.com')->firstOrFail();

        $this->assertTrue($user->hasRole('b2b_customer'));
    }

    #[Test]
    public function a_user_created_here_still_appears_in_the_role_scoped_list(): void
    {
        Livewire::test(CreateUser::class)
            ->fillForm([
                'name' => 'ТОО Клиент',
                'email' => 'newclient@example.com',
                'password' => 'secret123',
                'phone' => '+77001112233',
                'company_name' => 'ТОО Клиент',
                'company_bin' => '123456789012',
                'is_approved' => false,
                'discount_percent' => 0,
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $user = User::where('email', 'newclient@example.com')->firstOrFail();

        Livewire::test(ListUsers::class)
            ->assertCanSeeTableRecords([$user]);
    }
}
