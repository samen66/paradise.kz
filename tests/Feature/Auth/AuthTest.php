<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    #[Test]
    public function the_old_password_registration_is_gone(): void
    {
        $this->postJson('/api/auth/register', ['phone' => '+77001112233'])->assertNotFound();
    }

    #[Test]
    public function login_accepts_the_phone_in_any_format(): void
    {
        $user = User::factory()->b2b()->create(['phone' => '+77001112233', 'password' => 'secret123']);

        $this->postJson('/api/auth/login', ['phone' => '8 (700) 111-22-33', 'password' => 'secret123'])
            ->assertOk()
            ->assertJsonPath('user.id', $user->id);
    }

    #[Test]
    public function login_returns_a_token(): void
    {
        $user = User::factory()->b2b()->create([
            'email' => 'login@example.com',
            'phone' => '+77001112233',
            'password' => 'secret123',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'phone' => '+77001112233',
            'password' => 'secret123',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'email', 'is_approved']])
            ->assertJsonPath('user.id', $user->id);

        $this->assertNotEmpty($response->json('token'));
    }

    #[Test]
    public function login_fails_with_wrong_password(): void
    {
        User::factory()->b2b()->create([
            'email' => 'login@example.com',
            'phone' => '+77001112233',
            'password' => 'secret123',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'phone' => '+77001112233',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors(['phone']);
    }

    #[Test]
    public function me_returns_the_authenticated_user(): void
    {
        $user = User::factory()->b2b()->create();
        $token = $user->createToken('api')->plainTextToken;

        $response = $this->withToken($token)->getJson('/api/auth/me');

        $response->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('is_approved', false);
    }

    #[Test]
    public function approval_gate_returns_403_for_a_pending_user(): void
    {
        $user = User::factory()->b2b()->create();
        $token = $user->createToken('api')->plainTextToken;

        $this->withToken($token)->getJson('/api/auth/ping')->assertStatus(403);
    }

    #[Test]
    public function approval_gate_returns_200_for_an_approved_user(): void
    {
        $user = User::factory()->b2b()->approved()->create();
        $token = $user->createToken('api')->plainTextToken;

        $this->withToken($token)->getJson('/api/auth/ping')
            ->assertOk()
            ->assertJson(['ok' => true]);
    }

    #[Test]
    public function settings_updates_the_preferred_store(): void
    {
        $store = Store::factory()->create();
        $user = User::factory()->b2b()->approved()->create();
        $token = $user->createToken('api')->plainTextToken;

        $response = $this->withToken($token)->patchJson('/api/auth/settings', [
            'preferred_store_id' => $store->id,
        ]);

        $response->assertOk()->assertJsonPath('data.preferred_store_id', $store->id);
        $this->assertSame($store->id, $user->fresh()->preferred_store_id);
    }

    #[Test]
    public function settings_rejects_an_inactive_store(): void
    {
        $store = Store::factory()->inactive()->create();
        $user = User::factory()->b2b()->approved()->create();
        $token = $user->createToken('api')->plainTextToken;

        $this->withToken($token)->patchJson('/api/auth/settings', [
            'preferred_store_id' => $store->id,
        ])->assertStatus(422)->assertJsonValidationErrors(['preferred_store_id']);
    }

    #[Test]
    public function logout_revokes_the_current_token(): void
    {
        $user = User::factory()->b2b()->create();
        $token = $user->createToken('api')->plainTextToken;

        $this->withToken($token)->postJson('/api/auth/logout')->assertNoContent();

        // Reset the resolved guard so the next request re-authenticates from
        // scratch rather than reusing the cached (now-revoked) user.
        $this->app['auth']->forgetGuards();

        // The revoked token can no longer authenticate.
        $this->withToken($token)->getJson('/api/auth/me')->assertStatus(401);
    }
}
