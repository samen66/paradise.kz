<?php

declare(strict_types=1);

namespace Tests\Feature\Addresses;

use App\Models\Address;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AddressApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function approvedClient(array $attributes = []): User
    {
        return User::factory()->b2b()->approved()->create($attributes);
    }

    #[Test]
    public function unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/addresses')->assertStatus(401);
        $this->postJson('/api/addresses', [])->assertStatus(401);
    }

    #[Test]
    public function a_client_can_create_and_list_their_own_addresses(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/addresses', [
            'city' => 'Алматы',
            'street' => 'Абая',
            'building' => '10',
            'apartment' => '5',
            'comment' => 'Домофон 123',
        ])->assertCreated();

        $response->assertJsonPath('data.city', 'Алматы')
            ->assertJsonPath('data.building', '10');

        $this->getJson('/api/addresses')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    #[Test]
    public function city_street_and_building_are_required(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $this->postJson('/api/addresses', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['city', 'street', 'building']);
    }

    #[Test]
    public function creating_a_default_address_unsets_the_previous_default(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $first = Address::factory()->default()->for($user)->create();

        $this->postJson('/api/addresses', [
            'city' => 'Астана', 'street' => 'Кенесары', 'building' => '1', 'is_default' => true,
        ])->assertCreated();

        $this->assertFalse($first->refresh()->is_default);
        $this->assertDatabaseHas('addresses', ['city' => 'Астана', 'is_default' => true]);
    }

    #[Test]
    public function a_client_can_update_and_delete_their_own_address(): void
    {
        $user = $this->approvedClient();
        Sanctum::actingAs($user);

        $address = Address::factory()->for($user)->create(['city' => 'Алматы']);

        $this->patchJson('/api/addresses/'.$address->id, [
            'city' => 'Шымкент', 'street' => $address->street, 'building' => $address->building,
        ])->assertOk()->assertJsonPath('data.city', 'Шымкент');

        $this->deleteJson('/api/addresses/'.$address->id)->assertNoContent();
        $this->assertDatabaseMissing('addresses', ['id' => $address->id]);
    }

    #[Test]
    public function a_client_cannot_see_update_or_delete_another_clients_address(): void
    {
        $owner = $this->approvedClient();
        $intruder = $this->approvedClient();
        $address = Address::factory()->for($owner)->create();

        Sanctum::actingAs($intruder);

        $this->patchJson('/api/addresses/'.$address->id, [
            'city' => 'X', 'street' => 'X', 'building' => '1',
        ])->assertStatus(404);

        $this->deleteJson('/api/addresses/'.$address->id)->assertStatus(404);

        $this->getJson('/api/addresses')->assertOk()->assertJsonCount(0, 'data');
    }
}
