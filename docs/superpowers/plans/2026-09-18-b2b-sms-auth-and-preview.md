# B2B SMS Auth, Unapproved Preview & Welcome Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** B2B-портал регистрирует и впускает по номеру телефона + SMS-коду, показывает неодобренным каталог без цен и остатков, а на `/` — открытую главную с контентом из `admin/`.

**Architecture:** Общая OTP-часть выносится из витринного `OtpService` (`consume()`), поверх неё — `B2bPhoneAuthService` с отдельными маршрутами `/api/auth/otp/*`, которые никогда не меняют тип чужого аккаунта. Неодобренный проходит на каталожные эндпоинты, а `ProductResource` по временному флагу `hide_commercial` не включает коммерческие ключи. Главная собирается из `Banner` (`placement=b2b_home`), `ProductCollection` (обложка + описание + флажки) и синглтона `B2bHomeContent`, всё редактируется через новые `/api/admin/*` и экраны `admin/`.

**Tech Stack:** Laravel 13 / PHP 8.4, Sanctum 4, Spatie Media Library / Translatable / Permission, PHPUnit 12; Next.js 16 (App Router), next-intl, zustand, Tailwind 4; admin: react-hook-form + zod + axios.

**Spec:** `docs/superpowers/specs/2026-09-18-b2b-sms-auth-and-preview-design.md`

## Global Constraints

- Интерфейсный текст — на русском (AGENTS.md); в b2b-portal новые строки — через next-intl, ключи и в `src/messages/ru.json`, и в `src/messages/kk.json`.
- Остатки меняет только `FifoInventoryService` — в этом плане остатки не пишутся вообще.
- Код в `local`/`testing` — всегда `1111` (`OtpService`); лимиты: 1 SMS/мин и 5/час на номер, TTL 5 мин, 5 попыток.
- Номер хранится нормализованным `+7XXXXXXXXXX` (`App\Support\Phone::normalize`).
- Коммерческие ключи, которых неодобренный не должен получить: `price`, `old_price`, `stock`, `in_stock`, `showrooms`; у вариантов — `stock`, `in_stock`.
- PHP: `declare(strict_types=1)`, фигурные скобки всегда, типы возврата, PHPDoc вместо inline-комментариев; после правок PHP — `vendor/bin/pint --dirty --format agent`.
- Тесты — PHPUnit-классы с `#[Test]`; прогон одного файла: `php artisan test --compact tests/Feature/...`.
- Фронтенд проверяется `npx tsc --noEmit && npm run build` в каталоге приложения.
- Коммиты — без трейлера `Co-Authored-By` и без строки «Generated with Claude Code» (личное правило пользователя).
- Контент-фото загружаются как `multipart/form-data`, поле `file`, `mimes:jpeg,png,webp`, `max:10240`.

## Карта файлов

**Этап 1 — вход по SMS**
- Modify `app/Services/Auth/OtpService.php` — публичные `normalizedPhoneOrFail()`, `consume()`; витрина отказывает B2B-номерам.
- Create `app/Services/Auth/B2bPhoneAuthService.php` — предусловия, регистрация, вход.
- Create `app/Http/Controllers/Api/Auth/PhoneAuthController.php`.
- Create `app/Http/Requests/Auth/{PhoneCodeRequest,PhoneRegisterRequest,PhoneLoginRequest}.php`.
- Modify `app/Http/Controllers/Api/Auth/AuthController.php` — без `register()`, вход по паролю принимает номер в любом формате.
- Delete `app/Http/Requests/Auth/RegisterRequest.php`.
- Create `database/migrations/2026_09_18_000001_normalize_b2b_user_phones.php`.
- Modify `routes/api.php`, `app/Console/Commands/MvpAcceptanceCommand.php`.
- Tests: create `tests/Feature/Auth/PhoneAuthTest.php`, `tests/Feature/Migrations/NormalizeB2bUserPhonesTest.php`; modify `tests/Feature/Auth/AuthTest.php`, `tests/Feature/PublicAuth/OtpAuthTest.php`.
- b2b-portal: create `src/components/auth/{AuthCard,FieldError,PhoneCodeForm}.tsx`; rewrite `src/app/(auth)/register/page.tsx`, `src/app/(auth)/login/page.tsx`; modify `src/messages/{ru,kk}.json`.

**Этап 2 — режим «не одобрен»**
- Modify `routes/api.php`, `app/Http/Controllers/Api/ProductController.php`, `app/Http/Resources/ProductResource.php`, `app/Console/Commands/MvpAcceptanceCommand.php`.
- Tests: create `tests/Feature/Catalog/UnapprovedCatalogTest.php`; modify `tests/Feature/Catalog/CatalogApiTest.php`.
- b2b-portal: create `src/lib/approval.ts`, `src/components/PendingApprovalBanner.tsx`; modify `src/app/(portal)/layout.tsx`, `src/components/{B2BHeader,B2BFooter,ProductCard,B2BCatalogView}.tsx`, `src/app/(portal)/product/[id]/page.tsx`, `src/lib/types.ts`, `src/messages/{ru,kk}.json`; delete `src/app/(auth)/pending/page.tsx`.

**Этап 3 — главная и контент**
- Create migrations `2026_09_18_000002_add_b2b_home_fields_to_product_collections_table.php`, `2026_09_18_000003_create_b2b_home_contents_table.php`.
- Create `app/Models/B2bHomeContent.php`; modify `app/Models/{ProductCollection,Banner}.php`, `app/Filament/Resources/Banners/Schemas/BannerForm.php`, `app/Http/Controllers/Api/Public/HomeController.php`.
- Create `app/Http/Controllers/Api/B2bHomeController.php`.
- Create `app/Http/Controllers/Api/Admin/Concerns/StoresSingleImage.php`, `app/Http/Controllers/Api/Admin/{BannerController,B2bHomeContentController}.php`, `app/Http/Requests/Admin/{BannerRequest,B2bHomeContentRequest}.php`; modify `app/Http/Controllers/Api/Admin/ProductCollectionController.php`, `app/Http/Requests/Admin/ProductCollectionRequest.php`.
- Tests: create `tests/Feature/B2b/B2bHomeTest.php`, `tests/Feature/Admin/{BannerApiTest,B2bHomeContentApiTest}.php`; modify `tests/Feature/Public/HomeTest.php`, `tests/Feature/Admin/ProductCollectionApiTest.php`.
- admin: create `src/components/ui/SingleImageUpload.tsx`, `src/components/banners/BannerForm.tsx`, `src/app/banners/page.tsx`, `src/app/b2b-home/page.tsx`; modify `src/components/collections/CollectionForm.tsx`, `src/app/product-collections/[id]/page.tsx`, `src/components/Sidebar.tsx`.
- b2b-portal: rewrite `src/app/page.tsx`; create `src/components/welcome/{useSignedIn.ts,WelcomeHeader.tsx,WelcomeHero.tsx,StyleSection.tsx}`; modify `src/lib/types.ts`, `src/messages/{ru,kk}.json`.

---

# Этап 1. Вход и регистрация по SMS

### Task 1: `OtpService::consume()` и отказ витрины B2B-номерам

**Files:**
- Modify: `app/Services/Auth/OtpService.php`
- Test: `tests/Feature/PublicAuth/OtpAuthTest.php`

**Interfaces:**
- Produces:
  - `OtpService::normalizedPhoneOrFail(string $rawPhone): string` (становится `public`) — `+7XXXXXXXXXX` или `ValidationException` на `phone`.
  - `OtpService::consume(string $rawPhone, string $code): string` — проверяет и гасит код, возвращает нормализованный номер; ошибки — `ValidationException` на `code`.
  - `OtpService::request(string $rawPhone): void` — без изменений.

- [ ] **Step 1: Write the failing test** — добавить в конец класса `OtpAuthTest`:

```php
    #[Test]
    public function a_b2b_client_cannot_sign_in_to_the_storefront_and_keeps_b2b_access(): void
    {
        $client = User::factory()->b2b()->approved()->create(['phone' => '+77071234567']);

        $this->postJson('/api/public/auth/otp/request', ['phone' => '+77071234567'])->assertOk();

        $this->postJson('/api/public/auth/otp/verify', [
            'phone' => '+77071234567',
            'code' => $this->sentCode(),
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('phone');

        $client->refresh();
        $this->assertSame(User::TYPE_B2B, $client->type);
        $this->assertTrue($client->is_approved);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --compact tests/Feature/PublicAuth/OtpAuthTest.php --filter=a_b2b_client_cannot_sign_in`
Expected: FAIL — ответ 200, аккаунт стал `retail`.

- [ ] **Step 3: Implement** — в `OtpService` заменить `verify()` и `normalizedPhoneOrFail()` и добавить `consume()`; в `findOrCreateRetailUser()` — отказ B2B.

```php
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

        if ($otp === null || $otp->attempts >= self::MAX_ATTEMPTS) {
            throw ValidationException::withMessages([
                'code' => ['Код истёк или не запрошен. Запросите новый код.'],
            ]);
        }

        if (! Hash::check($code, $otp->code_hash)) {
            $otp->increment('attempts');

            throw ValidationException::withMessages([
                'code' => ['Неверный код.'],
            ]);
        }

        $otp->update(['consumed_at' => now()]);

        return $phone;
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
```

В начале `findOrCreateRetailUser()`, сразу после `$user = User::query()->where('phone', $phone)->first();`:

```php
        // A wholesale client typing their number on the storefront must not be
        // demoted to retail — that would lock them out of the B2B portal.
        if ($user !== null && $user->type === User::TYPE_B2B) {
            throw ValidationException::withMessages([
                'phone' => ['Этот номер зарегистрирован как оптовый клиент — войдите на b2b.paradise.kz.'],
            ]);
        }
```

`normalizedPhoneOrFail()`: сменить `private` на `public`. Обновить docblock класса: «verify(): consume() + canonical retail account …; B2B numbers are refused».

Порядок изменился: код гасится до создания аккаунта. Это допустимо (спек, этап 1, «Сервисы»).

- [ ] **Step 4: Run tests to verify they pass**

Run: `php artisan test --compact tests/Feature/PublicAuth/OtpAuthTest.php`
Expected: PASS (все тесты файла).

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Services/Auth/OtpService.php tests/Feature/PublicAuth/OtpAuthTest.php
git commit -m "refactor(auth): split OtpService::consume(); storefront OTP refuses B2B numbers"
```

---

### Task 2: B2B-маршруты `/api/auth/otp/{request,register,login}`

**Files:**
- Create: `app/Services/Auth/B2bPhoneAuthService.php`
- Create: `app/Http/Controllers/Api/Auth/PhoneAuthController.php`
- Create: `app/Http/Requests/Auth/PhoneCodeRequest.php`, `PhoneRegisterRequest.php`, `PhoneLoginRequest.php`
- Modify: `routes/api.php` (группа `Route::prefix('auth')`)
- Test: `tests/Feature/Auth/PhoneAuthTest.php`

**Interfaces:**
- Consumes: `OtpService::normalizedPhoneOrFail()`, `consume()`, `request()` (Task 1).
- Produces:
  - `POST /api/auth/otp/request` `{phone, intent: register|login, name?, company_name?}` → `200 {message}`.
  - `POST /api/auth/otp/register` `{phone, code, name, company_name?}` → `201 {token, user}`.
  - `POST /api/auth/otp/login` `{phone, code}` → `200 {token, user}`.
  - Ошибки номера — 422 на `phone`; ошибки кода — 422 на `code`; нет имени — 422 на `name`.

- [ ] **Step 1: Write the failing tests** — `tests/Feature/Auth/PhoneAuthTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Contracts\Sms\SmsSender;
use App\Models\User;
use App\Services\Sms\ArraySmsSender;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Testing\TestResponse;
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

        $this->requestCode('login')->assertUnprocessable()->assertJsonValidationErrors('phone');
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
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --compact tests/Feature/Auth/PhoneAuthTest.php`
Expected: FAIL — 404 на `/api/auth/otp/*`.

- [ ] **Step 3: Create the service** — `app/Services/Auth/B2bPhoneAuthService.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Models\User;
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
            $this->refuse('Этот номер уже зарегистрирован. Войдите.');
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
```

Сотрудник проверяется по роли: у `User::factory()->create()` и у реальных админов в БД `type` = `b2b` (значение колонки по умолчанию).

- [ ] **Step 4: Create the form requests** — `app/Http/Requests/Auth/PhoneCodeRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use App\Services\Auth\B2bPhoneAuthService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PhoneCodeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Registration fields are validated here too, so a missing name is
     * reported before an SMS is spent.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'phone' => ['required', 'string', 'max:32'],
            'intent' => ['required', Rule::in([B2bPhoneAuthService::INTENT_REGISTER, B2bPhoneAuthService::INTENT_LOGIN])],
            'name' => ['nullable', 'required_if:intent,'.B2bPhoneAuthService::INTENT_REGISTER, 'string', 'max:255'],
            'company_name' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'phone.required' => 'Укажите номер телефона.',
            'intent.required' => 'Не указано действие.',
            'intent.in' => 'Неизвестное действие.',
            'name.required_if' => 'Укажите ваше имя.',
        ];
    }
}
```

`app/Http/Requests/Auth/PhoneRegisterRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class PhoneRegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'phone' => ['required', 'string', 'max:32'],
            'code' => ['required', 'digits:4'],
            'name' => ['required', 'string', 'max:255'],
            'company_name' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'phone.required' => 'Укажите номер телефона.',
            'code.required' => 'Введите код из SMS.',
            'code.digits' => 'Код состоит из 4 цифр.',
            'name.required' => 'Укажите ваше имя.',
        ];
    }
}
```

`app/Http/Requests/Auth/PhoneLoginRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class PhoneLoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'phone' => ['required', 'string', 'max:32'],
            'code' => ['required', 'digits:4'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'phone.required' => 'Укажите номер телефона.',
            'code.required' => 'Введите код из SMS.',
            'code.digits' => 'Код состоит из 4 цифр.',
        ];
    }
}
```

- [ ] **Step 5: Create the controller** — `app/Http/Controllers/Api/Auth/PhoneAuthController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\PhoneCodeRequest;
use App\Http\Requests\Auth\PhoneLoginRequest;
use App\Http\Requests\Auth\PhoneRegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Auth\B2bPhoneAuthService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * B2B portal sign-up and sign-in by phone + SMS code. See B2bPhoneAuthService.
 */
class PhoneAuthController extends Controller
{
    public function __construct(
        private readonly B2bPhoneAuthService $auth,
    ) {}

    public function request(PhoneCodeRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $this->auth->requestCode($validated['phone'], $validated['intent']);

        return new JsonResponse(['message' => 'Код отправлен по SMS.']);
    }

    public function register(PhoneRegisterRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = $this->auth->register(
            $validated['phone'],
            $validated['code'],
            $validated['name'],
            $validated['company_name'] ?? null,
        );

        return new JsonResponse($this->session($user), Response::HTTP_CREATED);
    }

    public function login(PhoneLoginRequest $request): JsonResponse
    {
        $validated = $request->validated();

        return new JsonResponse($this->session($this->auth->login($validated['phone'], $validated['code'])));
    }

    /**
     * @return array{token: string, user: UserResource}
     */
    private function session(User $user): array
    {
        return [
            'token' => $user->createToken('api')->plainTextToken,
            'user' => new UserResource($user),
        ];
    }
}
```

- [ ] **Step 6: Register the routes** — в `routes/api.php` добавить `use App\Http\Controllers\Api\Auth\PhoneAuthController;` рядом с `use ...\AuthController;`, и в группе `Route::prefix('auth')` сразу после строки `Route::post('/login', ...)`:

```php
    // B2B portal: phone + SMS code. Throttled per IP on top of the per-phone
    // limits inside OtpService.
    Route::post('/otp/request', [PhoneAuthController::class, 'request'])->middleware('throttle:5,1');
    Route::post('/otp/register', [PhoneAuthController::class, 'register'])->middleware('throttle:10,1');
    Route::post('/otp/login', [PhoneAuthController::class, 'login'])->middleware('throttle:10,1');
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `php artisan route:clear && php artisan test --compact tests/Feature/Auth/PhoneAuthTest.php`
Expected: PASS (10 тестов). Если маршруты 404 — устаревший route cache (см. память «Test env gotchas»).

- [ ] **Step 8: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Services/Auth/B2bPhoneAuthService.php app/Http/Controllers/Api/Auth/PhoneAuthController.php app/Http/Requests/Auth/Phone*.php routes/api.php tests/Feature/Auth/PhoneAuthTest.php
git commit -m "feat(auth): B2B registration and login by phone + SMS code"
```

---

### Task 3: Удалить старую регистрацию, нормализовать номера B2B, обновить приёмку

**Files:**
- Modify: `routes/api.php`, `app/Http/Controllers/Api/Auth/AuthController.php`
- Delete: `app/Http/Requests/Auth/RegisterRequest.php`
- Create: `database/migrations/2026_09_18_000001_normalize_b2b_user_phones.php`
- Modify: `app/Console/Commands/MvpAcceptanceCommand.php` (шаг «POST /api/auth/register заводит B2B-клиента», `b2bSteps()`)
- Test: `tests/Feature/Auth/AuthTest.php`, create `tests/Feature/Migrations/NormalizeB2bUserPhonesTest.php`, `tests/Feature/Acceptance/MvpAcceptanceCommandTest.php` (без изменений, должен остаться зелёным)

**Interfaces:**
- Consumes: `POST /api/auth/otp/request`, `/api/auth/otp/register` (Task 2).
- Produces: `POST /api/auth/register` отвечает 404; `POST /api/auth/login` находит B2B-клиента по номеру, набранному в любом формате.

- [ ] **Step 1: Write the failing tests**

В `AuthTest` удалить `validRegisterPayload()` и шесть тестов `register_*` (удаление маршрута согласовано пользователем 2026-09-18; покрытие перешло в `PhoneAuthTest`). Добавить:

```php
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
```

Если после удаления `Store` в `AuthTest` больше не используется, импорт уберёт pint.

`tests/Feature/Migrations/NormalizeB2bUserPhonesTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Migrations;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class NormalizeB2bUserPhonesTest extends TestCase
{
    use RefreshDatabase;

    private function runMigration(): void
    {
        (require database_path('migrations/2026_09_18_000001_normalize_b2b_user_phones.php'))->up();
    }

    #[Test]
    public function b2b_phones_typed_by_hand_are_normalized(): void
    {
        $client = User::factory()->b2b()->create(['phone' => '8 (707) 123-45-67']);

        $this->runMigration();

        $this->assertSame('+77071234567', $client->refresh()->phone);
    }

    #[Test]
    public function a_number_already_taken_in_normalized_form_is_left_alone(): void
    {
        User::factory()->retail()->create(['phone' => '+77071234567']);
        $client = User::factory()->b2b()->create(['phone' => '8 707 123 45 67']);

        $this->runMigration();

        $this->assertSame('8 707 123 45 67', $client->refresh()->phone);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --compact tests/Feature/Auth/AuthTest.php tests/Feature/Migrations/NormalizeB2bUserPhonesTest.php`
Expected: FAIL — `/api/auth/register` отвечает 422, логин с «8 (700)…» — 422, файла миграции нет.

- [ ] **Step 3: Implement**

`routes/api.php` — удалить комментарий «Self-registration is temporarily disabled…» и строку `Route::post('/register', [AuthController::class, 'register']);`.

`AuthController` — удалить метод `register()` и импорты `RegisterRequest`, `Role`, `Response` (если `Response` больше нигде не используется — он используется в `logout()`, оставить). Добавить `use App\Support\Phone;`. В `login()` заменить поиск пользователя:

```php
        // Phones were stored as typed before SMS login normalized them; match
        // both spellings so either form of the same number signs in.
        $user = $field === 'email'
            ? User::where('email', $credentials['email'])->first()
            : User::whereIn('phone', array_unique([$credentials['phone'], Phone::normalize($credentials['phone'])]))->first();
```

Обновить docblock `login()`: «…Login is allowed for unapproved clients: they browse the catalog without prices.»

Удалить `app/Http/Requests/Auth/RegisterRequest.php`:

```bash
git rm app/Http/Requests/Auth/RegisterRequest.php
```

`database/migrations/2026_09_18_000001_normalize_b2b_user_phones.php`:

```php
<?php

declare(strict_types=1);

use App\Support\Phone;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * SMS login finds B2B clients by the normalized number (+7XXXXXXXXXX),
     * while the old registration form stored the phone as typed. Rewrite
     * those in place; a number whose normalized form already belongs to
     * another row is left for the manager to resolve.
     */
    public function up(): void
    {
        DB::table('users')
            ->where('type', 'b2b')
            ->whereNotNull('phone')
            ->orderBy('id')
            ->each(function (object $user): void {
                $normalized = Phone::normalize((string) $user->phone);

                if ($normalized === '' || $normalized === $user->phone) {
                    return;
                }

                if (DB::table('users')->where('phone', $normalized)->exists()) {
                    return;
                }

                DB::table('users')->where('id', $user->id)->update(['phone' => $normalized]);
            });
    }

    /**
     * The original spelling is not recoverable, and the normalized one is
     * valid for every code path.
     */
    public function down(): void {}
};
```

`MvpAcceptanceCommand` — добавить импорты `use App\Models\OtpCode;`, `use App\Support\Phone;`, `use Illuminate\Support\Facades\Hash;` (если их нет). Заменить первый шаг в `b2bSteps()` целиком:

```php
            [
                'title' => 'POST /api/auth/otp/register заводит B2B-клиента по коду из SMS',
                'run' => function (): true|array {
                    $name = "ACC Партнёр {$this->runToken}";

                    $sent = $this->send('POST', '/api/auth/otp/request', [
                        'phone' => $this->b2bPhone,
                        'intent' => 'register',
                        'name' => $name,
                    ]);

                    if ($sent['status'] !== 200) {
                        return $this->mismatch('HTTP 200 на запрос кода', $this->summarize($sent));
                    }

                    $response = $this->send('POST', '/api/auth/otp/register', [
                        'phone' => $this->b2bPhone,
                        'code' => $this->plantOtpCode($this->b2bPhone),
                        'name' => $name,
                        'company_name' => $name,
                    ]);

                    if ($response['status'] !== 201) {
                        return $this->mismatch('HTTP 201', $this->summarize($response));
                    }

                    $user = User::query()->where('phone', Phone::normalize($this->b2bPhone))->first();

                    if ($user === null) {
                        return $this->mismatch('клиент сохранён в users', "пользователя с телефоном {$this->b2bPhone} нет");
                    }

                    // Вход по паролю (шаг ниже) и браузерные тесты входят с
                    // паролем прогона — задаём его, как это сделал бы менеджер.
                    $user->forceFill(['password' => $this->b2bPassword, 'email' => $this->b2bEmail])->save();

                    $this->b2bUser = $user;
                    $this->b2bToken = (string) data_get($response['json'], 'token');
                    $this->leftovers[] = "B2B-клиент #{$user->id} ({$user->email}, {$this->b2bPhone})";

                    if ($user->is_approved) {
                        return $this->mismatch('клиент создан неодобренным', 'is_approved = true сразу после регистрации');
                    }

                    return $this->b2bToken !== ''
                        ? true
                        : $this->mismatch('в ответе есть token', 'token пуст');
                },
            ],
```

И добавить приватный метод рядом с `nextTestPhone()`:

```php
    /**
     * Код из SMS прогону не виден (он уходит в драйвер), а вне local/testing
     * он ещё и случайный. Прогон подменяет хеш только что выданного кода на
     * известный — шаг проходит одинаково через kernel и по --url, база общая.
     */
    private function plantOtpCode(string $phone): string
    {
        $code = '4242';

        OtpCode::query()
            ->where('phone', Phone::normalize($phone))
            ->whereNull('consumed_at')
            ->latest('id')
            ->firstOrFail()
            ->update(['code_hash' => Hash::make($code)]);

        return $code;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `php artisan route:clear && php artisan test --compact tests/Feature/Auth tests/Feature/Migrations/NormalizeB2bUserPhonesTest.php tests/Feature/Acceptance/MvpAcceptanceCommandTest.php`
Expected: PASS. Шаг приёмки «Неодобренный клиент получает 403 на GET /api/products» ещё зелёный — его меняет Task 5.

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add -A routes/api.php app/Http/Controllers/Api/Auth/AuthController.php app/Http/Requests/Auth database/migrations/2026_09_18_000001_normalize_b2b_user_phones.php app/Console/Commands/MvpAcceptanceCommand.php tests/Feature/Auth/AuthTest.php tests/Feature/Migrations/NormalizeB2bUserPhonesTest.php
git commit -m "feat(auth): drop password registration; normalize B2B phones; acceptance registers by SMS"
```

---

### Task 4: b2b-portal — регистрация по SMS и переключатель «Пароль / SMS-код» на входе

**Files:**
- Create: `b2b-portal/src/components/auth/AuthCard.tsx`, `FieldError.tsx`, `PhoneCodeForm.tsx`
- Rewrite: `b2b-portal/src/app/(auth)/register/page.tsx`, `b2b-portal/src/app/(auth)/login/page.tsx`
- Modify: `b2b-portal/src/messages/ru.json`, `b2b-portal/src/messages/kk.json`

**Interfaces:**
- Consumes: `/api/auth/otp/request|register|login` (Task 2), `/api/auth/login` (без изменений).
- Produces: `PhoneCodeForm` props `{ intent: "register" | "login"; payload?: Record<string, string>; fields?: (errors: Record<string, string[]>) => ReactNode; submitLabel: string; onSuccess: (token: string, user: ApiUser) => void }`; `authInputClass` из `AuthCard.tsx`.

- [ ] **Step 1: Add translations** — в `ru.json` добавить верхнеуровневый ключ `"b2bAuth"` (существующий `"auth"` — витринный, не трогать):

```json
  "b2bAuth": {
    "brand": "Paradise B2B",
    "loginTitle": "Вход для оптовиков",
    "registerTitle": "Регистрация оптовика",
    "registerSubtitle": "Имя, номер телефона и код из SMS — больше ничего не нужно",
    "tabPassword": "Пароль",
    "tabSms": "SMS-код",
    "phone": "Номер телефона",
    "password": "Пароль",
    "name": "Ваше имя",
    "companyName": "Организация",
    "optional": "необязательно",
    "sendCode": "Получить код",
    "sending": "Отправка…",
    "code": "Код из SMS",
    "codeSent": "Код отправлен на номер {phone}",
    "changePhone": "Изменить номер",
    "resend": "Отправить код ещё раз",
    "resendIn": "Повторно через {seconds} с",
    "login": "Войти",
    "loggingIn": "Вход…",
    "register": "Зарегистрироваться",
    "noAccount": "Нет аккаунта?",
    "toRegister": "Зарегистрироваться",
    "haveAccount": "Уже есть аккаунт?",
    "toLogin": "Войти",
    "wrongCredentials": "Неверный номер телефона или пароль",
    "genericError": "Что-то пошло не так. Попробуйте ещё раз."
  }
```

В `kk.json` — тот же набор ключей:

```json
  "b2bAuth": {
    "brand": "Paradise B2B",
    "loginTitle": "Көтерме сатып алушыларға кіру",
    "registerTitle": "Көтерме сатып алушыны тіркеу",
    "registerSubtitle": "Аты, телефон нөмірі және SMS коды — басқа ештеңе керек емес",
    "tabPassword": "Құпиясөз",
    "tabSms": "SMS коды",
    "phone": "Телефон нөмірі",
    "password": "Құпиясөз",
    "name": "Атыңыз",
    "companyName": "Ұйым",
    "optional": "міндетті емес",
    "sendCode": "Код алу",
    "sending": "Жіберілуде…",
    "code": "SMS-тен келген код",
    "codeSent": "Код {phone} нөміріне жіберілді",
    "changePhone": "Нөмірді өзгерту",
    "resend": "Кодты қайта жіберу",
    "resendIn": "{seconds} с кейін қайта жіберу",
    "login": "Кіру",
    "loggingIn": "Кіру…",
    "register": "Тіркелу",
    "noAccount": "Аккаунтыңыз жоқ па?",
    "toRegister": "Тіркелу",
    "haveAccount": "Аккаунтыңыз бар ма?",
    "toLogin": "Кіру",
    "wrongCredentials": "Телефон нөмірі немесе құпиясөз қате",
    "genericError": "Бірдеңе дұрыс болмады. Қайталап көріңіз."
  }
```

- [ ] **Step 2: Create shared pieces** — `src/components/auth/AuthCard.tsx`:

```tsx
import type { ReactNode } from "react";

export const authInputClass =
  "w-full px-4 py-2 border border-line rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-ink";

export const authPrimaryButtonClass =
  "w-full bg-ink text-white py-3 rounded-lg font-medium hover:bg-ink-hover transition-colors disabled:opacity-50";

type Props = {
  brand: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Centered card shared by the login and registration pages. */
export function AuthCard({ brand, title, subtitle, children, footer }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-line p-8">
        <div className="text-center mb-6">
          <div className="font-display text-2xl font-semibold tracking-tight text-ink mb-1">{brand}</div>
          <h1 className="text-lg font-medium text-ink">{title}</h1>
          {subtitle ? <p className="text-sm text-muted mt-1">{subtitle}</p> : null}
        </div>
        {children}
        {footer ? <div className="mt-6 text-center text-sm text-muted">{footer}</div> : null}
      </div>
    </div>
  );
}
```

`src/components/auth/FieldError.tsx`:

```tsx
export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;

  return (
    <p role="alert" className="mt-1 text-sm text-red-600">
      {messages.join(" ")}
    </p>
  );
}
```

- [ ] **Step 3: Create `PhoneCodeForm`** — `src/components/auth/PhoneCodeForm.tsx`:

```tsx
"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { apiPost, ApiValidationError } from "@/lib/api";
import type { ApiUser } from "@/lib/types";
import { authInputClass, authPrimaryButtonClass } from "./AuthCard";
import { FieldError } from "./FieldError";

const RESEND_SECONDS = 60;

type Errors = Record<string, string[]>;

type Props = {
  intent: "register" | "login";
  /** Sent with both calls — registration passes name and company_name. */
  payload?: Record<string, string>;
  /** Extra inputs rendered above the phone on the first step. */
  fields?: (errors: Errors) => ReactNode;
  submitLabel: string;
  onSuccess: (token: string, user: ApiUser) => void;
};

/**
 * Two steps: phone (+ caller's fields) → "Получить код" → 4-digit code.
 * Preconditions (number taken / unknown) come back as 422 on the first call,
 * before any SMS is sent.
 */
export function PhoneCodeForm({ intent, payload = {}, fields, submitLabel, onSuccess }: Props) {
  const t = useTranslations("b2bAuth");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const fail = (err: unknown) => {
    if (err instanceof ApiValidationError) {
      setErrors(err.errors);
      setError(null);
    } else {
      setError(t("genericError"));
    }
  };

  const requestCode = async () => {
    setIsLoading(true);
    setErrors({});
    setError(null);
    try {
      await apiPost("/auth/otp/request", { phone, intent, ...payload });
      setStep("code");
      setCode("");
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      fail(err);
    } finally {
      setIsLoading(false);
    }
  };

  const confirm = async () => {
    setIsLoading(true);
    setErrors({});
    setError(null);
    try {
      const response = await apiPost<{ token: string; user: ApiUser }>(`/auth/otp/${intent}`, {
        phone,
        code,
        ...payload,
      });
      onSuccess(response.token, response.user);
    } catch (err) {
      fail(err);
      // Number-level problems (taken meanwhile, bad name) are fixed on step one.
      if (err instanceof ApiValidationError && !err.errors.code) {
        setStep("phone");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void (step === "phone" ? requestCode() : confirm());
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div> : null}

      {step === "phone" ? (
        <>
          {fields?.(errors)}
          <div>
            <label htmlFor="otp-phone" className="block text-sm font-medium text-ink mb-1">
              {t("phone")} <span className="text-red-500">*</span>
            </label>
            <input
              id="otp-phone"
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={authInputClass}
              placeholder="+7 (___) ___-__-__"
            />
            <FieldError messages={errors.phone} />
          </div>
          <button type="submit" disabled={isLoading || phone.trim() === ""} className={authPrimaryButtonClass}>
            {isLoading ? t("sending") : t("sendCode")}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">{t("codeSent", { phone })}</p>
          <div>
            <label htmlFor="otp-code" className="block text-sm font-medium text-ink mb-1">
              {t("code")}
            </label>
            <input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className={`${authInputClass} text-center text-2xl tracking-[0.5em]`}
            />
            <FieldError messages={errors.code} />
          </div>
          <button type="submit" disabled={isLoading || code.length !== 4} className={authPrimaryButtonClass}>
            {submitLabel}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setErrors({});
              }}
              className="text-muted hover:text-ink"
            >
              {t("changePhone")}
            </button>
            <button
              type="button"
              disabled={resendIn > 0 || isLoading}
              onClick={() => void requestCode()}
              className="text-ink hover:underline disabled:text-muted disabled:no-underline"
            >
              {resendIn > 0 ? t("resendIn", { seconds: resendIn }) : t("resend")}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Rewrite `/register`** — `src/app/(auth)/register/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useB2bAuth } from "@/stores/useB2bAuth";
import { AuthCard, authInputClass } from "@/components/auth/AuthCard";
import { FieldError } from "@/components/auth/FieldError";
import { PhoneCodeForm } from "@/components/auth/PhoneCodeForm";

export default function B2BRegisterPage() {
  const t = useTranslations("b2bAuth");
  const router = useRouter();
  const setSession = useB2bAuth((state) => state.setSession);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");

  return (
    <AuthCard
      brand={t("brand")}
      title={t("registerTitle")}
      subtitle={t("registerSubtitle")}
      footer={
        <>
          {t("haveAccount")}{" "}
          <Link href="/login" className="text-ink font-medium hover:underline">
            {t("toLogin")}
          </Link>
        </>
      }
    >
      <PhoneCodeForm
        intent="register"
        payload={{ name, company_name: companyName }}
        submitLabel={t("register")}
        onSuccess={(token, user) => {
          setSession(token, user);
          router.push("/catalog");
        }}
        fields={(errors) => (
          <>
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-ink mb-1">
                {t("name")} <span className="text-red-500">*</span>
              </label>
              <input
                id="reg-name"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={authInputClass}
              />
              <FieldError messages={errors.name} />
            </div>
            <div>
              <label htmlFor="reg-company" className="block text-sm font-medium text-ink mb-1">
                {t("companyName")} <span className="text-muted font-normal">({t("optional")})</span>
              </label>
              <input
                id="reg-company"
                autoComplete="organization"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={authInputClass}
                placeholder="ТОО Пример"
              />
              <FieldError messages={errors.company_name} />
            </div>
          </>
        )}
      />
    </AuthCard>
  );
}
```

- [ ] **Step 5: Rewrite `/login`** — `src/app/(auth)/login/page.tsx`. Вкладка «Пароль» открыта по умолчанию: e2e (`e2e/auth.setup.ts`, `e2e/login.spec.ts`) заполняют `input[type="tel"]` + `input[type="password"]` и жмут кнопку «Войти».

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useB2bAuth } from "@/stores/useB2bAuth";
import { apiPost, ApiError, ApiValidationError } from "@/lib/api";
import type { ApiUser } from "@/lib/types";
import { AuthCard, authInputClass, authPrimaryButtonClass } from "@/components/auth/AuthCard";
import { PhoneCodeForm } from "@/components/auth/PhoneCodeForm";

type Mode = "password" | "sms";

export default function B2BLoginPage() {
  const t = useTranslations("b2bAuth");
  const router = useRouter();
  const setSession = useB2bAuth((state) => state.setSession);

  const [mode, setMode] = useState<Mode>("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const signedIn = (token: string, user: ApiUser) => {
    setSession(token, user);
    router.push("/catalog");
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const response = await apiPost<{ token: string; user: ApiUser }>("/auth/login", {
        phone,
        password,
        device_name: "b2b_web",
      });
      signedIn(response.token, response.user);
    } catch (err: unknown) {
      if (err instanceof ApiValidationError) {
        setError(err.messages.join(", "));
      } else if (err instanceof ApiError && err.status === 401) {
        setError(t("wrongCredentials"));
      } else {
        setError(t("genericError"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const tabClass = (active: boolean) =>
    `flex-1 rounded-md py-2 text-sm font-medium transition ${active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`;

  return (
    <AuthCard
      brand={t("brand")}
      title={t("loginTitle")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href="/register" className="text-ink font-medium hover:underline">
            {t("toRegister")}
          </Link>
        </>
      }
    >
      <div className="mb-6 flex gap-1 rounded-lg bg-surface p-1" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "password"} className={tabClass(mode === "password")} onClick={() => setMode("password")}>
          {t("tabPassword")}
        </button>
        <button type="button" role="tab" aria-selected={mode === "sms"} className={tabClass(mode === "sms")} onClick={() => setMode("sms")}>
          {t("tabSms")}
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={submitPassword} className="space-y-4">
          {error ? <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div> : null}
          <div>
            <label htmlFor="login-phone" className="block text-sm font-medium text-ink mb-1">{t("phone")}</label>
            <input
              id="login-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className={authInputClass}
              placeholder="+7 (___) ___-__-__"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-ink mb-1">{t("password")}</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={authInputClass}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={isLoading} className={`${authPrimaryButtonClass} mt-4`}>
            {isLoading ? t("loggingIn") : t("login")}
          </button>
        </form>
      ) : (
        <PhoneCodeForm intent="login" submitLabel={t("login")} onSuccess={signedIn} />
      )}
    </AuthCard>
  );
}
```

- [ ] **Step 6: Type-check and build**

Run: `cd b2b-portal && npx tsc --noEmit && npm run build`
Expected: без ошибок. Страница `/pending` пока остаётся (удаляет Task 6); после входа неодобренный попадёт на `/catalog`, а `(portal)/layout.tsx` до Task 6 ещё уводит его на `/pending` — это ожидаемо.

- [ ] **Step 7: Verify in the browser**

Запустить API и портал (`preview_start` по `.claude/launch.json`; если конфигурации нет — создать для `b2b-portal`: `npm run dev -- -p 3001`). Проверить на `http://localhost:3001`:
1. `/register`: имя «Тест», телефон `+7 700 000 12 34` → «Получить код» → код `1111` → редирект (на `/pending` до Task 6).
2. `/register` с тем же номером → ошибка «Этот номер уже зарегистрирован. Войдите.» у поля телефона, SMS не уходит.
3. `/login` → «SMS-код» → тот же номер → `1111` → вход.
4. `/login` → «Пароль» → неверный пароль → «Неверный…».

- [ ] **Step 8: Commit**

```bash
git add b2b-portal/src/components/auth b2b-portal/src/app/\(auth\)/register/page.tsx b2b-portal/src/app/\(auth\)/login/page.tsx b2b-portal/src/messages/ru.json b2b-portal/src/messages/kk.json
git commit -m "feat(b2b-portal): register by phone + SMS code; password or SMS login"
```

---

# Этап 2. Режим «ещё не одобрен»

### Task 5: API — каталог для неодобренного без коммерческих данных

**Files:**
- Modify: `routes/api.php` (группа `['auth:sanctum', 'approved', 'b2b']`)
- Modify: `app/Http/Controllers/Api/ProductController.php`
- Modify: `app/Http/Resources/ProductResource.php`
- Modify: `app/Console/Commands/MvpAcceptanceCommand.php` (шаг «Неодобренный клиент получает 403 на GET /api/products»)
- Test: create `tests/Feature/Catalog/UnapprovedCatalogTest.php`; modify `tests/Feature/Catalog/CatalogApiTest.php`

**Interfaces:**
- Produces:
  - Временный атрибут модели `Product::$hide_commercial` (bool). Когда `true`, `ProductResource` не включает `price`, `old_price`, `stock`, `in_stock`, `showrooms`, а у `variants[]` — `stock`, `in_stock`. Task 8 ставит его на товары главной.
  - `GET /api/categories`, `/api/products`, `/api/products/{id}`: `auth:sanctum` + `b2b` (без `approved`).

- [ ] **Step 1: Write the failing tests** — `tests/Feature/Catalog/UnapprovedCatalogTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Catalog;

use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * A B2B client awaiting approval browses the catalog but never receives
 * prices or stock — the keys are absent from the JSON, not just null.
 */
class UnapprovedCatalogTest extends TestCase
{
    use RefreshDatabase;

    private const COMMERCIAL_KEYS = ['price', 'old_price', 'stock', 'in_stock', 'showrooms'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    /**
     * @param  array<string, mixed>  $product
     */
    private function assertNoCommercialKeys(array $product): void
    {
        foreach (self::COMMERCIAL_KEYS as $key) {
            $this->assertArrayNotHasKey($key, $product, "Unapproved client must not receive `{$key}`");
        }
    }

    #[Test]
    public function the_listing_has_products_but_no_prices_or_stock(): void
    {
        Sanctum::actingAs(User::factory()->b2b()->create());
        $store = Store::factory()->create();
        $product = Product::factory()->create(['b2b_price' => 200_000, 'compare_at_price' => 300_000]);
        ProductStoreStock::factory()->for($product)->for($store)->create(['stock' => 5]);

        $response = $this->getJson('/api/products?store_id='.$store->id)->assertOk();

        $response->assertJsonPath('data.0.id', $product->id);
        $this->assertNoCommercialKeys($response->json('data.0'));
    }

    #[Test]
    public function the_detail_hides_prices_and_variant_stock(): void
    {
        Sanctum::actingAs(User::factory()->b2b()->create());
        $product = Product::factory()->create(['b2b_price' => 200_000]);
        ProductVariant::factory()->for($product)->create(['stock' => 3]);

        $response = $this->getJson('/api/products/'.$product->id)->assertOk();

        $this->assertNoCommercialKeys($response->json('data'));
        $this->assertArrayNotHasKey('stock', $response->json('data.variants.0'));
        $this->assertArrayNotHasKey('in_stock', $response->json('data.variants.0'));
        $this->assertNotNull($response->json('data.variants.0.name'));
    }

    #[Test]
    public function the_in_stock_filter_reveals_nothing(): void
    {
        Sanctum::actingAs(User::factory()->b2b()->create());
        $store = Store::factory()->create();
        $stocked = Product::factory()->create();
        $empty = Product::factory()->create();
        ProductStoreStock::factory()->for($stocked)->for($store)->create(['stock' => 5]);
        ProductStoreStock::factory()->for($empty)->for($store)->create(['stock' => 0]);

        $response = $this->getJson('/api/products?store_id='.$store->id.'&filter[in_stock]=1')->assertOk();

        $this->assertEqualsCanonicalizing(
            [$stocked->id, $empty->id],
            collect($response->json('data'))->pluck('id')->all(),
        );
    }

    #[Test]
    public function categories_are_open_to_an_unapproved_client(): void
    {
        Sanctum::actingAs(User::factory()->b2b()->create());

        $this->getJson('/api/categories')->assertOk();
    }

    #[Test]
    public function cart_orders_and_addresses_stay_closed(): void
    {
        Sanctum::actingAs(User::factory()->b2b()->create());

        $this->postJson('/api/cart/validate', ['items' => []])->assertForbidden();
        $this->getJson('/api/orders')->assertForbidden();
        $this->postJson('/api/orders', [])->assertForbidden();
        $this->getJson('/api/addresses')->assertForbidden();
    }

    #[Test]
    public function an_approved_client_still_gets_prices_and_stock(): void
    {
        Sanctum::actingAs(User::factory()->b2b()->approved()->create());
        $store = Store::factory()->create();
        $product = Product::factory()->create(['b2b_price' => 200_000]);
        ProductStoreStock::factory()->for($product)->for($store)->create(['stock' => 5]);

        $this->getJson('/api/products?store_id='.$store->id)
            ->assertOk()
            ->assertJsonPath('data.0.price', 2000)
            ->assertJsonPath('data.0.in_stock', true)
            ->assertJsonPath('data.0.stock', 5);
    }

    #[Test]
    public function the_storefront_still_shows_retail_prices(): void
    {
        Product::factory()->create(['retail_price' => 250_000]);

        $response = $this->getJson('/api/public/products')->assertOk();

        $this->assertEqualsWithDelta(2500.0, $response->json('data.0.price'), 0.001);
        $this->assertArrayHasKey('in_stock', $response->json('data.0'));
    }
}
```

В `CatalogApiTest` заменить тест `unapproved_user_is_blocked_from_products` (поведение изменилось по спеку, этап 2):

```php
    #[Test]
    public function unapproved_user_sees_products_without_prices(): void
    {
        Sanctum::actingAs(User::factory()->b2b()->create()); // pending
        Product::factory()->create(['b2b_price' => 200_000]);

        $this->getJson('/api/products')
            ->assertOk()
            ->assertJsonMissingPath('data.0.price');
    }
```

Если `Product::factory()` не знает `compare_at_price`, оставить только `b2b_price`. Если у `ProductFactory` цена в другом поле, свериться с `CatalogApiTest::per_client_price_reflects_the_discount` (там `b2b_price` 200000 → 2000 ₸ до скидки).

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --compact tests/Feature/Catalog/UnapprovedCatalogTest.php tests/Feature/Catalog/CatalogApiTest.php`
Expected: FAIL — неодобренный получает 403 на `/api/products`, `/api/categories`.

- [ ] **Step 3: Split the route group** — в `routes/api.php` заменить комментарий и начало группы каталога:

```php
// Catalog: any B2B client, approved or not. Unapproved clients browse it
// without prices or stock (ProductController sets `hide_commercial`).
// `b2b` matters: retail (storefront) accounts are auto-approved, so without
// it a retail token could read wholesale prices.
Route::middleware(['auth:sanctum', 'b2b'])->group(function () {
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::get('/products', [ProductController::class, 'index']);
    // Numeric id only: slugs are the public storefront's addressing. Without
    // the constraint MySQL would cast '3-kreslo' to 3 and resolve product 3.
    Route::get('/products/{product}', [ProductController::class, 'show'])->whereNumber('product');
});

// Buying: approved B2B clients only.
Route::middleware(['auth:sanctum', 'approved', 'b2b'])->group(function () {
    Route::post('/cart/validate', [B2bCartController::class, 'validateCart']);
```

(остальные маршруты группы — `orders`, `addresses` — остаются как были, под `approved`).

- [ ] **Step 4: Hide commercial data in the resource** — в `ProductResource::toArray()` заменить четыре строки `stock` / `in_stock` / `price` / `old_price`:

```php
            'stock' => $this->when(! $this->hidesCommercialData() && $this->showStockQuantity(), fn (): float => $this->resolvedStock()),
            'in_stock' => $this->when(! $this->hidesCommercialData(), fn (): bool => $this->resolvedStock() > 0),
            'price' => $this->when(! $this->hidesCommercialData(), fn (): ?float => $this->majorPrice()),
            'old_price' => $this->when(! $this->hidesCommercialData(), fn (): ?float => $this->majorComparePrice()),
```

В `'showrooms' => $this->when(` условие дополнить: `! $this->hidesCommercialData() && (bool) ($this->resource->with_description ?? false) && $this->relationLoaded('storeStocks')`.

`variantsPayload()` заменить:

```php
    private function variantsPayload(): array
    {
        $showStockQuantity = $this->showStockQuantity();
        $hideCommercial = $this->hidesCommercialData();

        return $this->variants
            ->map(function ($variant) use ($showStockQuantity, $hideCommercial): array {
                $payload = [
                    'id' => $variant->id,
                    'external_id' => $variant->external_id,
                    'name' => $variant->name,
                    'characteristics' => $variant->characteristics ?? [],
                    'barcodes' => $variant->barcodes ?? [],
                ];

                if ($hideCommercial) {
                    return $payload;
                }

                return $payload + [
                    'stock' => $this->when($showStockQuantity, (float) $variant->stock),
                    'in_stock' => (float) $variant->stock > 0,
                ];
            })
            ->values()
            ->all();
    }
```

Добавить приватный метод рядом с `showStockQuantity()`:

```php
    /**
     * Whether prices and stock must be left out entirely — a B2B client still
     * awaiting approval, or the public B2B home page. `hide_commercial` is a
     * transient attribute set before serialization; absent means shown.
     */
    private function hidesCommercialData(): bool
    {
        return (bool) ($this->resource->hide_commercial ?? false);
    }
```

Дополнить docblock класса строкой про `hide_commercial`.

- [ ] **Step 5: Skip pricing for unapproved in the controller** — в `ProductController::index()` после `$store = ...` добавить `$approved = (bool) $user->is_approved;`. В callback `in_stock` добавить `$approved` в `use` и первой строкой:

```php
                    // Unapproved clients see no stock, so the filter must not reveal it either.
                    if (! $approved) {
                        return;
                    }
```

Перед блоком «Resolve all prices/stocks…»:

```php
        if (! $approved) {
            $products->getCollection()->each(function (Product $product): void {
                $product->hide_commercial = true;
            });

            return ProductResource::collection($products);
        }
```

В `show()` после `$product->loadMissing('media', 'variants');`:

```php
        $product->with_description = true;

        if (! $user->is_approved) {
            $product->hide_commercial = true;

            return new ProductResource($product);
        }
```

и удалить повторную строку `$product->with_description = true;` ниже. Docblock `index()` дополнить: «Unapproved clients get the same list without prices and stock; `in_stock` is ignored for them.»

- [ ] **Step 6: Update the acceptance step** — в `MvpAcceptanceCommand::b2bSteps()` заменить шаг «Неодобренный клиент получает 403 на GET /api/products»:

```php
            [
                'title' => 'Неодобренный клиент видит GET /api/products без цен и остатков',
                'run' => function (): true|array {
                    if (! isset($this->b2bToken)) {
                        return $this->nothingToCheck('каталог без цен до одобрения', 'B2B-клиент не зарегистрировался (шаг 16)');
                    }

                    $response = $this->send('GET', '/api/products', null, $this->b2bToken);

                    if ($response['status'] !== 200) {
                        return $this->mismatch('HTTP 200', $this->summarize($response));
                    }

                    $first = data_get($response['json'], 'data.0');

                    if (! is_array($first)) {
                        return $this->mismatch('в каталоге есть товары', 'data пуст');
                    }

                    foreach (['price', 'old_price', 'stock', 'in_stock'] as $key) {
                        if (array_key_exists($key, $first)) {
                            return $this->mismatch("ключа {$key} нет в ответе", "{$key} = ".json_encode($first[$key]));
                        }
                    }

                    return true;
                },
            ],
```

Если в `REGRESSIONS` или в шапке класса упоминается «403 без одобрения» — обновить формулировку там же. Число шагов (33) не меняется.

- [ ] **Step 7: Run tests to verify they pass**

Run: `php artisan route:clear && php artisan test --compact tests/Feature/Catalog tests/Feature/Auth tests/Feature/Orders tests/Feature/Addresses tests/Feature/Public tests/Feature/Acceptance`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add routes/api.php app/Http/Controllers/Api/ProductController.php app/Http/Resources/ProductResource.php app/Console/Commands/MvpAcceptanceCommand.php tests/Feature/Catalog
git commit -m "feat(catalog): unapproved B2B clients browse the catalog without prices or stock"

---

### Task 6: b2b-portal — неодобренный листает каталог, плашка «Заявка на рассмотрении»

**Files:**
- Create: `b2b-portal/src/lib/approval.ts`, `b2b-portal/src/components/PendingApprovalBanner.tsx`
- Modify: `b2b-portal/src/app/(portal)/layout.tsx`, `b2b-portal/src/components/B2BHeader.tsx`, `b2b-portal/src/components/B2BFooter.tsx`, `b2b-portal/src/components/ProductCard.tsx`, `b2b-portal/src/components/B2BCatalogView.tsx`, `b2b-portal/src/app/(portal)/product/[id]/page.tsx`, `b2b-portal/src/lib/types.ts`, `b2b-portal/src/messages/{ru,kk}.json`
- Delete: `b2b-portal/src/app/(auth)/pending/page.tsx`

**Interfaces:**
- Consumes: `GET /api/auth/me` → `{ user: ApiUser, is_approved: boolean }`; товары без ключей `price`/`in_stock`/`stock` для неодобренного (Task 5).
- Produces: `useIsApproved(): boolean` и `APPROVED_ONLY_PATHS` из `src/lib/approval.ts`; `Product.price?: number | null`, `Product.in_stock?: boolean`, `ProductVariant.in_stock?: boolean`.

- [ ] **Step 1: Add translations** — в `ru.json` новый ключ:

```json
  "approval": {
    "pendingTitle": "Заявка на рассмотрении",
    "pendingText": "Менеджер свяжется с вами — после одобрения откроются оптовые цены и заказ.",
    "priceAfterApproval": "Цена после одобрения"
  }
```

в `kk.json`:

```json
  "approval": {
    "pendingTitle": "Өтінім қаралуда",
    "pendingText": "Менеджер сізбен хабарласады — мақұлдағаннан кейін көтерме бағалар мен тапсырыс ашылады.",
    "priceAfterApproval": "Баға мақұлдағаннан кейін"
  }
```

- [ ] **Step 2: Types** — в `src/lib/types.ts`: в `Product` заменить `in_stock: boolean;` → `in_stock?: boolean;` и `price: number | null;` → `price?: number | null;` (комментарий над ними: `// Absent for a B2B client awaiting approval.`); в `ProductVariant` — `in_stock?: boolean;`.

Run: `cd b2b-portal && npx tsc --noEmit`
Expected: ошибки в местах, где `in_stock`/`price` читаются как обязательные (например, `useState<boolean>(product.in_stock)` в `components/product/ProductInfo.tsx`). Каждую исправить минимально: `product.in_stock ?? false`, `product.price ?? null`. Логику не менять.

- [ ] **Step 3: Approval helpers** — `src/lib/approval.ts`:

```ts
"use client";

import { useB2bAuth } from "@/stores/useB2bAuth";

/** Sections that buy: closed until a manager approves the client. */
export const APPROVED_ONLY_PATHS = ["/cart", "/checkout", "/quick-order", "/orders"] as const;

export function isApprovedOnlyPath(pathname: string): boolean {
  return APPROVED_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function useIsApproved(): boolean {
  return useB2bAuth((state) => state.user?.is_approved === true);
}
```

`src/components/PendingApprovalBanner.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";

export function PendingApprovalBanner() {
  const t = useTranslations("approval");

  return (
    <div role="status" className="border-b border-line bg-mint/40">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-3 sm:px-6 lg:px-10">
        <span className="font-semibold text-mint-ink">{t("pendingTitle")}</span>
        <span className="text-ink">{t("pendingText")}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Portal layout** — `src/app/(portal)/layout.tsx` целиком:

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useB2bAuth } from '@/stores/useB2bAuth';
import { B2BProvider } from '@/lib/b2b-context';
import { apiGet, ApiError } from '@/lib/api';
import { isApprovedOnlyPath } from '@/lib/approval';
import type { ApiUser } from '@/lib/types';
import { B2BHeader } from '@/components/B2BHeader';
import { B2BFooter } from '@/components/B2BFooter';
import { PendingApprovalBanner } from '@/components/PendingApprovalBanner';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, setUser, clear } = useB2bAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Approval happens in the admin panel while the client is signed in:
  // refresh the user once per visit so prices appear without a re-login.
  useEffect(() => {
    if (!token) return;

    apiGet<{ user: ApiUser }>('/auth/me', { token, revalidate: false })
      .then((response) => setUser(response.user))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          clear();
        }
      });
  }, [token, setUser, clear]);

  const isApproved = user?.is_approved === true;
  const isBlocked = !isApproved && isApprovedOnlyPath(pathname);

  useEffect(() => {
    if (!isMounted) return;

    if (!user || !token) {
      router.replace('/login');
      return;
    }

    if (isBlocked) {
      router.replace('/catalog');
    }
  }, [user, token, isBlocked, router, isMounted]);

  // Prevent flash of content while checking auth
  if (!isMounted || !user || !token || isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <B2BProvider token={token} user={user}>
      <div className="min-h-screen flex flex-col">
        <B2BHeader />
        {!isApproved && <PendingApprovalBanner />}
        <main className="flex-1 mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
          {children}
        </main>
        <B2BFooter />
      </div>
    </B2BProvider>
  );
}
```

- [ ] **Step 5: Header and footer** — в `B2BHeader.tsx`:
  - импорт `import { useIsApproved } from '@/lib/approval';`, в теле `const isApproved = useIsApproved();`;
  - ссылку верхней полосы `<Link href="/" …>Вернуться в розничный магазин</Link>` заменить на `<a href={process.env.NEXT_PUBLIC_B2C_URL ?? "https://paradise.kz"} className="hover:text-ink transition">Вернуться в розничный магазин</a>` (`/` теперь главная портала);
  - в `<nav>` добавить первой ссылку `<Link href="/" className="text-sm font-medium hover:opacity-70 transition">Главная</Link>`; ссылку «Мои заказы» обернуть в `{isApproved && (…)}`;
  - ссылку на корзину (`href="/cart"`) обернуть в `{isApproved && (…)}`.

В `B2BFooter.tsx`: добавить `'use client';` первой строкой, `import { useIsApproved } from '@/lib/approval';`, `const isApproved = useIsApproved();`; пункты «Мои заказы» и «Корзина» показывать только при `isApproved`; ссылку «Перейти в розничный магазин» с `href="/"` заменить на `<a href={process.env.NEXT_PUBLIC_B2C_URL ?? "https://paradise.kz"} …>`; в «Навигацию» первым пунктом добавить `<Link href="/">Главная</Link>` с теми же классами.

- [ ] **Step 6: Product card and catalog** — в `ProductCard.tsx`:
  - `const tApproval = useTranslations("approval");` и `const hidesPrice = isB2B && product.price === undefined;`;
  - `discountPercent` не меняется (при отсутствии цен даёт `null`);
  - блок цены: если `hidesPrice` — вместо `<span className="text-lg font-semibold text-ink">{formatPrice(...)}</span>` выводить `<span className="text-sm font-medium text-muted">{tApproval("priceAfterApproval")}</span>`, бейдж «Опт» и артикул оставить;
  - кнопку «В корзину»: условие `showAddToCart && product.in_stock` → `showAddToCart && !hidesPrice && product.in_stock`;
  - блок наличия (`product.in_stock ? … : outOfStockText`) обернуть в `{!hidesPrice && (…)}`;
  - плашку «Мин. заказ» оставить.

В `B2BCatalogView.tsx`: `import { useIsApproved } from "@/lib/approval";`, `const isApproved = useIsApproved();`, `<InStockChip … />` рендерить только при `isApproved`.

- [ ] **Step 7: Product page** — в `src/app/(portal)/product/[id]/page.tsx`: `import { useTranslations } from "next-intl";`, `const tApproval = useTranslations("approval");`, `const hidesPrice = product.price === undefined;` (после проверки `if (!product)`). Блок `<div className="bg-surface rounded-xl p-6 mb-8">…</div>` и блок с `<AddToCartB2BButton />` заменить:

```tsx
          {hidesPrice ? (
            <div className="bg-mint/40 rounded-xl p-6 mb-8">
              <div className="text-xl font-semibold text-ink mb-1">{tApproval("priceAfterApproval")}</div>
              <p className="text-sm text-muted">{tApproval("pendingText")}</p>
            </div>
          ) : (
            <>
              {/* существующий блок цены/наличия/мин. заказа без изменений */}
              {/* существующий блок <div className="mb-8"><AddToCartB2BButton product={product} /></div> */}
            </>
          )}
```

Два комментария-заглушки в JSX заменить исходными блоками дословно (переносятся внутрь фрагмента, не меняются). В исходном блоке выражение `product.price !== null ? … : 'Цена по запросу'` оставить как есть: там `price` уже определён.

- [ ] **Step 8: Remove `/pending`**

```bash
git rm "b2b-portal/src/app/(auth)/pending/page.tsx"
```

Run: `grep -rn "/pending" b2b-portal/src b2b-portal/e2e`
Expected: пусто (login/register уже ведут на `/catalog` после Task 4).

- [ ] **Step 9: Type-check and build**

Run: `cd b2b-portal && npx tsc --noEmit && npm run build`
Expected: без ошибок.

- [ ] **Step 10: Verify in the browser**

С неодобренным клиентом из Task 4 (или новым, зарегистрированным по `1111`):
1. `/catalog`: плашка «Заявка на рассмотрении», в карточках «Цена после одобрения», нет «В корзину», нет чипа «В наличии», в шапке нет корзины и «Мои заказы».
2. `/product/{id}`: «Цена после одобрения», нет кнопки корзины.
3. Прямой переход на `/cart`, `/orders`, `/checkout`, `/quick-order` → редирект на `/catalog`.
4. `read_network_requests` для `/api/products` — в ответе нет `price`/`in_stock`/`stock`.
5. Одобрить клиента в `admin/` (`/users` → «Одобрить») или `php artisan tinker --execute 'App\Models\User::where("phone","+77000001234")->update(["is_approved"=>true]);'`, перезагрузить `/catalog` → плашки нет, цены и корзина на месте.

Скриншот шага 1 — пользователю.

- [ ] **Step 11: Commit**

```bash
git add -A b2b-portal/src
git commit -m "feat(b2b-portal): unapproved clients browse the catalog; pending banner replaces /pending"
```

---

# Этап 3. Главная `/` и её контент в `admin/`

### Task 7: Данные — поля подборок, синглтон `B2bHomeContent`, placement `b2b_home`

**Files:**
- Create: `database/migrations/2026_09_18_000002_add_b2b_home_fields_to_product_collections_table.php`
- Create: `database/migrations/2026_09_18_000003_create_b2b_home_contents_table.php`
- Create: `app/Models/B2bHomeContent.php`, `database/factories/B2bHomeContentFactory.php`
- Modify: `app/Models/ProductCollection.php`, `app/Models/Banner.php`, `database/factories/ProductCollectionFactory.php`, `database/factories/BannerFactory.php`
- Modify: `app/Filament/Resources/Banners/Schemas/BannerForm.php`
- Modify: `app/Http/Controllers/Api/Public/HomeController.php`
- Test: `tests/Feature/Public/HomeTest.php`

**Interfaces:**
- Produces:
  - `ProductCollection`: `description` (translatable json), `show_on_storefront` (bool, default true), `show_on_b2b_home` (bool, default false); `ProductCollection::COVER_COLLECTION = 'cover'` (singleFile, конверсии `wide` 1920×1080 и `card` 800×600, webp); factory state `onB2bHome()`.
  - `Banner::PLACEMENT_B2B_HOME = 'b2b_home'`; `Banner::PLACEMENTS` — `array<string, string>` (ключ → русская подпись); factory state `b2bHome()`.
  - `B2bHomeContent::current(): self`; атрибуты `about_title`, `about_text` (translatable); `B2bHomeContent::ABOUT_IMAGE_COLLECTION = 'about_image'` (singleFile, конверсия `wide` 1600×1200 webp).

- [ ] **Step 1: Write the failing test** — в `HomeTest` добавить:

```php
    #[Test]
    public function collections_hidden_from_the_storefront_are_left_out(): void
    {
        ProductCollection::factory()->create(['title' => 'Витрина']);
        ProductCollection::factory()->create(['title' => 'Только B2B', 'show_on_storefront' => false]);

        $response = $this->getJson('/api/public/home')->assertOk();

        $this->assertSame(['Витрина'], collect($response->json('data.collections'))->pluck('title')->all());
    }

    #[Test]
    public function b2b_home_banners_stay_off_the_storefront(): void
    {
        Banner::factory()->create(['title' => 'Магазин']);
        Banner::factory()->b2bHome()->create(['title' => 'Опт']);

        $response = $this->getJson('/api/public/home')->assertOk();

        $this->assertSame(['Магазин'], collect($response->json('data.banners'))->pluck('title')->all());
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --compact tests/Feature/Public/HomeTest.php`
Expected: FAIL — нет колонки `show_on_storefront`, нет state `b2bHome()`.

- [ ] **Step 3: Migrations** — `2026_09_18_000002_add_b2b_home_fields_to_product_collections_table.php`:

```php
<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A collection doubles as a "style" on the B2B home page (cover photo +
     * description). Where it shows is chosen per surface; existing
     * collections keep showing on the storefront only.
     */
    public function up(): void
    {
        Schema::table('product_collections', function (Blueprint $table) {
            $table->json('description')->nullable()->after('slug');
            $table->boolean('show_on_storefront')->default(true)->after('is_active');
            $table->boolean('show_on_b2b_home')->default(false)->after('show_on_storefront');
        });
    }

    public function down(): void
    {
        Schema::table('product_collections', function (Blueprint $table) {
            $table->dropColumn(['description', 'show_on_storefront', 'show_on_b2b_home']);
        });
    }
};
```

`2026_09_18_000003_create_b2b_home_contents_table.php`:

```php
<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Single-row table: the "who we are" block of the B2B portal home page.
     */
    public function up(): void
    {
        Schema::create('b2b_home_contents', function (Blueprint $table) {
            $table->id();
            $table->json('about_title')->nullable();
            $table->json('about_text')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('b2b_home_contents');
    }
};
```

- [ ] **Step 4: Models**

`ProductCollection` — привести к виду (добавляется `HasMedia`, `description`, флажки, обложка):

```php
use Spatie\Image\Enums\Fit;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/**
 * An admin-curated product selection. On the storefront home it is a
 * product row ("Новинки", "Хиты продаж"); on the B2B portal home it is a
 * "style" with an interior cover photo and a description. `show_on_*`
 * picks the surfaces. Which products surface still passes through the
 * public visibility rules at read time.
 */
class ProductCollection extends Model implements HasMedia
{
    /** @use HasFactory<ProductCollectionFactory> */
    use HasFactory;

    use HasTranslations;
    use InteractsWithMedia;

    public const COVER_COLLECTION = 'cover';

    /** @var list<string> */
    public array $translatable = ['title', 'description'];

    protected $fillable = [
        'title',
        'slug',
        'description',
        'sort_order',
        'is_active',
        'show_on_storefront',
        'show_on_b2b_home',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'show_on_storefront' => 'boolean',
            'show_on_b2b_home' => 'boolean',
        ];
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection(self::COVER_COLLECTION)
            ->useDisk(config('media-library.disk_name'))
            ->singleFile();
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('wide')
            ->fit(Fit::Max, 1920, 1080)
            ->format('webp')
            ->quality(82)
            ->performOnCollections(self::COVER_COLLECTION);

        $this->addMediaConversion('card')
            ->fit(Fit::Max, 800, 600)
            ->format('webp')
            ->quality(82)
            ->performOnCollections(self::COVER_COLLECTION);
    }

    // products() — без изменений
}
```

Сверить `registerMediaConversions` с `Banner`: если там есть `->nonQueued()`, повторить.

`Banner` — после `PLACEMENT_HOME_HERO`:

```php
    public const PLACEMENT_B2B_HOME = 'b2b_home';

    /**
     * Slots a banner can be placed in, with the label managers see.
     *
     * @var array<string, string>
     */
    public const PLACEMENTS = [
        self::PLACEMENT_HOME_HERO => 'Главная магазина — верхний баннер',
        self::PLACEMENT_B2B_HOME => 'B2B-главная — верхний баннер',
    ];
```

Docblock класса: «`placement` names the slot: `home_hero` (storefront) or `b2b_home` (B2B portal home)».

`app/Models/B2bHomeContent.php`:

```php
<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\B2bHomeContentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Image\Enums\Fit;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Spatie\Translatable\HasTranslations;

/**
 * Single-row "who we are" block of the B2B portal home page, edited in
 * the admin SPA (/b2b-home).
 */
class B2bHomeContent extends Model implements HasMedia
{
    /** @use HasFactory<B2bHomeContentFactory> */
    use HasFactory;

    use HasTranslations;
    use InteractsWithMedia;

    public const ABOUT_IMAGE_COLLECTION = 'about_image';

    /** @var list<string> */
    public array $translatable = ['about_title', 'about_text'];

    protected $fillable = [
        'about_title',
        'about_text',
    ];

    public static function current(): self
    {
        return static::query()->firstOrCreate([]);
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection(self::ABOUT_IMAGE_COLLECTION)
            ->useDisk(config('media-library.disk_name'))
            ->singleFile();
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('wide')
            ->fit(Fit::Max, 1600, 1200)
            ->format('webp')
            ->quality(82)
            ->performOnCollections(self::ABOUT_IMAGE_COLLECTION);
    }
}
```

`database/factories/B2bHomeContentFactory.php`:

```php
<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\B2bHomeContent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<B2bHomeContent>
 */
class B2bHomeContentFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'about_title' => ['ru' => 'Paradise — мебель со склада в Алматы'],
            'about_text' => ['ru' => fake()->paragraph()],
        ];
    }
}
```

`BannerFactory` — state:

```php
    public function b2bHome(): static
    {
        return $this->state(fn (array $attributes): array => ['placement' => Banner::PLACEMENT_B2B_HOME]);
    }
```

`ProductCollectionFactory` — state:

```php
    public function onB2bHome(): static
    {
        return $this->state(fn (array $attributes): array => ['show_on_b2b_home' => true]);
    }
```

`BannerForm` (Filament) — `->options([...])` заменить на `->options(Banner::PLACEMENTS)`.

`HomeController::collections()` — после `->where('is_active', true)` добавить `->where('show_on_storefront', true)`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `php artisan test --compact tests/Feature/Public/HomeTest.php tests/Feature/Admin/ProductCollectionApiTest.php`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add database/migrations/2026_09_18_00000{2,3}_*.php app/Models/{ProductCollection,Banner,B2bHomeContent}.php database/factories/{B2bHomeContent,Banner,ProductCollection}Factory.php app/Filament/Resources/Banners/Schemas/BannerForm.php app/Http/Controllers/Api/Public/HomeController.php tests/Feature/Public/HomeTest.php
git commit -m "feat(content): collection covers and surfaces, b2b_home banners, B2B home content singleton"
```

---

### Task 8: `GET /api/b2b/home` — публичные данные главной портала

**Files:**
- Create: `app/Http/Controllers/Api/B2bHomeController.php`
- Modify: `routes/api.php`
- Test: create `tests/Feature/B2b/B2bHomeTest.php`

**Interfaces:**
- Consumes: `Banner::PLACEMENT_B2B_HOME`, `ProductCollection::COVER_COLLECTION`, `show_on_b2b_home`, `B2bHomeContent::current()` (Task 7); `hide_commercial` (Task 5); `VisibilityService::publicProductQuery()`.
- Produces: `GET /api/b2b/home` (без авторизации) →

```json
{ "data": {
  "banners": [{ "id": 1, "title": "…", "subtitle": "…", "url": "…", "image": "…", "image_mobile": "…" }],
  "about": { "title": "…", "text": "…", "image": "…|null" },
  "collections": [{ "id": 1, "title": "…", "slug": "…", "description": "…|null", "cover": "…|null", "cover_card": "…|null", "products": [ProductResource без цен] }]
} }
```

`about` = `null`, если заголовок и текст пусты. Строки локализуются по `Accept-Language` (middleware `SetApiLocale`, как у `/public/*`).

- [ ] **Step 1: Write the failing tests** — `tests/Feature/B2b/B2bHomeTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\B2b;

use App\Models\B2bHomeContent;
use App\Models\Banner;
use App\Models\CatalogGroup;
use App\Models\Product;
use App\Models\ProductCollection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class B2bHomeTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_is_open_without_a_token_and_lists_only_active_b2b_banners(): void
    {
        Banner::factory()->b2bHome()->create(['title' => 'Второй', 'sort_order' => 2]);
        Banner::factory()->b2bHome()->create(['title' => 'Первый', 'sort_order' => 1]);
        Banner::factory()->b2bHome()->inactive()->create(['title' => 'Скрытый']);
        Banner::factory()->create(['title' => 'Магазин']);

        $response = $this->getJson('/api/b2b/home')->assertOk();

        $this->assertSame(['Первый', 'Второй'], collect($response->json('data.banners'))->pluck('title')->all());
    }

    #[Test]
    public function collections_are_the_active_ones_flagged_for_b2b_home(): void
    {
        ProductCollection::factory()->onB2bHome()->create(['title' => 'Лофт', 'description' => 'Металл и дерево']);
        ProductCollection::factory()->onB2bHome()->inactive()->create(['title' => 'Черновик']);
        ProductCollection::factory()->create(['title' => 'Хиты']);

        $response = $this->getJson('/api/b2b/home')->assertOk();

        $response->assertJsonCount(1, 'data.collections')
            ->assertJsonPath('data.collections.0.title', 'Лофт')
            ->assertJsonPath('data.collections.0.description', 'Металл и дерево')
            ->assertJsonPath('data.collections.0.cover', null);
    }

    #[Test]
    public function products_come_without_prices_and_only_from_the_public_catalog(): void
    {
        $collection = ProductCollection::factory()->onB2bHome()->create();
        $visible = Product::factory()->create(['b2b_price' => 200_000, 'retail_price' => 250_000]);
        $restricted = Product::factory()->create();
        $restricted->catalogGroups()->attach(CatalogGroup::factory()->create());
        $collection->products()->attach([$visible->id => ['sort_order' => 1], $restricted->id => ['sort_order' => 2]]);

        $response = $this->getJson('/api/b2b/home')->assertOk();

        $this->assertSame([$visible->id], collect($response->json('data.collections.0.products'))->pluck('id')->all());

        $product = $response->json('data.collections.0.products.0');
        foreach (['price', 'old_price', 'stock', 'in_stock', 'showrooms'] as $key) {
            $this->assertArrayNotHasKey($key, $product);
        }
    }

    #[Test]
    public function about_is_null_until_filled_in_and_then_returned(): void
    {
        $this->getJson('/api/b2b/home')->assertOk()->assertJsonPath('data.about', null);

        B2bHomeContent::current()->update([
            'about_title' => ['ru' => 'Кто мы'],
            'about_text' => ['ru' => 'Шоурум и склад в Алматы'],
        ]);

        $this->getJson('/api/b2b/home')
            ->assertOk()
            ->assertJsonPath('data.about.title', 'Кто мы')
            ->assertJsonPath('data.about.text', 'Шоурум и склад в Алматы')
            ->assertJsonPath('data.about.image', null);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --compact tests/Feature/B2b/B2bHomeTest.php`
Expected: FAIL — 404.

- [ ] **Step 3: Controller** — `app/Http/Controllers/Api/B2bHomeController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\B2bHomeContent;
use App\Models\Banner;
use App\Models\Product;
use App\Models\ProductCollection;
use App\Services\Catalog\VisibilityService;
use Illuminate\Http\JsonResponse;

/**
 * The public B2B portal home page: hero banners, the "who we are" block and
 * the "styles" (collections flagged for it). Open to anonymous visitors, so
 * products carry no prices or stock and come from the public catalog only.
 */
class B2bHomeController extends Controller
{
    /** Cap per style so one home request stays bounded. */
    private const PRODUCTS_PER_COLLECTION = 8;

    public function __construct(
        private readonly VisibilityService $visibility,
    ) {}

    public function __invoke(): JsonResponse
    {
        return response()->json([
            'data' => [
                'banners' => $this->banners(),
                'about' => $this->about(),
                'collections' => $this->collections(),
            ],
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function banners(): array
    {
        return Banner::query()
            ->where('placement', Banner::PLACEMENT_B2B_HOME)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->with('media')
            ->get()
            ->map(fn (Banner $banner): array => [
                'id' => $banner->id,
                'title' => $banner->title,
                'subtitle' => $banner->subtitle,
                'url' => $banner->url,
                'image' => $banner->getFirstMediaUrl(Banner::IMAGE_COLLECTION, 'wide') ?: null,
                'image_mobile' => $banner->getFirstMediaUrl(Banner::IMAGE_COLLECTION, 'mobile') ?: null,
            ])
            ->all();
    }

    /**
     * @return array{title: string|null, text: string|null, image: string|null}|null
     */
    private function about(): ?array
    {
        $content = B2bHomeContent::query()->with('media')->first();

        if ($content === null || (blank($content->about_title) && blank($content->about_text))) {
            return null;
        }

        return [
            'title' => $content->about_title ?: null,
            'text' => $content->about_text ?: null,
            'image' => $content->getFirstMediaUrl(B2bHomeContent::ABOUT_IMAGE_COLLECTION, 'wide') ?: null,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function collections(): array
    {
        $publicProductIds = $this->visibility->publicProductQuery()->select('products.id');

        return ProductCollection::query()
            ->where('is_active', true)
            ->where('show_on_b2b_home', true)
            ->orderBy('sort_order')
            ->with(['media', 'products' => function ($query) use ($publicProductIds): void {
                $query->whereIn('products.id', $publicProductIds)
                    ->with('media')
                    ->limit(self::PRODUCTS_PER_COLLECTION);
            }])
            ->get()
            ->map(function (ProductCollection $collection): array {
                $collection->products->each(function (Product $product): void {
                    $product->hide_commercial = true;
                });

                return [
                    'id' => $collection->id,
                    'title' => $collection->title,
                    'slug' => $collection->slug,
                    'description' => $collection->description ?: null,
                    'cover' => $collection->getFirstMediaUrl(ProductCollection::COVER_COLLECTION, 'wide') ?: null,
                    'cover_card' => $collection->getFirstMediaUrl(ProductCollection::COVER_COLLECTION, 'card') ?: null,
                    'products' => ProductResource::collection($collection->products)->resolve(),
                ];
            })
            ->all();
    }
}
```

- [ ] **Step 4: Route** — в `routes/api.php` импорт `use App\Http\Controllers\Api\B2bHomeController;` и сразу перед комментарием группы `Route::prefix('public')`:

```php
// B2B portal home page: open to anonymous visitors, no prices or stock.
Route::get('/b2b/home', B2bHomeController::class)->middleware(SetApiLocale::class);
```

Проверить, как `SetApiLocale` подключён к `/public/*` (`bootstrap/app.php` или группа в `routes/api.php`): если он глобальный для `api`, `->middleware(...)` не нужен; если алиас — использовать алиас.

- [ ] **Step 5: Run tests to verify they pass**

Run: `php artisan route:clear && php artisan test --compact tests/Feature/B2b/B2bHomeTest.php`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Controllers/Api/B2bHomeController.php routes/api.php tests/Feature/B2b/B2bHomeTest.php
git commit -m "feat(api): public B2B home endpoint (banners, about, styles without prices)"
```

---

### Task 9: Admin API — баннеры (CRUD + фото)

**Files:**
- Create: `app/Http/Controllers/Api/Admin/Concerns/StoresSingleImage.php`
- Create: `app/Http/Controllers/Api/Admin/BannerController.php`
- Create: `app/Http/Requests/Admin/BannerRequest.php`
- Modify: `routes/api.php` (группа `/api/admin`)
- Test: create `tests/Feature/Admin/BannerApiTest.php`

**Interfaces:**
- Consumes: `Banner::PLACEMENTS`, `Banner::IMAGE_COLLECTION` (Task 7).
- Produces:
  - Trait `StoresSingleImage::replaceImage(Request $request, HasMedia&Model $model, string $collection): void` и `removeImage(HasMedia&Model $model, string $collection): void` — Task 10 использует для обложки подборки и фото «Кто мы».
  - `GET /api/admin/banners?placement=` → `{data: AdminBanner[]}`; `POST`/`PUT /api/admin/banners/{id}` → `{data: AdminBanner}`; `DELETE` → 204; `POST /api/admin/banners/{id}/image` (multipart `file`) → `{data: AdminBanner}`; `DELETE /api/admin/banners/{id}/image` → `{data: AdminBanner}`.
  - `AdminBanner = {id, placement, title: {ru?, kk?}, subtitle: {ru?, kk?}, url, sort_order, is_active, image_url: string|null}`.

- [ ] **Step 1: Write the failing tests** — `tests/Feature/Admin/BannerApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Banner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class BannerApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        Storage::fake(config('media-library.disk_name'));
    }

    #[Test]
    public function only_staff_may_manage_banners(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/banners');
    }

    #[Test]
    public function it_creates_updates_filters_and_deletes_a_banner(): void
    {
        $this->actingAsManager();
        Banner::factory()->create(['title' => 'Магазин']);

        $id = $this->postJson('/api/admin/banners', [
            'placement' => Banner::PLACEMENT_B2B_HOME,
            'title' => ['ru' => 'Мебель для вашего магазина', 'kk' => 'Дүкеніңізге жиһаз'],
            'subtitle' => ['ru' => 'Оптом со склада в Алматы'],
            'url' => '/register',
            'sort_order' => 1,
            'is_active' => true,
        ])->assertCreated()->assertJsonPath('data.title.kk', 'Дүкеніңізге жиһаз')->json('data.id');

        $this->getJson('/api/admin/banners?placement='.Banner::PLACEMENT_B2B_HOME)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.image_url', null);

        $this->putJson("/api/admin/banners/{$id}", [
            'placement' => Banner::PLACEMENT_B2B_HOME,
            'title' => ['ru' => 'Новый заголовок'],
            'is_active' => false,
        ])->assertOk()->assertJsonPath('data.is_active', false);

        $this->assertSame('Новый заголовок', Banner::findOrFail($id)->getTranslation('title', 'ru'));

        $this->deleteJson("/api/admin/banners/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('banners', ['id' => $id]);
    }

    #[Test]
    public function the_placement_must_be_a_known_slot(): void
    {
        $this->actingAsManager();

        $this->postJson('/api/admin/banners', ['placement' => 'sidebar'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('placement');
    }

    #[Test]
    public function an_image_is_uploaded_replaced_and_removed(): void
    {
        $this->actingAsManager();
        $banner = Banner::factory()->b2bHome()->create();

        $this->post("/api/admin/banners/{$banner->id}/image", ['file' => UploadedFile::fake()->image('a.jpg', 1920, 800)], ['Accept' => 'application/json'])
            ->assertOk();
        $this->post("/api/admin/banners/{$banner->id}/image", ['file' => UploadedFile::fake()->image('b.jpg', 1920, 800)], ['Accept' => 'application/json'])
            ->assertOk();

        $this->assertCount(1, $banner->fresh()->getMedia(Banner::IMAGE_COLLECTION));
        $this->assertNotNull($this->getJson('/api/admin/banners')->json('data.0.image_url'));

        $this->deleteJson("/api/admin/banners/{$banner->id}/image")->assertOk()->assertJsonPath('data.image_url', null);
        $this->assertCount(0, $banner->fresh()->getMedia(Banner::IMAGE_COLLECTION));
    }

    #[Test]
    public function only_images_are_accepted(): void
    {
        $this->actingAsManager();
        $banner = Banner::factory()->create();

        $this->post("/api/admin/banners/{$banner->id}/image", ['file' => UploadedFile::fake()->create('doc.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --compact tests/Feature/Admin/BannerApiTest.php`
Expected: FAIL — 404.

- [ ] **Step 3: Trait** — `app/Http/Controllers/Api/Admin/Concerns/StoresSingleImage.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Spatie\MediaLibrary\HasMedia;

/**
 * One-photo slots (banner image, collection cover, "who we are" photo):
 * upload replaces — the media collections are singleFile — and delete clears.
 * Same file rules as product photos (ProductMediaController).
 */
trait StoresSingleImage
{
    protected function replaceImage(Request $request, HasMedia&Model $model, string $collection): void
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:jpeg,png,webp', 'max:10240'],
        ], [
            'file.required' => 'Выберите файл.',
            'file.mimes' => 'Только JPEG, PNG или WebP.',
            'file.max' => 'Файл больше 10 МБ.',
        ]);

        $model->addMediaFromRequest('file')->toMediaCollection($collection);
    }

    protected function removeImage(HasMedia&Model $model, string $collection): void
    {
        $model->clearMediaCollection($collection);
    }
}
```

- [ ] **Step 4: Request** — `app/Http/Requests/Admin/BannerRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Models\Banner;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BannerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Title and subtitle are optional: a hero can be a photo alone.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'placement' => ['required', Rule::in(array_keys(Banner::PLACEMENTS))],
            'title' => ['nullable', 'array'],
            'title.ru' => ['nullable', 'string', 'max:255'],
            'title.kk' => ['nullable', 'string', 'max:255'],
            'subtitle' => ['nullable', 'array'],
            'subtitle.ru' => ['nullable', 'string', 'max:255'],
            'subtitle.kk' => ['nullable', 'string', 'max:255'],
            'url' => ['nullable', 'string', 'max:2048'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'placement.required' => 'Выберите место баннера.',
            'placement.in' => 'Неизвестное место баннера.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function validated($key = null, $default = null): mixed
    {
        $validated = parent::validated();

        foreach (['title', 'subtitle'] as $field) {
            $validated[$field] = array_filter(
                $validated[$field] ?? [],
                fn (?string $value): bool => $value !== null && $value !== '',
            );
        }

        if (array_key_exists('sort_order', $validated)) {
            $validated['sort_order'] = (int) ($validated['sort_order'] ?? 0);
        }

        return $key === null ? $validated : data_get($validated, $key, $default);
    }
}
```

- [ ] **Step 5: Controller** — `app/Http/Controllers/Api/Admin/BannerController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\StoresSingleImage;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BannerRequest;
use App\Models\Banner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Hero banners for the storefront home (`home_hero`) and the B2B portal home
 * (`b2b_home`). Filament keeps editing the same rows until it is retired.
 */
class BannerController extends Controller
{
    use StoresSingleImage;

    /**
     * @return array<string, mixed>
     */
    public static function present(Banner $banner): array
    {
        return [
            'id' => $banner->id,
            'placement' => $banner->placement,
            'title' => $banner->getTranslations('title'),
            'subtitle' => $banner->getTranslations('subtitle'),
            'url' => $banner->url,
            'sort_order' => $banner->sort_order,
            'is_active' => $banner->is_active,
            'image_url' => $banner->getFirstMediaUrl(Banner::IMAGE_COLLECTION, 'mobile') ?: null,
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $placement = $request->query('placement');

        $banners = Banner::query()
            ->with('media')
            ->when(is_string($placement) && $placement !== '', fn ($query) => $query->where('placement', $placement))
            ->orderBy('placement')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $banners->map(fn (Banner $banner): array => self::present($banner))->all()]);
    }

    public function store(BannerRequest $request): JsonResponse
    {
        return response()->json(['data' => self::present(Banner::create($request->validated()))], 201);
    }

    public function update(BannerRequest $request, Banner $banner): JsonResponse
    {
        $banner->update($request->validated());

        return response()->json(['data' => self::present($banner)]);
    }

    public function destroy(Banner $banner): JsonResponse
    {
        $banner->delete();

        return response()->json(null, 204);
    }

    public function storeImage(Request $request, Banner $banner): JsonResponse
    {
        $this->replaceImage($request, $banner, Banner::IMAGE_COLLECTION);

        return response()->json(['data' => self::present($banner->fresh())]);
    }

    public function destroyImage(Banner $banner): JsonResponse
    {
        $this->removeImage($banner, Banner::IMAGE_COLLECTION);

        return response()->json(['data' => self::present($banner->fresh())]);
    }
}
```

Если `getFirstMediaUrl(..., 'mobile')` в тестах возвращает пусто (конверсия в очереди), взять оригинал: `$banner->getFirstMediaUrl(Banner::IMAGE_COLLECTION) ?: null`. Проверить, как это решено в `ProductMediaController::present()` (`hasGeneratedConversion`), и повторить тот же приём.

- [ ] **Step 6: Routes** — в `routes/api.php` импорт `use App\Http\Controllers\Api\Admin\BannerController;`, в группе `/api/admin` после строк `product-collections`:

```php
        Route::apiResource('banners', BannerController::class)->except('show');
        Route::post('banners/{banner}/image', [BannerController::class, 'storeImage']);
        Route::delete('banners/{banner}/image', [BannerController::class, 'destroyImage']);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `php artisan route:clear && php artisan test --compact tests/Feature/Admin/BannerApiTest.php`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Controllers/Api/Admin/Concerns/StoresSingleImage.php app/Http/Controllers/Api/Admin/BannerController.php app/Http/Requests/Admin/BannerRequest.php routes/api.php tests/Feature/Admin/BannerApiTest.php
git commit -m "feat(admin-api): banners CRUD with a single image"
```

---

### Task 10: Admin API — поля и обложка подборок, контент «B2B-главная»

**Files:**
- Modify: `app/Http/Controllers/Api/Admin/ProductCollectionController.php`, `app/Http/Requests/Admin/ProductCollectionRequest.php`
- Create: `app/Http/Controllers/Api/Admin/B2bHomeContentController.php`, `app/Http/Requests/Admin/B2bHomeContentRequest.php`
- Modify: `routes/api.php`
- Test: modify `tests/Feature/Admin/ProductCollectionApiTest.php`; create `tests/Feature/Admin/B2bHomeContentApiTest.php`

**Interfaces:**
- Consumes: `StoresSingleImage` (Task 9), `ProductCollection::COVER_COLLECTION`, `B2bHomeContent` (Task 7).
- Produces:
  - Подборка в ответах `index`/`show`/`store`/`update` дополнительно содержит `description: {ru?, kk?}`, `show_on_storefront`, `show_on_b2b_home`, `cover_url: string|null`.
  - `POST|DELETE /api/admin/product-collections/{id}/cover` → `{data: collection}`.
  - `GET /api/admin/b2b-home`, `PUT /api/admin/b2b-home` `{about_title: {ru, kk?}, about_text: {ru, kk?}}`, `POST|DELETE /api/admin/b2b-home/image` → `{data: {about_title: {ru?, kk?}, about_text: {ru?, kk?}, image_url: string|null}}`.

- [ ] **Step 1: Write the failing tests** — в `ProductCollectionApiTest` добавить импорты `Illuminate\Http\UploadedFile`, `Illuminate\Support\Facades\Storage` и тесты:

```php
    #[Test]
    public function it_saves_the_description_and_where_the_collection_shows(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/product-collections', [
            'title' => ['ru' => 'Лофт'],
            'slug' => 'loft',
            'description' => ['ru' => 'Металл и дерево', 'kk' => 'Металл мен ағаш'],
            'is_active' => true,
            'show_on_storefront' => false,
            'show_on_b2b_home' => true,
        ])->assertCreated()->json('data.id');

        $collection = ProductCollection::findOrFail($id);
        $this->assertSame('Металл мен ағаш', $collection->getTranslation('description', 'kk'));
        $this->assertFalse($collection->show_on_storefront);
        $this->assertTrue($collection->show_on_b2b_home);

        $this->getJson("/api/admin/product-collections/{$id}")
            ->assertOk()
            ->assertJsonPath('data.show_on_b2b_home', true)
            ->assertJsonPath('data.cover_url', null);
    }

    #[Test]
    public function a_cover_is_uploaded_and_removed(): void
    {
        Storage::fake(config('media-library.disk_name'));
        $this->actingAsManager();
        $collection = ProductCollection::factory()->create();

        $this->post("/api/admin/product-collections/{$collection->id}/cover", ['file' => UploadedFile::fake()->image('loft.jpg', 1920, 1080)], ['Accept' => 'application/json'])
            ->assertOk();
        $this->assertNotNull($this->getJson("/api/admin/product-collections/{$collection->id}")->json('data.cover_url'));

        $this->deleteJson("/api/admin/product-collections/{$collection->id}/cover")->assertOk()->assertJsonPath('data.cover_url', null);
    }
```

`tests/Feature/Admin/B2bHomeContentApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\B2bHomeContent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class B2bHomeContentApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        Storage::fake(config('media-library.disk_name'));
    }

    #[Test]
    public function only_staff_may_edit_the_b2b_home(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/b2b-home');
    }

    #[Test]
    public function the_about_block_is_read_and_saved(): void
    {
        $this->actingAsManager();

        $this->getJson('/api/admin/b2b-home')
            ->assertOk()
            ->assertJsonPath('data.about_title', [])
            ->assertJsonPath('data.image_url', null);

        $this->putJson('/api/admin/b2b-home', [
            'about_title' => ['ru' => 'Кто мы', 'kk' => 'Біз кімбіз'],
            'about_text' => ['ru' => 'Шоурум и склад в Алматы'],
        ])->assertOk()->assertJsonPath('data.about_title.kk', 'Біз кімбіз');

        $this->assertSame('Шоурум и склад в Алматы', B2bHomeContent::current()->getTranslation('about_text', 'ru'));
        $this->assertSame(1, B2bHomeContent::query()->count());
    }

    #[Test]
    public function the_russian_title_and_text_are_required(): void
    {
        $this->actingAsManager();

        $this->putJson('/api/admin/b2b-home', ['about_title' => ['kk' => 'Біз кімбіз']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['about_title.ru', 'about_text.ru']);
    }

    #[Test]
    public function the_about_photo_is_uploaded_and_removed(): void
    {
        $this->actingAsManager();

        $this->post('/api/admin/b2b-home/image', ['file' => UploadedFile::fake()->image('showroom.jpg', 1600, 1200)], ['Accept' => 'application/json'])
            ->assertOk();
        $this->assertNotNull($this->getJson('/api/admin/b2b-home')->json('data.image_url'));

        $this->deleteJson('/api/admin/b2b-home/image')->assertOk()->assertJsonPath('data.image_url', null);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --compact tests/Feature/Admin/ProductCollectionApiTest.php tests/Feature/Admin/B2bHomeContentApiTest.php`
Expected: FAIL — поля не сохраняются, маршрутов нет.

- [ ] **Step 3: Collection request** — в `ProductCollectionRequest::rules()` добавить:

```php
            'description' => ['nullable', 'array'],
            'description.ru' => ['nullable', 'string', 'max:2000'],
            'description.kk' => ['nullable', 'string', 'max:2000'],
            'show_on_storefront' => ['boolean'],
            'show_on_b2b_home' => ['boolean'],
```

В `validated()` после строки с `title`:

```php
        if (array_key_exists('description', $validated)) {
            $validated['description'] = array_filter(
                $validated['description'] ?? [],
                fn (?string $value): bool => $value !== null && $value !== '',
            );
        }
```

- [ ] **Step 4: Collection controller** — в `ProductCollectionController`: `use StoresSingleImage;`, импорт `Illuminate\Http\Request`, приватный помощник и два действия; `index`/`store`/`show`/`update` отдают модели через него:

```php
    /**
     * The model's own serialization plus the cover URL — the admin form shows it.
     */
    private function withCover(ProductCollection $collection): ProductCollection
    {
        return $collection->setAttribute(
            'cover_url',
            $collection->getFirstMediaUrl(ProductCollection::COVER_COLLECTION, 'card') ?: null,
        );
    }

    public function storeCover(Request $request, ProductCollection $productCollection): JsonResponse
    {
        $this->replaceImage($request, $productCollection, ProductCollection::COVER_COLLECTION);

        return response()->json(['data' => $this->withCover($productCollection->fresh())]);
    }

    public function destroyCover(ProductCollection $productCollection): JsonResponse
    {
        $this->removeImage($productCollection, ProductCollection::COVER_COLLECTION);

        return response()->json(['data' => $this->withCover($productCollection->fresh())]);
    }
```

- `index()`: `ProductCollection::withCount('products')->with('media')->orderBy(...)->get()->map(fn (ProductCollection $c) => $this->withCover($c))`;
- `store()`: `$this->withCover(ProductCollection::create($request->validated()))`;
- `show()`: после `load([...])` — `$this->withCover($productCollection)`;
- `update()`: `$this->withCover($productCollection)`.

Если `cover_url` через `setAttribute` не попадает в JSON (из-за `$fillable`/сериализации он попадёт — атрибуты модели сериализуются все), проверить тестом из Step 1. `media` не должен утечь в JSON: если утекает — `->makeHidden('media')` внутри `withCover()`.

Как и в Task 9: если конверсия `card` в тестах не сгенерирована (очередь), брать оригинал через `getFirstMediaUrl(ProductCollection::COVER_COLLECTION)`.

- [ ] **Step 5: B2B home request and controller** — `app/Http/Requests/Admin/B2bHomeContentRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class B2bHomeContentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'about_title' => ['required', 'array'],
            'about_title.ru' => ['required', 'string', 'max:255'],
            'about_title.kk' => ['nullable', 'string', 'max:255'],
            'about_text' => ['required', 'array'],
            'about_text.ru' => ['required', 'string', 'max:5000'],
            'about_text.kk' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'about_title.ru.required' => 'Укажите заголовок на русском.',
            'about_text.ru.required' => 'Укажите текст на русском.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function validated($key = null, $default = null): mixed
    {
        $validated = parent::validated();

        foreach (['about_title', 'about_text'] as $field) {
            $validated[$field] = array_filter(
                $validated[$field],
                fn (?string $value): bool => $value !== null && $value !== '',
            );
        }

        return $key === null ? $validated : data_get($validated, $key, $default);
    }
}
```

`app/Http/Controllers/Api/Admin/B2bHomeContentController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\StoresSingleImage;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\B2bHomeContentRequest;
use App\Models\B2bHomeContent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The "who we are" block of the B2B portal home page (single row).
 */
class B2bHomeContentController extends Controller
{
    use StoresSingleImage;

    /**
     * @return array{about_title: array<string, string>, about_text: array<string, string>, image_url: string|null}
     */
    private function present(B2bHomeContent $content): array
    {
        return [
            'about_title' => $content->getTranslations('about_title'),
            'about_text' => $content->getTranslations('about_text'),
            'image_url' => $content->getFirstMediaUrl(B2bHomeContent::ABOUT_IMAGE_COLLECTION, 'wide') ?: null,
        ];
    }

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->present(B2bHomeContent::current())]);
    }

    public function update(B2bHomeContentRequest $request): JsonResponse
    {
        $content = B2bHomeContent::current();
        $content->update($request->validated());

        return response()->json(['data' => $this->present($content)]);
    }

    public function storeImage(Request $request): JsonResponse
    {
        $content = B2bHomeContent::current();
        $this->replaceImage($request, $content, B2bHomeContent::ABOUT_IMAGE_COLLECTION);

        return response()->json(['data' => $this->present($content->fresh())]);
    }

    public function destroyImage(): JsonResponse
    {
        $content = B2bHomeContent::current();
        $this->removeImage($content, B2bHomeContent::ABOUT_IMAGE_COLLECTION);

        return response()->json(['data' => $this->present($content->fresh())]);
    }
}
```

`getTranslations()` пустого поля возвращает `[]` — тест `the_about_block_is_read_and_saved` на это рассчитывает.

- [ ] **Step 6: Routes** — импорт `use App\Http\Controllers\Api\Admin\B2bHomeContentController;`, в группе `/api/admin` рядом с `banners`:

```php
        Route::post('product-collections/{product_collection}/cover', [ProductCollectionController::class, 'storeCover']);
        Route::delete('product-collections/{product_collection}/cover', [ProductCollectionController::class, 'destroyCover']);
        Route::get('b2b-home', [B2bHomeContentController::class, 'show']);
        Route::put('b2b-home', [B2bHomeContentController::class, 'update']);
        Route::post('b2b-home/image', [B2bHomeContentController::class, 'storeImage']);
        Route::delete('b2b-home/image', [B2bHomeContentController::class, 'destroyImage']);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `php artisan route:clear && php artisan test --compact tests/Feature/Admin/ProductCollectionApiTest.php tests/Feature/Admin/B2bHomeContentApiTest.php tests/Feature/B2b tests/Feature/Public/HomeTest.php`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Controllers/Api/Admin/{ProductCollectionController,B2bHomeContentController}.php app/Http/Requests/Admin/{ProductCollectionRequest,B2bHomeContentRequest}.php routes/api.php tests/Feature/Admin/{ProductCollectionApiTest,B2bHomeContentApiTest}.php
git commit -m "feat(admin-api): collection covers and surfaces; B2B home about block"
```

---

### Task 11: admin/ — «Баннеры», обложка и флажки подборок, «B2B-главная»

**Files:**
- Modify: `admin/src/lib/validation.ts`
- Create: `admin/src/components/ui/SingleImageUpload.tsx`
- Create: `admin/src/components/banners/BannerForm.tsx`, `admin/src/app/banners/page.tsx`
- Create: `admin/src/app/b2b-home/page.tsx`
- Modify: `admin/src/components/collections/CollectionForm.tsx`, `admin/src/app/product-collections/[id]/page.tsx`, `admin/src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `/api/admin/banners*` (Task 9), `/api/admin/product-collections/{id}/cover`, `/api/admin/b2b-home*` (Task 10).
- Produces: `SingleImageUpload` props `{ path: string; imageUrl: string | null; label: string; hint?: string; onChange: () => unknown }` — POST (multipart `file`) и DELETE по `path`.

- [ ] **Step 1: Validation helpers** — в `admin/src/lib/validation.ts` добавить:

```ts
/** A {ru, kk} pair where both may be empty (banner captions). */
export const optionalTranslatable = z.object({
  ru: z.string().max(255),
  kk: z.string().max(255),
});

/** Longer optional {ru, kk} text (collection description). */
export const optionalTranslatableText = z.object({
  ru: z.string().max(2000),
  kk: z.string().max(2000),
});

/** Long {ru, kk} text where ru is required ("who we are"). */
export const translatableText = z.object({
  ru: z.string().min(1, REQUIRED).max(5000),
  kk: z.string().max(5000),
});
```

- [ ] **Step 2: `SingleImageUpload`** — `admin/src/components/ui/SingleImageUpload.tsx`:

```tsx
'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/stores/toastStore';
import ConfirmButton from './ConfirmButton';
import { buttonSecondary } from './styles';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

type Props = {
  /** POST uploads (multipart `file`, replaces the current photo), DELETE removes. */
  path: string;
  imageUrl: string | null;
  label: string;
  hint?: string;
  onChange: () => unknown;
};

export default function SingleImageUpload({ path, imageUrl, label, hint, onChange }: Props) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    // Same limits as the server; checked first so a 30 MB photo fails instantly.
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Только JPEG, PNG или WebP');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Файл больше 10 МБ');
      return;
    }

    const body = new FormData();
    body.append('file', file);
    setUploading(true);

    try {
      await api.post(path, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Фото загружено');
      await onChange();
    } catch (error) {
      toast.error(serverMessage(error) ?? 'Фото не загрузилось');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-zinc-700">{label}</div>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={label} className="max-h-48 rounded-lg border border-zinc-200 object-cover" />
      ) : (
        <p className="text-sm text-zinc-500">Фото не загружено</p>
      )}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      <div className="flex items-center gap-4">
        <label className={`${buttonSecondary} cursor-pointer`}>
          {uploading ? 'Загрузка…' : imageUrl ? 'Заменить фото' : 'Загрузить фото'}
          <input
            type="file"
            accept={ACCEPTED.join(',')}
            className="sr-only"
            disabled={uploading}
            aria-label={label}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {imageUrl && (
          <ConfirmButton
            question="Удалить фото?"
            onConfirm={async () => {
              try {
                await api.delete(path);
                await onChange();
              } catch (error) {
                toast.error(serverMessage(error) ?? 'Не удалось удалить фото');
              }
            }}
          >
            Удалить фото
          </ConfirmButton>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Banner form** — `admin/src/components/banners/BannerForm.tsx`:

```tsx
'use client';

import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { optionalTranslatable } from '@/lib/validation';
import Field from '@/components/ui/Field';
import TranslatableField from '@/components/ui/TranslatableField';
import { inputClass } from '@/components/ui/styles';

/** Mirrors Banner::PLACEMENTS on the server. */
export const PLACEMENTS = {
  home_hero: 'Главная магазина',
  b2b_home: 'B2B-главная',
} as const;

export type Placement = keyof typeof PLACEMENTS;

export type Banner = {
  id: number;
  placement: Placement;
  title: { ru?: string; kk?: string };
  subtitle: { ru?: string; kk?: string };
  url: string | null;
  sort_order: number;
  is_active: boolean;
  image_url: string | null;
};

export const bannerSchema = z.object({
  placement: z.enum(['home_hero', 'b2b_home']),
  title: optionalTranslatable,
  subtitle: optionalTranslatable,
  url: z.string().max(2048),
  sort_order: z.string().regex(/^-?\d*$/, 'Целое число'),
  is_active: z.boolean(),
});

export type BannerFormValues = z.infer<typeof bannerSchema>;

export const toBannerForm = (b: Banner | null, placement: Placement = 'b2b_home'): BannerFormValues => ({
  placement: b?.placement ?? placement,
  title: { ru: b?.title?.ru ?? '', kk: b?.title?.kk ?? '' },
  subtitle: { ru: b?.subtitle?.ru ?? '', kk: b?.subtitle?.kk ?? '' },
  url: b?.url ?? '',
  sort_order: b ? String(b.sort_order) : '0',
  is_active: b?.is_active ?? true,
});

export function BannerFields({ form }: { form: UseFormReturn<BannerFormValues> }) {
  const { errors } = form.formState;

  return (
    <>
      <Field label="Место *" htmlFor="banner-placement" error={errors.placement?.message}>
        <select id="banner-placement" className={inputClass} {...form.register('placement')}>
          {Object.entries(PLACEMENTS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </Field>
      <TranslatableField form={form} name="title" label="Заголовок" />
      <TranslatableField form={form} name="subtitle" label="Подзаголовок" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Ссылка" htmlFor="banner-url" error={errors.url?.message} hint="Например /register или /catalog">
          <input id="banner-url" className={inputClass} {...form.register('url')} />
        </Field>
        <Field label="Порядок" htmlFor="banner-sort" error={errors.sort_order?.message}>
          <input id="banner-sort" type="number" className={inputClass} {...form.register('sort_order')} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input type="checkbox" {...form.register('is_active')} />
        Показывать
      </label>
    </>
  );
}
```

- [ ] **Step 4: Banners page** — `admin/src/app/banners/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useResource } from '@/lib/crud';
import { ru } from '@/lib/text';
import { BannerFields, bannerSchema, PLACEMENTS, toBannerForm, type Banner, type Placement } from '@/components/banners/BannerForm';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';
import SingleImageUpload from '@/components/ui/SingleImageUpload';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

export default function BannersPage() {
  const [placement, setPlacement] = useState<Placement | ''>('');
  const banners = useResource<Banner>('/admin/banners', placement ? { placement } : undefined);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const editing = banners.items.find((b) => b.id === editingId) ?? null;

  const columns: Column<Banner>[] = [
    {
      key: 'image',
      header: 'Фото',
      className: 'w-32',
      render: (b) =>
        b.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.image_url} alt="" className="h-12 w-24 rounded object-cover" />
        ) : (
          <span className="text-xs text-red-600">нет фото</span>
        ),
    },
    { key: 'title', header: 'Заголовок', render: (b) => ru(b.title) || '—' },
    { key: 'placement', header: 'Место', render: (b) => PLACEMENTS[b.placement] },
    { key: 'sort', header: 'Порядок', render: (b) => b.sort_order },
    { key: 'active', header: 'Статус', render: (b) => (b.is_active ? 'Показан' : 'Скрыт') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (b) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditingId(b.id)}>Изменить</button>
          <ConfirmButton onConfirm={() => banners.remove(b.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Баннеры"
        actions={<button type="button" className={buttonPrimary} onClick={() => setCreating(true)}>Добавить баннер</button>}
      />
      <div className="mb-4 max-w-xs">
        <select
          aria-label="Место"
          className={inputClass}
          value={placement}
          onChange={(e) => setPlacement(e.target.value as Placement | '')}
        >
          <option value="">Все места</option>
          {Object.entries(PLACEMENTS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <DataTable columns={columns} rows={banners.items} loading={banners.loading} emptyText="Баннеров пока нет" />

      {creating && (
        <CrudModal
          title="Новый баннер"
          schema={bannerSchema}
          defaultValues={toBannerForm(null, placement || 'b2b_home')}
          onSubmit={async (values) => {
            const banner = await banners.create(values);
            // The photo needs an id: continue in the edit dialog.
            setEditingId(banner.id);
          }}
          onClose={() => setCreating(false)}
        >
          {(form) => <BannerFields form={form} />}
        </CrudModal>
      )}

      {editing && (
        <CrudModal
          title="Изменить баннер"
          schema={bannerSchema}
          defaultValues={toBannerForm(editing)}
          onSubmit={(values) => banners.update(editing.id, values)}
          onClose={() => setEditingId(null)}
        >
          {(form) => (
            <>
              <SingleImageUpload
                path={`/admin/banners/${editing.id}/image`}
                imageUrl={editing.image_url}
                label="Фото баннера"
                hint="Горизонтальное интерьерное фото, от 1920×800"
                onChange={banners.reload}
              />
              <BannerFields form={form} />
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
```

`CrudModal` после успешного `onSubmit` вызывает `onClose()`. У создания это `setCreating(false)`, а `setEditingId(banner.id)` уже выставлен — откроется диалог редактирования с загрузкой фото. Если `Column` не поддерживает `className` — посмотреть `DataTable.tsx` и убрать поле.

- [ ] **Step 5: Collection form** — в `admin/src/components/collections/CollectionForm.tsx`:
  - импорт `optionalTranslatableText` из `@/lib/validation`;
  - тип `Collection` дополнить: `description?: { ru?: string; kk?: string } | null; show_on_storefront: boolean; show_on_b2b_home: boolean; cover_url?: string | null;`;
  - схема: `description: optionalTranslatableText, show_on_storefront: z.boolean(), show_on_b2b_home: z.boolean(),`;
  - `toCollectionForm`: `description: { ru: c?.description?.ru ?? '', kk: c?.description?.kk ?? '' }, show_on_storefront: c?.show_on_storefront ?? true, show_on_b2b_home: c?.show_on_b2b_home ?? false,`;
  - в `CollectionFields` после строки Slug/Порядок: `<TranslatableField form={form} name="description" label="Описание (для B2B-главной)" multiline />`; чекбокс «Показывать на витрине» → переименовать в «Активна» (он управляет `is_active`), добавить два чекбокса:

```tsx
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input type="checkbox" {...form.register('show_on_storefront')} />
        На главной магазина
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input type="checkbox" {...form.register('show_on_b2b_home')} />
        На B2B-главной (стиль с обложкой)
      </label>
```

- [ ] **Step 6: Cover on the collection page** — в `admin/src/app/product-collections/[id]/page.tsx` импорт `SingleImageUpload` и перед `<EntityPicker …>`:

```tsx
      <SingleImageUpload
        path={`${base}/cover`}
        imageUrl={collection.cover_url ?? null}
        label="Обложка (интерьер)"
        hint="Показывается на B2B-главной, если включено «На B2B-главной». От 1920×1080"
        onChange={load}
      />
```

- [ ] **Step 7: B2B home page** — `admin/src/app/b2b-home/page.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import api from '@/lib/api';
import { translatable, translatableText } from '@/lib/validation';
import CrudModal from '@/components/ui/CrudModal';
import PageHeader from '@/components/ui/PageHeader';
import SingleImageUpload from '@/components/ui/SingleImageUpload';
import TranslatableField from '@/components/ui/TranslatableField';
import { buttonSecondary, cardClass } from '@/components/ui/styles';

type Content = {
  about_title: { ru?: string; kk?: string };
  about_text: { ru?: string; kk?: string };
  image_url: string | null;
};

const schema = z.object({ about_title: translatable, about_text: translatableText });

export default function B2bHomePage() {
  const [content, setContent] = useState<Content | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<{ data: Content }>('/admin/b2b-home');
    setContent(res.data.data);
  }, []);

  useEffect(() => {
    // Fetch-on-mount: load() synchronizes with the API, an external system.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (!content) {
    return <div className="text-zinc-500">Загрузка…</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="B2B-главная"
        actions={<button type="button" className={buttonSecondary} onClick={() => setEditing(true)}>Изменить текст</button>}
      />
      <p className="text-sm text-zinc-500">
        Блок «Кто мы» на b2b.paradise.kz. Баннеры — в разделе «Баннеры» (место «B2B-главная»),
        стили — это подборки с флажком «На B2B-главной».
      </p>
      <section className={`${cardClass} space-y-4 p-6`}>
        <h2 className="text-lg font-semibold text-zinc-900">{content.about_title.ru || 'Заголовок не задан'}</h2>
        <p className="whitespace-pre-line text-sm text-zinc-700">{content.about_text.ru || 'Текст не задан'}</p>
        <SingleImageUpload
          path="/admin/b2b-home/image"
          imageUrl={content.image_url}
          label="Фото шоурума"
          hint="От 1600×1200"
          onChange={load}
        />
      </section>

      {editing && (
        <CrudModal
          title="Блок «Кто мы»"
          schema={schema}
          defaultValues={{
            about_title: { ru: content.about_title.ru ?? '', kk: content.about_title.kk ?? '' },
            about_text: { ru: content.about_text.ru ?? '', kk: content.about_text.kk ?? '' },
          }}
          onSubmit={async (values) => {
            await api.put('/admin/b2b-home', values);
            await load();
          }}
          onClose={() => setEditing(false)}
        >
          {(form) => (
            <>
              <TranslatableField form={form} name="about_title" label="Заголовок" required />
              <TranslatableField form={form} name="about_text" label="Текст" required multiline />
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
```

Если `cardClass` не экспортируется из `styles.ts` под этим именем — он экспортируется (проверено: `export const cardClass`).

- [ ] **Step 8: Sidebar** — в `admin/src/components/Sidebar.tsx` добавить группу после «Каталог»:

```ts
  {
    title: 'Контент',
    links: [
      { href: '/banners', label: 'Баннеры' },
      { href: '/b2b-home', label: 'B2B-главная' },
    ],
  },
```

- [ ] **Step 9: Type-check and build**

Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: без ошибок. Если в `tests/Feature/Admin/AdminPagesRenderTest.php` есть список страниц SPA — добавить туда `/banners` и `/b2b-home` и прогнать: `php artisan test --compact tests/Feature/Admin/AdminPagesRenderTest.php`.

- [ ] **Step 10: Verify in the browser** (`admin` на :3002, вход менеджером)
1. «Баннеры» → «Добавить баннер» → место «B2B-главная», заголовок → сохранить → открывается редактирование → загрузить фото → миниатюра в таблице.
2. Фильтр «B2B-главная» оставляет только этот баннер.
3. «Подборки» → подборка → обложка загружается; «Изменить» → описание, флажок «На B2B-главной» → сохранить.
4. «B2B-главная» → «Изменить текст» → сохранить; загрузить фото шоурума.
5. `curl -s localhost:8000/api/b2b/home | jq '.data | {banners: (.banners|length), about: .about.title, collections: [.collections[].title]}'` — всё, что заведено, на месте.

- [ ] **Step 11: Commit**

```bash
git add admin/src
git commit -m "feat(admin): banners, collection covers and surfaces, B2B home content"
```

---

### Task 12: b2b-portal — главная `/`

**Files:**
- Rewrite: `b2b-portal/src/app/page.tsx`
- Create: `b2b-portal/src/components/welcome/useSignedIn.ts`, `WelcomeHeader.tsx`, `WelcomeHero.tsx`, `StyleSection.tsx`
- Modify: `b2b-portal/src/lib/types.ts`, `b2b-portal/src/messages/{ru,kk}.json`

**Interfaces:**
- Consumes: `GET /api/b2b/home` (Task 8), `GET /api/public/settings` (`data.contacts`), тип `Banner` из `src/lib/types.ts`, `tValue` из `src/lib/format.ts`.
- Produces: `useSignedIn(): boolean`; `PartnerLink({ className })` — «Стать партнёром» → `/register` для гостя, «Перейти в каталог» → `/catalog` для вошедшего.

Уточнение к спеку: если баннеров нет, hero всё равно выводится — на фоне `panel` с заголовком из `messages` (иначе страница начиналась бы без заголовка). Спек обновляется в том же коммите.

- [ ] **Step 1: Types** — в `src/lib/types.ts`:

```ts
export interface B2bHomeCollection {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  cover: string | null;
  cover_card: string | null;
  /** Public catalog only, without price/stock keys. */
  products: Product[];
}

export interface B2bHome {
  banners: Banner[];
  about: { title: string | null; text: string | null; image: string | null } | null;
  collections: B2bHomeCollection[];
}
```

- [ ] **Step 2: Translations** — в `ru.json`:

```json
  "welcome": {
    "metaTitle": "Оптовый портал мебели Paradise",
    "metaDescription": "Мебель для магазинов оптом: склад и шоурум в Алматы, доставка по Казахстану, персональный менеджер.",
    "eyebrow": "Оптовый портал Paradise",
    "heroTitle": "Мебель для вашего магазина — напрямую со склада",
    "heroSubtitle": "Оптовые цены, шоурум и склад в Алматы, доставка по всему Казахстану.",
    "becomePartner": "Стать партнёром",
    "login": "Войти",
    "toCatalog": "Перейти в каталог",
    "slide": "Слайд {n}",
    "aboutEyebrow": "Кто мы",
    "stylesEyebrow": "Стили и интерьеры",
    "stylesTitle": "Как наша мебель смотрится в интерьере",
    "styleEyebrow": "Стиль",
    "seePrices": "Узнать оптовые цены",
    "termsTitle": "Условия сотрудничества",
    "terms": {
      "prices": { "title": "Оптовые цены", "text": "Персональные цены и скидки для партнёров — открываются сразу после одобрения заявки." },
      "warehouse": { "title": "Склад в Алматы", "text": "Товар на собственном складе, актуальные остатки видны в портале." },
      "delivery": { "title": "Доставка по Казахстану", "text": "Отгружаем в любой город и помогаем с логистикой." },
      "manager": { "title": "Персональный менеджер", "text": "Один контакт для заказов, счетов и вопросов по ассортименту." }
    },
    "ctaTitle": "Станьте партнёром Paradise",
    "ctaText": "Регистрация занимает минуту: имя, номер телефона и код из SMS.",
    "contactsTitle": "Контакты",
    "phone": "Телефон",
    "whatsapp": "WhatsApp",
    "address": "Адрес",
    "rights": "© {year} Paradise. Оптовый портал."
  }
```

в `kk.json`:

```json
  "welcome": {
    "metaTitle": "Paradise жиһаз көтерме порталы",
    "metaDescription": "Дүкендерге арналған көтерме жиһаз: Алматыдағы қойма мен шоурум, Қазақстан бойынша жеткізу, жеке менеджер.",
    "eyebrow": "Paradise көтерме порталы",
    "heroTitle": "Дүкеніңізге жиһаз — тікелей қоймадан",
    "heroSubtitle": "Көтерме бағалар, Алматыдағы шоурум мен қойма, бүкіл Қазақстан бойынша жеткізу.",
    "becomePartner": "Серіктес болу",
    "login": "Кіру",
    "toCatalog": "Каталогқа өту",
    "slide": "{n}-слайд",
    "aboutEyebrow": "Біз кімбіз",
    "stylesEyebrow": "Стильдер мен интерьерлер",
    "stylesTitle": "Жиһазымыз интерьерде қалай көрінеді",
    "styleEyebrow": "Стиль",
    "seePrices": "Көтерме бағаларды білу",
    "termsTitle": "Ынтымақтастық шарттары",
    "terms": {
      "prices": { "title": "Көтерме бағалар", "text": "Серіктестерге жеке бағалар мен жеңілдіктер — өтінім мақұлданған соң ашылады." },
      "warehouse": { "title": "Алматыдағы қойма", "text": "Тауар өз қоймамызда, нақты қалдықтар порталда көрінеді." },
      "delivery": { "title": "Қазақстан бойынша жеткізу", "text": "Кез келген қалаға жөнелтеміз және логистикаға көмектесеміз." },
      "manager": { "title": "Жеке менеджер", "text": "Тапсырыстар, шоттар және ассортимент бойынша бір байланыс." }
    },
    "ctaTitle": "Paradise серіктесі болыңыз",
    "ctaText": "Тіркелу бір минут алады: аты, телефон нөмірі және SMS коды.",
    "contactsTitle": "Байланыс",
    "phone": "Телефон",
    "whatsapp": "WhatsApp",
    "address": "Мекенжай",
    "rights": "© {year} Paradise. Көтерме портал."
  }
```

- [ ] **Step 3: Auth-aware pieces** — `src/components/welcome/useSignedIn.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { useB2bAuth } from "@/stores/useB2bAuth";

/**
 * Signed-in state after hydration. The token lives in localStorage, so the
 * server render (and the first client render) always show the guest view.
 */
export function useSignedIn(): boolean {
  const token = useB2bAuth((state) => state.token);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  return isMounted && token !== null;
}
```

`src/components/welcome/WelcomeHeader.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSignedIn } from "./useSignedIn";

/** Guest: "Стать партнёром" → /register. Signed in: "Перейти в каталог". */
export function PartnerLink({ className }: { className: string }) {
  const t = useTranslations("welcome");
  const signedIn = useSignedIn();

  return signedIn ? (
    <Link href="/catalog" className={className}>{t("toCatalog")}</Link>
  ) : (
    <Link href="/register" className={className}>{t("becomePartner")}</Link>
  );
}

export function WelcomeHeader() {
  const t = useTranslations("welcome");
  const signedIn = useSignedIn();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
        <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-ink">
          Paradise B2B
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          {!signedIn && (
            <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface">
              {t("login")}
            </Link>
          )}
          <PartnerLink className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-ink-hover" />
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Hero** — `src/components/welcome/WelcomeHero.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Banner } from "@/lib/types";
import { PartnerLink } from "./WelcomeHeader";

const AUTOPLAY_MS = 6000;

/**
 * Full-width interior photo(s) with the headline and the partner button.
 * Without banners it still renders — on the panel colour with default copy.
 */
export function WelcomeHero({ banners }: { banners: Banner[] }) {
  const t = useTranslations("welcome");
  const [active, setActive] = useState(0);
  const count = banners.length;

  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => setActive((current) => (current + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [count]);

  const banner = banners[active] ?? null;
  const onPhoto = Boolean(banner?.image);

  return (
    <section className="relative isolate overflow-hidden bg-panel">
      {banners.map((item, index) =>
        item.image ? (
          <Image
            key={item.id}
            src={item.image}
            alt=""
            fill
            priority={index === 0}
            sizes="100vw"
            className={`-z-10 object-cover transition-opacity duration-700 ${index === active ? "opacity-100" : "opacity-0"}`}
          />
        ) : null,
      )}
      {onPhoto && <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/65 via-black/35 to-transparent" />}

      <div className="mx-auto flex min-h-[520px] max-w-[1400px] flex-col justify-center px-4 py-20 sm:px-6 lg:min-h-[640px] lg:px-10">
        <div className={`max-w-xl ${onPhoto ? "text-white" : "text-ink"}`}>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] opacity-80">{t("eyebrow")}</p>
          <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            {banner?.title || t("heroTitle")}
          </h1>
          <p className="mt-5 text-lg opacity-90">{banner?.subtitle || t("heroSubtitle")}</p>
          <PartnerLink className="mt-8 inline-flex rounded-full bg-mint px-8 py-4 font-semibold text-mint-ink transition hover:opacity-90" />
        </div>

        {count > 1 && (
          <div className="mt-10 flex gap-2">
            {banners.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={t("slide", { n: index + 1 })}
                aria-current={index === active}
                onClick={() => setActive(index)}
                className={`h-1.5 rounded-full transition-all ${index === active ? "w-10 bg-white" : "w-5 bg-white/50"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
```

`banner.url` на главной не используется: кнопка всегда ведёт в регистрацию/каталог (спек, этап 3, п. 2).

- [ ] **Step 5: Style section** — `src/components/welcome/StyleSection.tsx`:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { tValue } from "@/lib/format";
import type { B2bHomeCollection } from "@/lib/types";
import { useSignedIn } from "./useSignedIn";

/** One "style": interior cover + description, then its products without prices. */
export function StyleSection({ collection, reversed }: { collection: B2bHomeCollection; reversed: boolean }) {
  const t = useTranslations("welcome");
  const locale = useLocale();
  const signedIn = useSignedIn();

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 lg:px-10">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className={`relative aspect-[4/3] overflow-hidden rounded-3xl bg-card ${reversed ? "lg:order-2" : ""}`}>
          {collection.cover ? (
            <Image src={collection.cover} alt={collection.title} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          ) : null}
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">{t("styleEyebrow")}</p>
          <h3 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">{collection.title}</h3>
          {collection.description ? (
            <p className="mt-4 text-lg leading-relaxed text-muted">{collection.description}</p>
          ) : null}
          <Link
            href={signedIn ? "/catalog" : "/register"}
            className="mt-6 inline-flex text-sm font-semibold text-ink underline-offset-4 hover:underline"
          >
            {signedIn ? t("toCatalog") : t("seePrices")} →
          </Link>
        </div>
      </div>

      {collection.products.length > 0 && (
        <ul className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {collection.products.map((product) => (
            <li key={product.id}>
              <Link href={signedIn ? `/product/${product.id}` : "/register"} className="group block">
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-card">
                  {product.image ? (
                    <Image
                      src={product.images[0]?.medium ?? product.image}
                      alt={tValue(product.name, locale)}
                      fill
                      sizes="(min-width: 640px) 25vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-ink">{tValue(product.name, locale)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 6: The page** — `src/app/page.tsx` целиком:

```tsx
import Image from "next/image";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { apiGet } from "@/lib/api";
import type { B2bHome, Settings } from "@/lib/types";
import { PartnerLink, WelcomeHeader } from "@/components/welcome/WelcomeHeader";
import { WelcomeHero } from "@/components/welcome/WelcomeHero";
import { StyleSection } from "@/components/welcome/StyleSection";

const TERMS = ["prices", "warehouse", "delivery", "manager"] as const;

const EMPTY_HOME: B2bHome = { banners: [], about: null, collections: [] };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("welcome");

  return { title: { absolute: t("metaTitle") }, description: t("metaDescription") };
}

/** The page must render even when the API is down — it is the portal's front door. */
async function loadHome(locale: string): Promise<B2bHome> {
  try {
    return (await apiGet<{ data: B2bHome }>("/b2b/home", { locale, revalidate: 300 })).data;
  } catch {
    return EMPTY_HOME;
  }
}

async function loadContacts(locale: string): Promise<Settings["contacts"] | null> {
  try {
    return (await apiGet<{ data: Settings }>("/public/settings", { locale, revalidate: 300 })).data.contacts;
  } catch {
    return null;
  }
}

export default async function WelcomePage() {
  const locale = await getLocale();
  const t = await getTranslations("welcome");
  const [home, contacts] = await Promise.all([loadHome(locale), loadContacts(locale)]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <WelcomeHeader />

      <main className="flex-1">
        <WelcomeHero banners={home.banners} />

        {home.about ? (
          <section className="mx-auto grid max-w-[1400px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">{t("aboutEyebrow")}</p>
              {home.about.title ? (
                <h2 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">{home.about.title}</h2>
              ) : null}
              {home.about.text ? (
                <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-muted">{home.about.text}</p>
              ) : null}
            </div>
            {home.about.image ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-card">
                <Image src={home.about.image} alt={home.about.title ?? ""} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
              </div>
            ) : null}
          </section>
        ) : null}

        {home.collections.length > 0 ? (
          <div className="border-t border-line py-10">
            <div className="mx-auto max-w-[1400px] px-4 pt-10 sm:px-6 lg:px-10">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">{t("stylesEyebrow")}</p>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold text-ink sm:text-4xl">{t("stylesTitle")}</h2>
            </div>
            {home.collections.map((collection, index) => (
              <StyleSection key={collection.id} collection={collection} reversed={index % 2 === 1} />
            ))}
          </div>
        ) : null}

        <section className="bg-panel">
          <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10">
            <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">{t("termsTitle")}</h2>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {TERMS.map((key) => (
                <li key={key} className="rounded-2xl bg-white p-6">
                  <h3 className="text-lg font-semibold text-ink">{t(`terms.${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{t(`terms.${key}.text`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-[1400px] px-4 py-20 text-center sm:px-6 lg:px-10">
          <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">{t("ctaTitle")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">{t("ctaText")}</p>
          <PartnerLink className="mt-8 inline-flex rounded-full bg-ink px-8 py-4 font-semibold text-white transition hover:bg-ink-hover" />
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-10">
          <div className="font-display text-xl font-semibold text-ink">Paradise B2B</div>
          {contacts?.phone ? (
            <div>
              <div className="font-medium text-ink">{t("phone")}</div>
              <a href={`tel:${contacts.phone.replace(/[^\d+]/g, "")}`} className="hover:text-ink">{contacts.phone}</a>
            </div>
          ) : null}
          {contacts?.whatsapp_url ? (
            <div>
              <div className="font-medium text-ink">{t("whatsapp")}</div>
              <a href={contacts.whatsapp_url} target="_blank" rel="noopener noreferrer" className="hover:text-ink">wa.me</a>
            </div>
          ) : null}
          {contacts?.address ? (
            <div>
              <div className="font-medium text-ink">{t("address")}</div>
              <p>{contacts.address}</p>
            </div>
          ) : null}
        </div>
        <div className="border-t border-line py-6 text-center text-xs text-muted">
          {t("rights", { year: new Date().getFullYear() })}
        </div>
      </footer>
    </div>
  );
}
```

Если `apiGet` на сервере не может достучаться до API на этапе `npm run build` (нет `API_URL_INTERNAL`), страница соберётся с `EMPTY_HOME` и обновится через ISR — это нормально, `try/catch` как раз для этого.

- [ ] **Step 7: Update the spec** — в `docs/superpowers/specs/2026-09-18-b2b-sms-auth-and-preview-design.md`, этап 3, п. 2 заменить «Если баннеров нет — блок не выводится.» на «Если баннеров нет — hero выводится на фоне `panel` с заголовком из `messages`.»

- [ ] **Step 8: Type-check and build**

Run: `cd b2b-portal && npx tsc --noEmit && npm run build`
Expected: без ошибок; в выводе сборки `/` — статическая/ISR-страница (`○` или `●` с revalidate 300), не `ƒ`.

- [ ] **Step 9: Verify in the browser** (контент заведён в Task 11)
1. Гость (чистый localStorage): `http://localhost:3001/` — hero с фото и «Стать партнёром», «Кто мы», стили с обложками и товарами без цен, условия, CTA, контакты. Клик по товару → `/register`.
2. Войти → вернуться на `/` → в шапке и hero «Перейти в каталог», клик по товару → `/product/{id}`.
3. `resize_window` mobile (375) — нет горизонтального скролла, секции в одну колонку.
4. `read_network_requests` / исходник страницы — в данных `/b2b/home` нет `price`.
5. Без баннеров (временно выключить в админке) — hero на фоне panel с текстом по умолчанию.

Скриншоты десктопа и мобильного — пользователю.

- [ ] **Step 10: Commit**

```bash
git add b2b-portal/src docs/superpowers/specs/2026-09-18-b2b-sms-auth-and-preview-design.md
git commit -m "feat(b2b-portal): public welcome page with styles, about and partner terms"
```

---

### Task 13: Сквозная проверка и документация

**Files:**
- Modify: `CLAUDE.md` (таблица API, раздел «Two admin panels»)

- [ ] **Step 1: Update `CLAUDE.md`**
  - таблица «API layout»: строку `/api/auth/*` → `| /api/auth/* | login, otp/request, otp/register, otp/login public, the rest auth:sanctum | b2b-portal, admin SPA |`; строку каталога разбить на `| /api/{categories,products} | auth:sanctum + b2b (unapproved: no prices/stock) | b2b-portal |` и `| /api/{cart/validate,orders,addresses} | auth:sanctum + approved + b2b | b2b-portal |`; добавить `| /api/b2b/home | none | b2b-portal home page |`;
  - в описании `admin/` добавить «banners, B2B home content, collection covers»; в описании Filament убрать «banners» из списка «Still the only place for …».
  - в «Other domain services» к `OtpService` добавить: «`B2bPhoneAuthService` — B2B portal registration/login by SMS code; never changes an existing account's type».

- [ ] **Step 2: Full backend suite**

Run: `php artisan test --compact` (если не хватает памяти — `php -d memory_limit=3G vendor/bin/phpunit`)
Expected: всё зелёное. Красные тесты чинить в исходной задаче, не глушить.

- [ ] **Step 3: Front-ends**

Run: `cd b2b-portal && npx tsc --noEmit && npm run build`, затем `cd admin && npx tsc --noEmit && npm run build`
Expected: без ошибок.

- [ ] **Step 4: Playwright портала** (если стек e2e поднимается по памяти «E2E browser tests»: `php artisan mvp:acceptance --fresh --fixtures --no-interaction`, затем `cd b2b-portal && npx playwright test`)
Expected: `auth.setup.ts`, `login.spec.ts`, `catalog.spec.ts`, `checkout.spec.ts` зелёные — вкладка «Пароль» по умолчанию сохранила селекторы, одобренный клиент прогона видит цены.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: B2B SMS auth, unapproved catalog and home content in the project map"
```

---

## Self-review (выполнено при написании)

- Покрытие спека: этап 1 → Tasks 1–4; этап 2 → Tasks 5–6; этап 3 → Tasks 7–12; витрина отказывает B2B → Task 1; удаление старого register → Task 3; `show_on_storefront` → Task 7; ru/kk → Tasks 4, 6, 12. Сверх спека, найдено в коде: нормализация старых номеров B2B (Task 3, иначе SMS-вход не находит клиентов, заведённых старой формой), обновление `mvp:acceptance` (Tasks 3, 5), отказ сотрудникам по роли (у них `type=b2b` по умолчанию колонки).
- Сортировка по цене: в B2B `ProductController` цены нет в `allowedSorts` — спек выполняется без изменений, отдельного кода не нужно.
- Имена сквозь задачи: `hide_commercial`, `OtpService::consume()`, `normalizedPhoneOrFail()`, `B2bPhoneAuthService::INTENT_*`, `Banner::PLACEMENT_B2B_HOME` / `PLACEMENTS`, `ProductCollection::COVER_COLLECTION`, `B2bHomeContent::ABOUT_IMAGE_COLLECTION`, `StoresSingleImage::replaceImage()/removeImage()`, `useIsApproved()`, `useSignedIn()`, `PartnerLink` — совпадают во всех задачах.
