<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class UserApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function clients_registered_without_a_company_are_found_by_name(): void
    {
        $this->actingAsManager();
        $client = User::factory()->b2b()->create(['name' => 'Айгерим Касымова', 'company_name' => null]);
        User::factory()->b2b()->create(['name' => 'Ерлан']);

        $this->getJson('/api/admin/users?filter[search]='.urlencode('Айгерим'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $client->id);
    }

    #[Test]
    public function clients_are_found_by_phone_typed_with_spaces(): void
    {
        $this->actingAsManager();
        $client = User::factory()->b2b()->create(['phone' => '+77071234567']);
        User::factory()->b2b()->create(['phone' => '+77019876543']);

        $this->getJson('/api/admin/users?filter[search]='.urlencode('707 123 45'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $client->id);
    }

    #[Test]
    public function clients_can_be_listed_by_company_name(): void
    {
        $this->actingAsManager();
        User::factory()->b2b()->create(['company_name' => 'Яблоко']);
        User::factory()->b2b()->create(['company_name' => 'Арман']);

        $this->getJson('/api/admin/users?sort=company_name')
            ->assertOk()
            ->assertJsonPath('data.0.company_name', 'Арман')
            ->assertJsonPath('data.1.company_name', 'Яблоко');
    }

    #[Test]
    public function without_a_sort_the_newest_client_comes_first(): void
    {
        $this->actingAsManager();
        User::factory()->b2b()->create(['company_name' => 'Старый', 'created_at' => now()->subDay()]);
        User::factory()->b2b()->create(['company_name' => 'Новый']);

        $this->getJson('/api/admin/users')
            ->assertOk()
            ->assertJsonPath('data.0.company_name', 'Новый');
    }
}
