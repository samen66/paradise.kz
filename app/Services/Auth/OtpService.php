<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Contracts\Sms\SmsSender;
use App\Models\Order;
use App\Models\OtpCode;
use App\Models\User;
use App\Support\Phone;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Phone + SMS-code login for the B2C storefront.
 *
 * request(): rate-limited per phone (one SMS a minute, a handful an hour),
 * stores the code hashed with a short TTL, delivers via the SmsSender driver.
 *
 * consume(): constant-time hash check with an attempt cap, then returns
 * the normalized phone. The attempt is reserved and the code burnt with
 * conditional UPDATEs, so parallel requests cannot exceed the cap or use
 * one code twice. Shared by storefront login and B2B portal auth.
 *
 * verify(): calls consume(), then resolves the canonical retail account for
 * the phone (creating it on first login) and claims any orders placed earlier
 * as a guest with the same number — so a customer's history follows them the
 * moment they log in. B2B numbers are refused to prevent demotion.
 */
class OtpService
{
    private const CODE_TTL_MINUTES = 5;

    private const MAX_ATTEMPTS = 5;

    private const RESEND_SECONDS = 60;

    private const MAX_PER_HOUR = 5;

    public function __construct(
        private readonly SmsSender $sms,
    ) {}

    /**
     * @throws ValidationException
     */
    public function request(string $rawPhone): void
    {
        $phone = $this->normalizedPhoneOrFail($rawPhone);

        if (! RateLimiter::attempt("otp-send:{$phone}", 1, static fn () => true, self::RESEND_SECONDS)) {
            throw ValidationException::withMessages([
                'phone' => ['Код уже отправлен. Повторить можно через минуту.'],
            ]);
        }

        if (! RateLimiter::attempt("otp-send-hourly:{$phone}", self::MAX_PER_HOUR, static fn () => true, 3600)) {
            throw ValidationException::withMessages([
                'phone' => ['Слишком много запросов кода. Попробуйте позже.'],
            ]);
        }

        // A fresh request supersedes any code still in flight for this phone.
        OtpCode::query()->where('phone', $phone)->whereNull('consumed_at')->delete();

        $code = app()->environment('local', 'testing')
            ? '1111'
            : (string) random_int(1000, 9999);

        OtpCode::create([
            'phone' => $phone,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(self::CODE_TTL_MINUTES),
        ]);

        $this->sms->send($phone, "Код для входа на Paradise.kz: {$code}");
    }

    /**
     * Check and burn the latest code for the phone. Shared by the storefront
     * login (verify()) and the B2B portal (B2bPhoneAuthService).
     *
     * @throws ValidationException
     */
    public function consume(string $rawPhone, string $code): string
    {
        $phone = $this->normalizedPhoneOrFail($rawPhone);

        $otp = OtpCode::query()
            ->where('phone', $phone)
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->latest('id')
            ->first();

        if ($otp === null || ! $this->reserveAttempt($otp)) {
            $this->refuseExpired();
        }

        if (! Hash::check($code, $otp->code_hash)) {
            throw ValidationException::withMessages([
                'code' => ['Неверный код.'],
            ]);
        }

        $consumed = OtpCode::query()
            ->whereKey($otp->id)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => now()]);

        if ($consumed === 0) {
            $this->refuseExpired();
        }

        return $phone;
    }

    /**
     * Spend one attempt before the (slow) hash check, in a single conditional
     * UPDATE — parallel requests cannot all see "attempts left" and each get
     * a guess. False when the code is already used up or burnt.
     */
    private function reserveAttempt(OtpCode $otp): bool
    {
        return OtpCode::query()
            ->whereKey($otp->id)
            ->whereNull('consumed_at')
            ->where('attempts', '<', self::MAX_ATTEMPTS)
            ->increment('attempts') === 1;
    }

    /**
     * @throws ValidationException
     */
    private function refuseExpired(): never
    {
        throw ValidationException::withMessages([
            'code' => ['Код истёк или не запрошен. Запросите новый код.'],
        ]);
    }

    /**
     * @throws ValidationException
     */
    public function verify(string $rawPhone, string $code): User
    {
        $phone = $this->consume($rawPhone, $code);

        return DB::transaction(function () use ($phone): User {
            $user = $this->findOrCreateRetailUser($phone);
            $this->claimGuestOrders($user, $phone);

            return $user;
        });
    }

    /**
     * The canonical (non-guest) retail account for a phone number. `phone` is
     * unique across all users, so any existing row (including a guest row
     * from an earlier anonymous checkout) must be reused and promoted rather
     * than inserting a second row with the same number.
     *
     * @throws ValidationException
     */
    private function findOrCreateRetailUser(string $phone): User
    {
        $user = User::query()->where('phone', $phone)->first();

        // A wholesale client typing their number on the storefront must not be
        // demoted to retail — that would lock them out of the B2B portal.
        if ($user !== null && $user->type === User::TYPE_B2B) {
            throw ValidationException::withMessages([
                'phone' => ['Этот номер зарегистрирован как оптовый клиент — войдите на b2b.paradise.kz.'],
            ]);
        }

        if ($user !== null) {
            if ($user->type !== User::TYPE_RETAIL || $user->is_guest || ! $user->is_approved) {
                $user->update([
                    'type' => User::TYPE_RETAIL,
                    'is_guest' => false,
                    'is_approved' => true,
                ]);
            }

            return $user;
        }

        return User::create([
            'name' => $phone,
            // Synthetic, unique, never contacted — the login identity is the phone.
            'email' => 'retail-'.Str::uuid().'@customer.paradise.kz',
            'phone' => $phone,
            'password' => Hash::make(Str::random(40)),
            'type' => User::TYPE_RETAIL,
            'is_approved' => true,
        ]);
    }

    /**
     * Re-attach orders placed via guest checkout with the same phone to the
     * canonical account. Idempotent — runs on every successful login.
     */
    private function claimGuestOrders(User $user, string $phone): void
    {
        $guestIds = User::query()
            ->where('is_guest', true)
            ->where('phone', $phone)
            ->pluck('id');

        if ($guestIds->isEmpty()) {
            return;
        }

        Order::query()->whereIn('user_id', $guestIds)->update(['user_id' => $user->id]);
    }

    /**
     * @throws ValidationException
     */
    public function normalizedPhoneOrFail(string $rawPhone): string
    {
        $phone = Phone::normalize($rawPhone);

        // +7 and 10 subscriber digits — anything else cannot receive our SMS.
        if (! preg_match('/^\+7\d{10}$/', $phone)) {
            throw ValidationException::withMessages([
                'phone' => ['Укажите корректный казахстанский номер телефона.'],
            ]);
        }

        return $phone;
    }
}
