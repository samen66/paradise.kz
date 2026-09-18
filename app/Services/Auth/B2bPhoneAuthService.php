<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use LogicException;
use Spatie\Permission\Models\Role;

/**
 * Phone + SMS-code registration and login for the B2B portal.
 *
 * Unlike the storefront's OtpService::verify(), nothing here changes an
 * existing account: a number owned by a retail customer or by staff is
 * refused. Preconditions run before the SMS is sent (no wasted codes) and
 * again when the code is entered (the number may have been taken meanwhile).
 */
class B2bPhoneAuthService
{
    public const INTENT_REGISTER = 'register';

    public const INTENT_LOGIN = 'login';

    private const ALREADY_REGISTERED = 'Этот номер уже зарегистрирован. Войдите.';

    public function __construct(
        private readonly OtpService $otp,
    ) {}

    /**
     * @throws ValidationException
     */
    public function requestCode(string $rawPhone, string $intent): void
    {
        $phone = $this->otp->normalizedPhoneOrFail($rawPhone);
        $this->accountFor($phone, $intent);
        $this->otp->request($phone);
    }

    /**
     * @throws ValidationException
     */
    public function register(string $rawPhone, string $code, string $name, ?string $companyName): User
    {
        $phone = $this->otp->normalizedPhoneOrFail($rawPhone);
        $this->accountFor($phone, self::INTENT_REGISTER);
        $this->otp->consume($phone, $code);

        try {
            return DB::transaction(function () use ($phone, $name, $companyName): User {
                $user = User::create([
                    'name' => $name,
                    'phone' => $phone,
                    'company_name' => $companyName,
                    // Never typed by anyone: the login identity is phone + SMS code.
                    'password' => Str::random(40),
                    'type' => User::TYPE_B2B,
                    'is_approved' => false,
                ]);

                Role::findOrCreate('b2b_customer', 'web');
                $user->assignRole('b2b_customer');

                return $user;
            });
        } catch (UniqueConstraintViolationException) {
            // A parallel registration took the number after accountFor() ran.
            $this->refuse(self::ALREADY_REGISTERED);
        }
    }

    /**
     * @throws ValidationException
     */
    public function login(string $rawPhone, string $code): User
    {
        $phone = $this->otp->normalizedPhoneOrFail($rawPhone);
        $user = $this->accountFor($phone, self::INTENT_LOGIN)
            ?? throw new LogicException('accountFor() returns the account for a login.');
        $this->otp->consume($phone, $code);

        return $user;
    }

    /**
     * The account behind a number, checked against what the caller is about
     * to do: the B2B account for a login, null for a registration.
     *
     * @throws ValidationException
     */
    private function accountFor(string $phone, string $intent): ?User
    {
        $user = User::query()->where('phone', $phone)->first();

        if ($user !== null && $user->hasAnyRole(['admin', 'manager'])) {
            $this->refuse('Этот номер принадлежит сотруднику. Войдите в панель управления.');
        }

        if ($user !== null && $user->type !== User::TYPE_B2B) {
            $this->refuse('Этот номер используется в розничном магазине.');
        }

        if ($intent === self::INTENT_REGISTER && $user !== null) {
            $this->refuse(self::ALREADY_REGISTERED);
        }

        if ($intent === self::INTENT_LOGIN && $user === null) {
            $this->refuse('Номер не найден. Зарегистрируйтесь.');
        }

        return $user;
    }

    /**
     * @throws ValidationException
     */
    private function refuse(string $message): never
    {
        throw ValidationException::withMessages(['phone' => [$message]]);
    }
}
