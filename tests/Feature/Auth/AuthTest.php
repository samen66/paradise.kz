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

    /**
     * @return array<string, mixed>
     */
    private function validRegisterPayload(array $overrides = []): array
    {
        return array_merge([
            'company_name' => 'ТОО Парадайз',
            'company_bin' => '123456789012',
            'email' => 'client@example.com',
            'phone' => '+77001112233',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ], $overrides);
    }

    #[Test]
    public function register_creates_a_pending_b2b_customer(): void
    {
        $this->markTestSkipped('B2B self-registration temporarily disabled — see routes/api.php');

        $response = $this->postJson('/api/auth/register', $this->validRegisterPayload());

        $response->assertCreated()
            ->assertJsonPath('data.email', 'client@example.com')
            ->assertJsonPath('data.is_approved', false)
            ->assertJsonMissingPath('data.password');

        $user = User::where('email', 'client@example.com')->firstOrFail();

        $this->assertFalse($user->is_approved);
        $this->assertTrue($user->hasRole('b2b_customer'));
        // Name defaults to company_name when omitted.
        $this->assertSame('ТОО Парадайз', $user->name);
        // No token is issued on registration.
        $this->assertSame(0, $user->tokens()->count());
    }

    #[Test]
    public function register_saves_the_optional_preferred_store(): void
    {
        $this->markTestSkipped('B2B self-registration temporarily disabled — see routes/api.php');

        $store = Store::factory()->create();

        $response = $this->postJson('/api/auth/register', $this->validRegisterPayload([
            'preferred_store_id' => $store->id,
        ]));

        $response->assertCreated();

        $user = User::where('email', 'client@example.com')->firstOrFail();
        $this->assertSame($store->id, $user->preferred_store_id);
    }

    #[Test]
    public function register_rejects_an_unknown_preferred_store(): void
    {
        $this->markTestSkipped('B2B self-registration temporarily disabled — see routes/api.php');

        $response = $this->postJson('/api/auth/register', $this->validRegisterPayload([
            'preferred_store_id' => 999,
        ]));

        $response->assertStatus(422)->assertJsonValidationErrors(['preferred_store_id']);
    }

    #[Test]
    public function register_fails_when_required_fields_are_missing(): void
    {
        $this->markTestSkipped('B2B self-registration temporarily disabled — see routes/api.php');

        $response = $this->postJson('/api/auth/register', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['company_name', 'company_bin', 'email', 'phone', 'password']);
    }

    #[Test]
    public function register_fails_with_invalid_bin_and_email(): void
    {
        $this->markTestSkipped('B2B self-registration temporarily disabled — see routes/api.php');

        $response = $this->postJson('/api/auth/register', $this->validRegisterPayload([
            'company_bin' => '123',
            'email' => 'not-an-email',
        ]));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['company_bin', 'email']);
    }

    #[Test]
    public function register_fails_on_duplicate_email(): void
    {
        $this->markTestSkipped('B2B self-registration temporarily disabled — see routes/api.php');

        User::factory()->b2b()->create(['email' => 'client@example.com']);

        $response = $this->postJson('/api/auth/register', $this->validRegisterPayload());

        $response->assertStatus(422)->assertJsonValidationErrors(['email']);
    }

    #[Test]
    public function login_returns_a_token(): void
    {
        $user = User::factory()->b2b()->create([
            'email' => 'login@example.com',
            'password' => 'secret123',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'login@example.com',
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
            'password' => 'secret123',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'login@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors(['email']);
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
