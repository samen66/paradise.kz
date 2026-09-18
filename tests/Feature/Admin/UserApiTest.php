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
}
