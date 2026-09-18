<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Contracts\Sms\SmsSender;
use App\Models\User;
use App\Services\Sms\ArraySmsSender;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Testing\TestResponse;
use Mockery;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * B2B portal: registration and login by phone + SMS code. Every test stays
 * under five throttled calls — `throttle:5,1` counts per IP across routes.
 */
class PhoneAuthTest extends TestCase
{
    use RefreshDatabase;

    private const PHONE = '+77071234567';

    private ArraySmsSender $sms;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        config(['sms.driver' => 'array']);
        $this->sms = $this->app->make(SmsSender::class);
        RateLimiter::clear('otp-send:'.self::PHONE);
        RateLimiter::clear('otp-send-hourly:'.self::PHONE);
    }

    private function sentCode(): string
    {
        $message = $this->sms->lastMessageFor(self::PHONE);
        $this->assertNotNull($message, 'No SMS was sent');

        preg_match('/\d{4}/', $message, $matches);

        return $matches[0];
    }

    /**
     * @param  array<string, string>  $extra
     */
    private function requestCode(string $intent, array $extra = []): TestResponse
    {
        return $this->postJson('/api/auth/otp/request', [
            'phone' => '8 707 123 45 67',
            'intent' => $intent,
            ...$extra,
        ]);
    }

    #[Test]
    public function registration_by_code_creates_a_pending_b2b_client_without_bin(): void
    {
        $this->requestCode('register', ['name' => 'Айгерим'])->assertOk();

        $response = $this->postJson('/api/auth/otp/register', [
            'phone' => '8 707 123 45 67',
            'code' => $this->sentCode(),
            'name' => 'Айгерим',
        ])->assertCreated();

        $this->assertNotEmpty($response->json('token'));
        $response->assertJsonPath('user.phone', self::PHONE)->assertJsonPath('user.is_approved', false);

        $user = User::query()->where('phone', self::PHONE)->firstOrFail();
        $this->assertSame(User::TYPE_B2B, $user->type);
        $this->assertFalse($user->is_approved);
        $this->assertSame('Айгерим', $user->name);
        $this->assertNull($user->company_name);
        $this->assertNull($user->company_bin);
        $this->assertTrue($user->hasRole('b2b_customer'));
    }

    #[Test]
    public function registration_keeps_the_optional_company_name(): void
    {
        $this->requestCode('register', ['name' => 'Айгерим', 'company_name' => 'ТОО Уют'])->assertOk();

        $this->postJson('/api/auth/otp/register', [
            'phone' => self::PHONE,
            'code' => $this->sentCode(),
            'name' => 'Айгерим',
            'company_name' => 'ТОО Уют',
        ])->assertCreated();

        $this->assertSame('ТОО Уют', User::query()->where('phone', self::PHONE)->value('company_name'));
    }

    #[Test]
    public function a_name_is_required_to_register(): void
    {
        $this->requestCode('register')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $this->postJson('/api/auth/otp/register', ['phone' => self::PHONE, 'code' => '1111'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $this->assertCount(0, $this->sms->sent);
    }

    #[Test]
    public function a_registered_number_is_told_to_log_in_before_any_sms_is_sent(): void
    {
        User::factory()->b2b()->create(['phone' => self::PHONE]);

        $this->requestCode('register', ['name' => 'Айгерим'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('phone');

        $this->assertCount(0, $this->sms->sent);
    }

    #[Test]
    public function a_retail_number_cannot_register_or_log_in_and_stays_retail(): void
    {
        $retail = User::factory()->retail()->create(['phone' => self::PHONE]);

        $this->requestCode('register', ['name' => 'Айгерим'])->assertUnprocessable()->assertJsonValidationErrors('phone');
        $this->requestCode('login')->assertUnprocessable()->assertJsonValidationErrors('phone');

        $this->assertCount(0, $this->sms->sent);
        $this->assertSame(User::TYPE_RETAIL, $retail->refresh()->type);
    }

    #[Test]
    public function a_staff_number_cannot_log_in_to_the_portal(): void
    {
        $manager = User::factory()->create(['phone' => self::PHONE]);
        $manager->assignRole('manager');

        // Same wording as a retail number: the portal must not reveal staff numbers.
        $this->requestCode('login')
            ->assertUnprocessable()
            ->assertJsonPath('errors.phone.0', 'Этот номер используется в розничном магазине.');
        $this->assertCount(0, $this->sms->sent);
    }

    #[Test]
    public function a_wrong_code_does_not_create_an_account(): void
    {
        $this->requestCode('register', ['name' => 'Айгерим'])->assertOk();
        $wrong = $this->sentCode() === '0000' ? '0001' : '0000';

        $this->postJson('/api/auth/otp/register', ['phone' => self::PHONE, 'code' => $wrong, 'name' => 'Айгерим'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('code');

        $this->assertDatabaseMissing('users', ['phone' => self::PHONE]);
    }

    #[Test]
    public function login_by_code_returns_a_token_for_a_b2b_client(): void
    {
        $client = User::factory()->b2b()->approved()->create(['phone' => self::PHONE]);

        $this->requestCode('login')->assertOk();

        $response = $this->postJson('/api/auth/otp/login', ['phone' => self::PHONE, 'code' => $this->sentCode()])
            ->assertOk()
            ->assertJsonPath('user.id', $client->id);

        $this->assertNotEmpty($response->json('token'));
    }

    #[Test]
    public function an_unknown_number_is_sent_to_registration(): void
    {
        $this->requestCode('login')->assertUnprocessable()->assertJsonValidationErrors('phone');

        $this->assertCount(0, $this->sms->sent);
    }

    #[Test]
    public function the_per_phone_resend_limit_still_applies(): void
    {
        User::factory()->b2b()->create(['phone' => self::PHONE]);

        $this->requestCode('login')->assertOk();
        $this->requestCode('login')->assertUnprocessable()->assertJsonValidationErrors('phone');
    }

    #[Test]
    public function a_number_registered_in_parallel_is_told_to_log_in(): void
    {
        $this->requestCode('register', ['name' => 'Айгерим'])->assertOk();
        $code = $this->sentCode();

        $this->duringCodeCheck(fn () => User::factory()->b2b()->create(['phone' => self::PHONE]));

        $this->postJson('/api/auth/otp/register', ['phone' => self::PHONE, 'code' => $code, 'name' => 'Айгерим'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.phone.0', 'Этот номер уже зарегистрирован. Войдите.');

        $this->assertSame(1, User::query()->where('phone', self::PHONE)->count());
    }

    /**
     * Run $parallel while the code is being checked — what a second request
     * would do during the bcrypt comparison — then let the check pass.
     */
    private function duringCodeCheck(callable $parallel): void
    {
        $hash = Mockery::mock($this->app->make('hash'));
        $hash->shouldReceive('check')->once()->andReturnUsing(function () use ($parallel): bool {
            $parallel();

            return true;
        });
        Hash::swap($hash);
    }
}
