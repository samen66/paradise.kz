<?php

declare(strict_types=1);

namespace Tests\Feature\PublicAuth;

use App\Contracts\Sms\SmsSender;
use App\Models\Order;
use App\Models\User;
use App\Services\Sms\ArraySmsSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class OtpAuthTest extends TestCase
{
    use RefreshDatabase;

    private ArraySmsSender $sms;

    protected function setUp(): void
    {
        parent::setUp();

        config(['sms.driver' => 'array']);
        $this->sms = $this->app->make(SmsSender::class);
        RateLimiter::clear('otp-send:+77071234567');
        RateLimiter::clear('otp-send-hourly:+77071234567');
    }

    /**
     * Pull the 4-digit code out of the SMS text the app "sent".
     */
    private function sentCode(string $phone = '+77071234567'): string
    {
        $message = $this->sms->lastMessageFor($phone);
        $this->assertNotNull($message, 'No SMS was sent to '.$phone);

        preg_match('/\d{4}/', $message, $matches);

        return $matches[0];
    }

    #[Test]
    public function requesting_a_code_sends_an_sms_to_the_normalized_phone(): void
    {
        $this->postJson('/api/public/auth/otp/request', ['phone' => '8 707 123 45 67'])
            ->assertOk();

        $this->assertCount(1, $this->sms->sent);
        $this->assertSame('+77071234567', $this->sms->sent[0]['phone']);
        $this->assertMatchesRegularExpression('/\d{4}/', $this->sms->sent[0]['message']);
    }

    #[Test]
    public function a_second_request_within_a_minute_is_rejected(): void
    {
        $this->postJson('/api/public/auth/otp/request', ['phone' => '+77071234567'])->assertOk();

        $this->postJson('/api/public/auth/otp/request', ['phone' => '+7 707 123 45 67'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('phone');
    }

    #[Test]
    public function a_non_kazakhstan_phone_is_rejected(): void
    {
        $this->postJson('/api/public/auth/otp/request', ['phone' => '+1 202 555 0100'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('phone');
    }

    #[Test]
    public function verifying_the_code_creates_the_retail_account_and_returns_a_token(): void
    {
        $this->postJson('/api/public/auth/otp/request', ['phone' => '+77071234567'])->assertOk();

        $response = $this->postJson('/api/public/auth/otp/verify', [
            'phone' => '8 707 123 45 67',
            'code' => $this->sentCode(),
        ])->assertOk();

        $this->assertNotEmpty($response->json('token'));
        $this->assertSame('+77071234567', $response->json('user.phone'));

        $user = User::query()->where('phone', '+77071234567')->where('is_guest', false)->firstOrFail();
        $this->assertSame(User::TYPE_RETAIL, $user->type);
        $this->assertTrue($user->is_approved);
    }

    #[Test]
    public function a_second_login_reuses_the_same_account(): void
    {
        $this->postJson('/api/public/auth/otp/request', ['phone' => '+77071234567'])->assertOk();
        $this->postJson('/api/public/auth/otp/verify', ['phone' => '+77071234567', 'code' => $this->sentCode()])->assertOk();

        RateLimiter::clear('otp-send:+77071234567');
        $this->postJson('/api/public/auth/otp/request', ['phone' => '+77071234567'])->assertOk();
        $this->postJson('/api/public/auth/otp/verify', ['phone' => '+77071234567', 'code' => $this->sentCode()])->assertOk();

        $this->assertSame(1, User::query()->where('phone', '+77071234567')->where('is_guest', false)->count());
    }

    #[Test]
    public function a_wrong_code_is_rejected_and_attempts_are_capped(): void
    {
        $this->postJson('/api/public/auth/otp/request', ['phone' => '+77071234567'])->assertOk();
        $code = $this->sentCode();
        $wrong = $code === '0000' ? '0001' : '0000';

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/public/auth/otp/verify', ['phone' => '+77071234567', 'code' => $wrong])
                ->assertUnprocessable();
        }

        // Even the correct code is dead after the attempt cap.
        $this->postJson('/api/public/auth/otp/verify', ['phone' => '+77071234567', 'code' => $code])
            ->assertUnprocessable();
    }

    #[Test]
    public function a_code_cannot_be_used_twice(): void
    {
        $this->postJson('/api/public/auth/otp/request', ['phone' => '+77071234567'])->assertOk();
        $code = $this->sentCode();

        $this->postJson('/api/public/auth/otp/verify', ['phone' => '+77071234567', 'code' => $code])->assertOk();
        $this->postJson('/api/public/auth/otp/verify', ['phone' => '+77071234567', 'code' => $code])
            ->assertUnprocessable();
    }

    #[Test]
    public function logging_in_claims_earlier_guest_orders_with_the_same_phone(): void
    {
        $guest = User::factory()->guest()->create(['phone' => '+77071234567']);
        $order = Order::factory()->create(['user_id' => $guest->id]);

        $this->postJson('/api/public/auth/otp/request', ['phone' => '+77071234567'])->assertOk();
        $this->postJson('/api/public/auth/otp/verify', ['phone' => '+77071234567', 'code' => $this->sentCode()])->assertOk();

        $account = User::query()->where('phone', '+77071234567')->where('is_guest', false)->firstOrFail();
        $this->assertSame($account->id, $order->fresh()->user_id);
    }
}
