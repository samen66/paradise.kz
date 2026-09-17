# Перенос каталога из Filament в `admin/` — план реализации (этап 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** менеджер делает всё каталожное (товар целиком, атрибуты, типы цен, группы каталога, подборки) в Next.js-админке `admin/`, не заходя в Filament.

**Architecture:** REST-контроллер на ресурс в `app/Http/Controllers/Api/Admin` + `FormRequest` в `app/Http/Requests/Admin`, вложенные scoped-маршруты для связей товара, отдельные медиа-эндпоинты. В `admin/` — общие UI-компоненты (`src/components/ui`) на Tailwind + react-hook-form + zod, хук `useResource`, интерсептор ошибок axios; экраны собираются из них.

**Tech Stack:** Laravel 13, PHPUnit 12, Spatie Permission / Media Library / Query Builder / Translatable; Next.js 16, React 19, TypeScript, Tailwind 4, zustand, axios, react-hook-form, zod, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-admin-catalog-migration-design.md`

## Global Constraints

- Ветка `feat/admin-catalog` от `main`. Коммиты **без** `Co-Authored-By` и без «Generated with Claude Code».
- Все новые маршруты — внутри существующей группы `Route::prefix('admin')->middleware(['auth:sanctum', 'role:admin|manager'])` в `routes/api.php`.
- Деньги: клиент шлёт ₸ (до 2 знаков), БД хранит тиын (`int`), перевод — ровно один раз в `validated()` запроса.
- Остаток (`stock`) нигде не принимается; ERP-поля (`source`, `external_id`, `external_folder_id`, `synced_at`) не принимаются и не показываются. У вариантов `source`/`external_id` NOT NULL — контроллер ставит `source = 'local'`, `external_id = (string) Str::uuid()`.
- `name` у `Attribute`, `PriceType`, `CatalogGroup` — **обычная строка** (не ru/kk). `title` у `ProductCollection` — переводимый (`{ru, kk}`).
- Ответы: одна запись — `{data: …}`; справочники (атрибуты, типы цен, группы, подборки, связи товара) — `{data: [...]}` без пагинации; удаление — 204; бизнес-запрет — 422 `{message}`.
- PHP-файлы: `declare(strict_types=1);`, типы возврата, фигурные скобки всегда; после правок — `vendor/bin/pint --dirty --format agent`.
- Прогон PHP-тестов (далее `$TEST`), `.env` не трогать:
  `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact`
  Если правка маршрутов «не видна» — `php artisan route:clear`.
- Проверка `admin/`: `cd admin && npx tsc --noEmit && npm run build`.
- UI-тексты — по-русски; стиль — zinc/blue как в существующих страницах.

## Файловая карта

**Backend — создать**
- `tests/Feature/Admin/Concerns/ActsAsStaff.php` — трейт: сидер ролей, `actingAsManager()`, `assertStaffOnly()`.
- `app/Http/Requests/Admin/Concerns/ConvertsTengeToTiyn.php` — трейт перевода ₸→тиын.
- `app/Http/Controllers/Api/Admin/AttributeController.php` + `Requests/Admin/AttributeRequest.php` + `tests/Feature/Admin/AttributeApiTest.php`
- `…/PriceTypeController.php` + `PriceTypeRequest.php` + `PriceTypeApiTest.php`
- `…/CatalogGroupController.php`, `CatalogGroupMemberController.php` + `CatalogGroupRequest.php` + `CatalogGroupApiTest.php`
- `…/ProductCollectionController.php`, `ProductCollectionProductController.php` + `ProductCollectionRequest.php` + `ProductCollectionApiTest.php`
- `…/ProductPriceController.php` + `ProductPriceRequest.php` + `ProductPriceApiTest.php`
- `…/ClientProductPriceController.php` + `ClientProductPriceRequest.php` + `ClientProductPriceApiTest.php`
- `…/AttributeValueController.php` + `AttributeValueRequest.php` + `AttributeValueApiTest.php`
- `…/ProductVariantController.php` + `ProductVariantRequest.php` + `ProductVariantApiTest.php`
- `…/ProductMediaController.php` + `ProductMediaApiTest.php`

**Backend — изменить**
- `routes/api.php` — маршруты.
- `app/Http/Controllers/Api/Admin/ProductController.php` — без `images`, `destroy` → 422 при движениях, `show` отдаёт `images`.
- `app/Http/Requests/Admin/ProductSaveRequest.php` — убрать `images`.
- `tests/Feature/Admin/ProductCrudTest.php` — multipart-тест без картинок, новые тесты `destroy`/`show`.

**Frontend — создать** (`admin/src/…`)
- `stores/toastStore.ts`, `components/ui/Toaster.tsx`
- `lib/money.ts`, `lib/errors.ts`, `lib/crud.ts`, `lib/validation.ts`, `lib/text.ts`, `lib/catalogTypes.ts`
- `components/ui/styles.ts`, `Field.tsx`, `TranslatableField.tsx`, `MoneyInput.tsx`, `Modal.tsx`, `CrudModal.tsx`, `DataTable.tsx`, `ConfirmButton.tsx`, `Tabs.tsx`, `EntityPicker.tsx`, `PageHeader.tsx`
- `app/attributes/page.tsx`, `app/price-types/page.tsx`
- `app/catalog-groups/page.tsx`, `app/catalog-groups/[id]/page.tsx`
- `app/product-collections/page.tsx`, `app/product-collections/[id]/page.tsx`, `components/collections/CollectionForm.tsx`
- `components/products/ProductRelations.tsx`, `MediaTab.tsx`, `PricesTab.tsx`, `ClientPricesTab.tsx`, `AttributeValuesTab.tsx`, `VariantsTab.tsx`
- `e2e/attributes.spec.ts`, `e2e/catalog-groups.spec.ts`, `e2e/product-relations.spec.ts`, `e2e/assets/pixel.png`

**Frontend — изменить / удалить**
- `lib/api.ts` (интерсептор), `app/layout.tsx` (Toaster), `components/Sidebar.tsx` (группы)
- `app/brands/page.tsx`, `app/categories/page.tsx` — на общих компонентах; удалить `components/BrandModal.tsx`, `components/CategoryModal.tsx`
- `app/products/[id]/page.tsx` — без загрузки картинок, `money.ts`, вкладки
- `package.json` — `react-hook-form`, `zod`, `@hookform/resolvers`

---

### Task 1: Тестовый трейт и API атрибутов

**Files:**
- Create: `tests/Feature/Admin/Concerns/ActsAsStaff.php`
- Create: `app/Http/Requests/Admin/AttributeRequest.php`
- Create: `app/Http/Controllers/Api/Admin/AttributeController.php`
- Modify: `routes/api.php` (группа `admin`)
- Test: `tests/Feature/Admin/AttributeApiTest.php`

**Interfaces:**
- Produces: трейт `Tests\Feature\Admin\Concerns\ActsAsStaff` с `setUpStaff(): void` (сидит роли), `actingAsManager(): User`, `assertStaffOnly(string $method, string $uri, array $payload = []): void` (гость → 401, b2b-клиент → 403). Эндпоинты `GET/POST /api/admin/attributes`, `GET/PUT/DELETE /api/admin/attributes/{attribute}`.

- [ ] **Step 1: Ветка**

```bash
git switch -c feat/admin-catalog
```

- [ ] **Step 2: Трейт для тестов**

`tests/Feature/Admin/Concerns/ActsAsStaff.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin\Concerns;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Laravel\Sanctum\Sanctum;

/**
 * Shared setup for the /api/admin/* tests: roles seeded, a manager signed in,
 * and one assertion for the access rule every admin endpoint shares.
 */
trait ActsAsStaff
{
    protected function setUpStaff(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    protected function actingAsManager(): User
    {
        $manager = User::factory()->create();
        $manager->assignRole('manager');
        Sanctum::actingAs($manager);

        return $manager;
    }

    /**
     * A guest gets 401 and a B2B client 403 — only admin|manager pass.
     *
     * @param  array<string, mixed>  $payload
     */
    protected function assertStaffOnly(string $method, string $uri, array $payload = []): void
    {
        $this->app['auth']->forgetGuards();
        $this->json($method, $uri, $payload)->assertUnauthorized();

        Sanctum::actingAs(User::factory()->b2b()->approved()->create());
        $this->json($method, $uri, $payload)->assertForbidden();
    }
}
```

- [ ] **Step 3: Падающий тест**

`tests/Feature/Admin/AttributeApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Attribute;
use App\Models\AttributeValue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class AttributeApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_attributes(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/attributes');
    }

    #[Test]
    public function it_lists_attributes_by_name(): void
    {
        $this->actingAsManager();
        Attribute::factory()->create(['name' => 'Цвет']);
        Attribute::factory()->create(['name' => 'Материал']);

        $this->getJson('/api/admin/attributes')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Материал')
            ->assertJsonPath('data.1.name', 'Цвет');
    }

    #[Test]
    public function it_creates_updates_and_deletes_an_attribute(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/attributes', [
            'name' => 'Цвет',
            'slug' => 'color',
            'is_filterable' => true,
        ])->assertCreated()->json('data.id');

        $this->putJson("/api/admin/attributes/{$id}", [
            'name' => 'Цвет обивки',
            'slug' => 'color',
            'is_filterable' => false,
        ])->assertOk()->assertJsonPath('data.name', 'Цвет обивки');

        $this->assertDatabaseHas('attributes', ['id' => $id, 'slug' => 'color', 'is_filterable' => false]);

        $this->deleteJson("/api/admin/attributes/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('attributes', ['id' => $id]);
    }

    #[Test]
    public function the_slug_must_be_unique_and_well_formed(): void
    {
        $this->actingAsManager();
        Attribute::factory()->create(['slug' => 'color']);

        $this->postJson('/api/admin/attributes', ['name' => 'Цвет', 'slug' => 'color'])
            ->assertUnprocessable()->assertJsonValidationErrors('slug');

        $this->postJson('/api/admin/attributes', ['name' => 'Цвет', 'slug' => 'Цвет!'])
            ->assertUnprocessable()->assertJsonValidationErrors('slug');
    }

    #[Test]
    public function an_attribute_keeps_its_own_slug_on_update(): void
    {
        $this->actingAsManager();
        $attribute = Attribute::factory()->create(['slug' => 'color']);

        $this->putJson("/api/admin/attributes/{$attribute->id}", ['name' => 'Цвет', 'slug' => 'color'])
            ->assertOk();
    }

    #[Test]
    public function an_attribute_in_use_cannot_be_deleted(): void
    {
        $this->actingAsManager();
        $value = AttributeValue::factory()->create();

        $this->deleteJson("/api/admin/attributes/{$value->attribute_id}")
            ->assertUnprocessable()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseHas('attributes', ['id' => $value->attribute_id]);
    }
}
```

- [ ] **Step 4: Убедиться, что падает**

Run: `$TEST tests/Feature/Admin/AttributeApiTest.php`
Expected: FAIL — 404 на `/api/admin/attributes`.

- [ ] **Step 5: Запрос**

`app/Http/Requests/Admin/AttributeRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AttributeRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'slug' => [
                'required', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('attributes', 'slug')->ignore($this->route('attribute')),
            ],
            'is_filterable' => ['boolean'],
        ];
    }
}
```

- [ ] **Step 6: Контроллер**

`app/Http/Controllers/Api/Admin/AttributeController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AttributeRequest;
use App\Models\Attribute;
use Illuminate\Http\JsonResponse;

class AttributeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => Attribute::orderBy('name')->get()]);
    }

    public function store(AttributeRequest $request): JsonResponse
    {
        return response()->json(['data' => Attribute::create($request->validated())], 201);
    }

    public function show(Attribute $attribute): JsonResponse
    {
        return response()->json(['data' => $attribute]);
    }

    public function update(AttributeRequest $request, Attribute $attribute): JsonResponse
    {
        $attribute->update($request->validated());

        return response()->json(['data' => $attribute]);
    }

    /**
     * Deleting would cascade away every product's value for it — a manager
     * clears the values first, on purpose.
     */
    public function destroy(Attribute $attribute): JsonResponse
    {
        if ($attribute->values()->exists()) {
            return response()->json(['message' => 'Атрибут используется в товарах — сначала удалите его значения.'], 422);
        }

        $attribute->delete();

        return response()->json(null, 204);
    }
}
```

- [ ] **Step 7: Маршрут**

В `routes/api.php` добавить `use App\Http\Controllers\Api\Admin\AttributeController;` к импортам и внутрь группы `admin` после `brands`:

```php
        Route::apiResource('attributes', AttributeController::class);
```

- [ ] **Step 8: Тесты зелёные**

Run: `php artisan route:clear && $TEST tests/Feature/Admin/AttributeApiTest.php`
Expected: PASS (6 tests).

- [ ] **Step 9: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add tests/Feature/Admin/Concerns tests/Feature/Admin/AttributeApiTest.php app/Http/Requests/Admin/AttributeRequest.php app/Http/Controllers/Api/Admin/AttributeController.php routes/api.php
git commit -m "feat(admin-api): attributes CRUD"
```

---

### Task 2: API типов цен

**Files:**
- Create: `app/Http/Requests/Admin/PriceTypeRequest.php`
- Create: `app/Http/Controllers/Api/Admin/PriceTypeController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Admin/PriceTypeApiTest.php`

**Interfaces:**
- Consumes: `ActsAsStaff` (Task 1).
- Produces: `GET/POST /api/admin/price-types`, `GET/PUT/DELETE /api/admin/price-types/{price_type}`; список отсортирован по `sort_order`, затем `name`.

- [ ] **Step 1: Падающий тест**

`tests/Feature/Admin/PriceTypeApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\PriceType;
use App\Models\ProductPrice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class PriceTypeApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_price_types(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/price-types');
    }

    #[Test]
    public function it_lists_price_types_in_sort_order(): void
    {
        $this->actingAsManager();
        PriceType::factory()->create(['code' => 'b', 'name' => 'Опт', 'sort_order' => 2]);
        PriceType::factory()->create(['code' => 'a', 'name' => 'Розница', 'sort_order' => 1]);

        $this->getJson('/api/admin/price-types')
            ->assertOk()
            ->assertJsonPath('data.0.code', 'a')
            ->assertJsonPath('data.1.code', 'b');
    }

    #[Test]
    public function it_creates_updates_and_deletes_a_price_type(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/price-types', ['code' => 'dealer', 'name' => 'Дилер', 'sort_order' => 3])
            ->assertCreated()->json('data.id');

        $this->putJson("/api/admin/price-types/{$id}", ['code' => 'dealer', 'name' => 'Дилерская', 'sort_order' => 4])
            ->assertOk()->assertJsonPath('data.name', 'Дилерская');

        $this->deleteJson("/api/admin/price-types/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('price_types', ['id' => $id]);
    }

    #[Test]
    public function the_code_is_unique(): void
    {
        $this->actingAsManager();
        PriceType::factory()->create(['code' => 'dealer']);

        $this->postJson('/api/admin/price-types', ['code' => 'dealer', 'name' => 'Дилер'])
            ->assertUnprocessable()->assertJsonValidationErrors('code');
    }

    #[Test]
    public function a_price_type_with_prices_cannot_be_deleted(): void
    {
        $this->actingAsManager();
        $price = ProductPrice::factory()->create();

        $this->deleteJson("/api/admin/price-types/{$price->price_type_id}")->assertUnprocessable();
        $this->assertDatabaseHas('price_types', ['id' => $price->price_type_id]);
    }
}
```

- [ ] **Step 2: Убедиться, что падает**

Run: `$TEST tests/Feature/Admin/PriceTypeApiTest.php`
Expected: FAIL — 404.

- [ ] **Step 3: Запрос**

`app/Http/Requests/Admin/PriceTypeRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PriceTypeRequest extends FormRequest
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
            'code' => [
                'required', 'string', 'max:64', 'regex:/^[a-z0-9_]+$/',
                Rule::unique('price_types', 'code')->ignore($this->route('price_type')),
            ],
            'name' => ['required', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function validated($key = null, $default = null): mixed
    {
        $validated = parent::validated();
        $validated['sort_order'] = (int) ($validated['sort_order'] ?? 0);

        return $key === null ? $validated : data_get($validated, $key, $default);
    }
}
```

- [ ] **Step 4: Контроллер**

`app/Http/Controllers/Api/Admin/PriceTypeController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PriceTypeRequest;
use App\Models\PriceType;
use Illuminate\Http\JsonResponse;

class PriceTypeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => PriceType::orderBy('sort_order')->orderBy('name')->get()]);
    }

    public function store(PriceTypeRequest $request): JsonResponse
    {
        return response()->json(['data' => PriceType::create($request->validated())], 201);
    }

    public function show(PriceType $priceType): JsonResponse
    {
        return response()->json(['data' => $priceType]);
    }

    public function update(PriceTypeRequest $request, PriceType $priceType): JsonResponse
    {
        $priceType->update($request->validated());

        return response()->json(['data' => $priceType]);
    }

    /**
     * PricingService resolves prices by type code — deleting a type in use
     * would silently cascade away product prices the storefront shows.
     */
    public function destroy(PriceType $priceType): JsonResponse
    {
        if ($priceType->productPrices()->exists()) {
            return response()->json(['message' => 'По этому типу заданы цены товаров — сначала удалите их.'], 422);
        }

        $priceType->delete();

        return response()->json(null, 204);
    }
}
```

- [ ] **Step 5: Маршрут**

Импорт `use App\Http\Controllers\Api\Admin\PriceTypeController;`, в группе `admin`:

```php
        Route::apiResource('price-types', PriceTypeController::class);
```

- [ ] **Step 6: Тесты зелёные**

Run: `php artisan route:clear && $TEST tests/Feature/Admin/PriceTypeApiTest.php`
Expected: PASS (5 tests).

- [ ] **Step 7: Коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Requests/Admin/PriceTypeRequest.php app/Http/Controllers/Api/Admin/PriceTypeController.php routes/api.php tests/Feature/Admin/PriceTypeApiTest.php
git commit -m "feat(admin-api): price types CRUD"
```

---

### Task 3: API групп каталога

**Files:**
- Create: `app/Http/Requests/Admin/CatalogGroupRequest.php`
- Create: `app/Http/Controllers/Api/Admin/CatalogGroupController.php`
- Create: `app/Http/Controllers/Api/Admin/CatalogGroupMemberController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Admin/CatalogGroupApiTest.php`

**Interfaces:**
- Consumes: `ActsAsStaff`.
- Produces:
  - `GET/POST /api/admin/catalog-groups` (index: `data[]` с `products_count`, `users_count`), `GET/PUT/DELETE /api/admin/catalog-groups/{catalog_group}`; `show` → `data: {id, name, products: [{id, name, code, article}], users: [{id, company_name, email, phone}]}`.
  - `POST|DELETE /api/admin/catalog-groups/{catalog_group}/products/{product}` → 204.
  - `POST|DELETE /api/admin/catalog-groups/{catalog_group}/users/{user}` → 204; не B2B-клиент → 422.

- [ ] **Step 1: Падающий тест**

`tests/Feature/Admin/CatalogGroupApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\CatalogGroup;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class CatalogGroupApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_catalog_groups(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/catalog-groups');
    }

    #[Test]
    public function it_lists_groups_with_member_counts(): void
    {
        $this->actingAsManager();
        $group = CatalogGroup::factory()->create(['name' => 'Дилеры']);
        $group->products()->attach(Product::factory()->count(2)->create());

        $this->getJson('/api/admin/catalog-groups')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Дилеры')
            ->assertJsonPath('data.0.products_count', 2)
            ->assertJsonPath('data.0.users_count', 0);
    }

    #[Test]
    public function it_creates_renames_and_deletes_a_group(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/catalog-groups', ['name' => 'Дилеры'])->assertCreated()->json('data.id');
        $this->putJson("/api/admin/catalog-groups/{$id}", ['name' => 'Крупные дилеры'])
            ->assertOk()->assertJsonPath('data.name', 'Крупные дилеры');

        $this->postJson('/api/admin/catalog-groups', ['name' => ''])->assertUnprocessable()->assertJsonValidationErrors('name');

        $this->deleteJson("/api/admin/catalog-groups/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('catalog_groups', ['id' => $id]);
    }

    #[Test]
    public function products_are_attached_and_detached_idempotently(): void
    {
        $this->actingAsManager();
        $group = CatalogGroup::factory()->create();
        $product = Product::factory()->create();

        $this->postJson("/api/admin/catalog-groups/{$group->id}/products/{$product->id}")->assertNoContent();
        $this->postJson("/api/admin/catalog-groups/{$group->id}/products/{$product->id}")->assertNoContent();
        $this->assertSame(1, $group->products()->count());

        $this->getJson("/api/admin/catalog-groups/{$group->id}")
            ->assertOk()
            ->assertJsonPath('data.products.0.id', $product->id);

        $this->deleteJson("/api/admin/catalog-groups/{$group->id}/products/{$product->id}")->assertNoContent();
        $this->assertSame(0, $group->products()->count());
    }

    #[Test]
    public function only_b2b_clients_can_join_a_group(): void
    {
        $this->actingAsManager();
        $group = CatalogGroup::factory()->create();
        $client = User::factory()->b2b()->approved()->create();
        $retail = User::factory()->retail()->create();

        $this->postJson("/api/admin/catalog-groups/{$group->id}/users/{$client->id}")->assertNoContent();
        $this->postJson("/api/admin/catalog-groups/{$group->id}/users/{$retail->id}")->assertUnprocessable();

        $this->getJson("/api/admin/catalog-groups/{$group->id}")
            ->assertJsonCount(1, 'data.users')
            ->assertJsonPath('data.users.0.id', $client->id);

        $this->deleteJson("/api/admin/catalog-groups/{$group->id}/users/{$client->id}")->assertNoContent();
        $this->assertSame(0, $group->users()->count());
    }
}
```

- [ ] **Step 2: Убедиться, что падает**

Run: `$TEST tests/Feature/Admin/CatalogGroupApiTest.php`
Expected: FAIL — 404.

- [ ] **Step 3: Запрос**

`app/Http/Requests/Admin/CatalogGroupRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class CatalogGroupRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
        ];
    }
}
```

- [ ] **Step 4: Контроллеры**

`app/Http/Controllers/Api/Admin/CatalogGroupController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CatalogGroupRequest;
use App\Models\CatalogGroup;
use Illuminate\Http\JsonResponse;

class CatalogGroupController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => CatalogGroup::withCount(['products', 'users'])->orderBy('name')->get(),
        ]);
    }

    public function store(CatalogGroupRequest $request): JsonResponse
    {
        return response()->json(['data' => CatalogGroup::create($request->validated())], 201);
    }

    public function show(CatalogGroup $catalogGroup): JsonResponse
    {
        $catalogGroup->load([
            'products' => fn ($query) => $query->select('products.id', 'products.name', 'products.code', 'products.article')->orderBy('products.id'),
            'users' => fn ($query) => $query->select('users.id', 'users.company_name', 'users.email', 'users.phone')->orderBy('users.company_name'),
        ]);

        return response()->json(['data' => $catalogGroup]);
    }

    public function update(CatalogGroupRequest $request, CatalogGroup $catalogGroup): JsonResponse
    {
        $catalogGroup->update($request->validated());

        return response()->json(['data' => $catalogGroup]);
    }

    public function destroy(CatalogGroup $catalogGroup): JsonResponse
    {
        $catalogGroup->delete();

        return response()->json(null, 204);
    }
}
```

`app/Http/Controllers/Api/Admin/CatalogGroupMemberController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CatalogGroup;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * Membership only: a group restricts an existing assortment to existing
 * clients, so nothing is created from here — just attached or detached.
 */
class CatalogGroupMemberController extends Controller
{
    public function attachProduct(CatalogGroup $catalogGroup, Product $product): JsonResponse
    {
        $catalogGroup->products()->syncWithoutDetaching([$product->id]);

        return response()->json(null, 204);
    }

    public function detachProduct(CatalogGroup $catalogGroup, Product $product): JsonResponse
    {
        $catalogGroup->products()->detach($product->id);

        return response()->json(null, 204);
    }

    public function attachUser(CatalogGroup $catalogGroup, User $user): JsonResponse
    {
        if (! $user->hasRole('b2b_customer')) {
            return response()->json(['message' => 'В группу каталога можно добавить только B2B-клиента.'], 422);
        }

        $catalogGroup->users()->syncWithoutDetaching([$user->id]);

        return response()->json(null, 204);
    }

    public function detachUser(CatalogGroup $catalogGroup, User $user): JsonResponse
    {
        $catalogGroup->users()->detach($user->id);

        return response()->json(null, 204);
    }
}
```

- [ ] **Step 5: Маршруты**

Импорты `CatalogGroupController`, `CatalogGroupMemberController`; в группе `admin`:

```php
        Route::apiResource('catalog-groups', CatalogGroupController::class);
        Route::post('catalog-groups/{catalog_group}/products/{product}', [CatalogGroupMemberController::class, 'attachProduct']);
        Route::delete('catalog-groups/{catalog_group}/products/{product}', [CatalogGroupMemberController::class, 'detachProduct']);
        Route::post('catalog-groups/{catalog_group}/users/{user}', [CatalogGroupMemberController::class, 'attachUser']);
        Route::delete('catalog-groups/{catalog_group}/users/{user}', [CatalogGroupMemberController::class, 'detachUser']);
```

- [ ] **Step 6: Тесты зелёные**

Run: `php artisan route:clear && $TEST tests/Feature/Admin/CatalogGroupApiTest.php`
Expected: PASS (5 tests). Если `data.products.0.name` приходит строкой JSON — это нормально, в тесте имя не сравнивается.

- [ ] **Step 7: Коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Requests/Admin/CatalogGroupRequest.php app/Http/Controllers/Api/Admin/CatalogGroup*.php routes/api.php tests/Feature/Admin/CatalogGroupApiTest.php
git commit -m "feat(admin-api): catalog groups with product and client membership"
```

---

### Task 4: API подборок товаров

**Files:**
- Create: `app/Http/Requests/Admin/ProductCollectionRequest.php`
- Create: `app/Http/Controllers/Api/Admin/ProductCollectionController.php`
- Create: `app/Http/Controllers/Api/Admin/ProductCollectionProductController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Admin/ProductCollectionApiTest.php`

**Interfaces:**
- Consumes: `ActsAsStaff`.
- Produces:
  - `GET/POST /api/admin/product-collections` (index: `data[]` с `products_count`, по `sort_order`), `GET/PUT/DELETE /api/admin/product-collections/{product_collection}`; `show` → `data: {id, title: {ru, kk}, slug, sort_order, is_active, products: [{id, name, code, article, pivot: {sort_order}}]}`.
  - `PUT /api/admin/product-collections/{product_collection}/products/{product}` body `{sort_order?: int}` → 204 (добавить или обновить порядок).
  - `DELETE …/products/{product}` → 204.

- [ ] **Step 1: Падающий тест**

`tests/Feature/Admin/ProductCollectionApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Models\ProductCollection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ProductCollectionApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_collections(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/product-collections');
    }

    #[Test]
    public function it_creates_updates_and_deletes_a_translatable_collection(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/product-collections', [
            'title' => ['ru' => 'Хиты', 'kk' => 'Хиттер'],
            'slug' => 'hits',
            'sort_order' => 1,
            'is_active' => true,
        ])->assertCreated()->json('data.id');

        $collection = ProductCollection::findOrFail($id);
        $this->assertSame('Хиттер', $collection->getTranslation('title', 'kk'));

        $this->putJson("/api/admin/product-collections/{$id}", [
            'title' => ['ru' => 'Хиты продаж'],
            'slug' => 'hits',
            'is_active' => false,
        ])->assertOk();

        $this->assertFalse($collection->fresh()->is_active);
        $this->assertSame('Хиты продаж', $collection->fresh()->getTranslation('title', 'ru'));

        $this->deleteJson("/api/admin/product-collections/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('product_collections', ['id' => $id]);
    }

    #[Test]
    public function the_russian_title_and_a_unique_slug_are_required(): void
    {
        $this->actingAsManager();
        ProductCollection::factory()->create(['slug' => 'hits']);

        $this->postJson('/api/admin/product-collections', ['title' => ['kk' => 'Хиттер'], 'slug' => 'hits'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title.ru', 'slug']);
    }

    #[Test]
    public function products_are_added_reordered_and_removed(): void
    {
        $this->actingAsManager();
        $collection = ProductCollection::factory()->create();
        [$first, $second] = Product::factory()->count(2)->create();

        $this->putJson("/api/admin/product-collections/{$collection->id}/products/{$first->id}", ['sort_order' => 2])->assertNoContent();
        $this->putJson("/api/admin/product-collections/{$collection->id}/products/{$second->id}", ['sort_order' => 1])->assertNoContent();

        $this->getJson("/api/admin/product-collections/{$collection->id}")
            ->assertOk()
            ->assertJsonPath('data.products.0.id', $second->id)
            ->assertJsonPath('data.products.1.pivot.sort_order', 2);

        // Same endpoint again only moves it — no duplicate row.
        $this->putJson("/api/admin/product-collections/{$collection->id}/products/{$first->id}", ['sort_order' => 0])->assertNoContent();
        $this->assertSame(2, $collection->products()->count());
        $this->assertSame($first->id, $collection->products()->first()->id);

        $this->deleteJson("/api/admin/product-collections/{$collection->id}/products/{$first->id}")->assertNoContent();
        $this->assertSame(1, $collection->products()->count());
    }
}
```

- [ ] **Step 2: Убедиться, что падает**

Run: `$TEST tests/Feature/Admin/ProductCollectionApiTest.php`
Expected: FAIL — 404.

- [ ] **Step 3: Запрос**

`app/Http/Requests/Admin/ProductCollectionRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductCollectionRequest extends FormRequest
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
            'title' => ['required', 'array'],
            'title.ru' => ['required', 'string', 'max:255'],
            'title.kk' => ['nullable', 'string', 'max:255'],
            'slug' => [
                'required', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('product_collections', 'slug')->ignore($this->route('product_collection')),
            ],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function validated($key = null, $default = null): mixed
    {
        $validated = parent::validated();
        $validated['title'] = array_filter($validated['title'], fn (?string $value): bool => $value !== null && $value !== '');
        $validated['sort_order'] = (int) ($validated['sort_order'] ?? 0);

        return $key === null ? $validated : data_get($validated, $key, $default);
    }
}
```

- [ ] **Step 4: Контроллеры**

`app/Http/Controllers/Api/Admin/ProductCollectionController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProductCollectionRequest;
use App\Models\ProductCollection;
use Illuminate\Http\JsonResponse;

class ProductCollectionController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => ProductCollection::withCount('products')->orderBy('sort_order')->orderBy('id')->get(),
        ]);
    }

    public function store(ProductCollectionRequest $request): JsonResponse
    {
        return response()->json(['data' => ProductCollection::create($request->validated())], 201);
    }

    public function show(ProductCollection $productCollection): JsonResponse
    {
        $productCollection->load([
            'products' => fn ($query) => $query->select('products.id', 'products.name', 'products.code', 'products.article'),
        ]);

        return response()->json(['data' => $productCollection]);
    }

    public function update(ProductCollectionRequest $request, ProductCollection $productCollection): JsonResponse
    {
        $productCollection->update($request->validated());

        return response()->json(['data' => $productCollection]);
    }

    public function destroy(ProductCollection $productCollection): JsonResponse
    {
        $productCollection->delete();

        return response()->json(null, 204);
    }
}
```

`app/Http/Controllers/Api/Admin/ProductCollectionProductController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductCollectionProductController extends Controller
{
    /**
     * Put a product in the collection at the given position, or move it
     * there if it is already in.
     */
    public function upsert(Request $request, ProductCollection $productCollection, Product $product): JsonResponse
    {
        $validated = $request->validate(['sort_order' => ['nullable', 'integer']]);

        $productCollection->products()->syncWithoutDetaching([
            $product->id => ['sort_order' => (int) ($validated['sort_order'] ?? 0)],
        ]);

        return response()->json(null, 204);
    }

    public function destroy(ProductCollection $productCollection, Product $product): JsonResponse
    {
        $productCollection->products()->detach($product->id);

        return response()->json(null, 204);
    }
}
```

- [ ] **Step 5: Маршруты**

Импорты; в группе `admin`:

```php
        Route::apiResource('product-collections', ProductCollectionController::class);
        Route::put('product-collections/{product_collection}/products/{product}', [ProductCollectionProductController::class, 'upsert']);
        Route::delete('product-collections/{product_collection}/products/{product}', [ProductCollectionProductController::class, 'destroy']);
```

- [ ] **Step 6: Тесты зелёные**

Run: `php artisan route:clear && $TEST tests/Feature/Admin/ProductCollectionApiTest.php`
Expected: PASS (4 tests).

- [ ] **Step 7: Коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Requests/Admin/ProductCollectionRequest.php app/Http/Controllers/Api/Admin/ProductCollection*.php routes/api.php tests/Feature/Admin/ProductCollectionApiTest.php
git commit -m "feat(admin-api): product collections with ordered products"
```

---

### Task 5: Цены товара и персональные цены клиентов

**Files:**
- Create: `app/Http/Requests/Admin/Concerns/ConvertsTengeToTiyn.php`
- Create: `app/Http/Requests/Admin/ProductPriceRequest.php`, `app/Http/Controllers/Api/Admin/ProductPriceController.php`
- Create: `app/Http/Requests/Admin/ClientProductPriceRequest.php`, `app/Http/Controllers/Api/Admin/ClientProductPriceController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Admin/ProductPriceApiTest.php`, `tests/Feature/Admin/ClientProductPriceApiTest.php`

**Interfaces:**
- Consumes: `ActsAsStaff`; эндпоинты типов цен (Task 2) — только во фронтенде.
- Produces:
  - Трейт `App\Http\Requests\Admin\Concerns\ConvertsTengeToTiyn` — класс объявляет `protected function priceFields(): array` (list<string>), трейт переопределяет `validated()`.
  - `GET/POST /api/admin/products/{product}/prices`, `PUT/DELETE /api/admin/products/{product}/prices/{price}`; элемент: `{id, product_id, price_type_id, price (тиын), price_type: {id, code, name}}`.
  - `GET/POST /api/admin/products/{product}/client-prices`, `PUT/DELETE …/client-prices/{client_price}`; элемент: `{id, product_id, user_id, price (тиын), user: {id, company_name, email, phone}}`.
  - Чужой `{price}`/`{client_price}` → 404 (scoped).

- [ ] **Step 1: Падающие тесты**

`tests/Feature/Admin/ProductPriceApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\PriceType;
use App\Models\Product;
use App\Models\ProductPrice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ProductPriceApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_prices(): void
    {
        $product = Product::factory()->create();

        $this->assertStaffOnly('GET', "/api/admin/products/{$product->id}/prices");
    }

    #[Test]
    public function a_price_is_sent_in_tenge_and_stored_in_tiyn(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $type = PriceType::factory()->create();

        $id = $this->postJson("/api/admin/products/{$product->id}/prices", [
            'price_type_id' => $type->id,
            'price' => '1500.50',
        ])->assertCreated()->assertJsonPath('data.price_type.id', $type->id)->json('data.id');

        $this->assertSame(150_050, ProductPrice::findOrFail($id)->price);

        $this->putJson("/api/admin/products/{$product->id}/prices/{$id}", [
            'price_type_id' => $type->id,
            'price' => 2000,
        ])->assertOk();

        $this->assertSame(200_000, ProductPrice::findOrFail($id)->price);

        $this->getJson("/api/admin/products/{$product->id}/prices")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.price', 200_000);

        $this->deleteJson("/api/admin/products/{$product->id}/prices/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('product_prices', ['id' => $id]);
    }

    #[Test]
    public function one_price_per_type_per_product(): void
    {
        $this->actingAsManager();
        $existing = ProductPrice::factory()->create();

        $this->postJson("/api/admin/products/{$existing->product_id}/prices", [
            'price_type_id' => $existing->price_type_id,
            'price' => 100,
        ])->assertUnprocessable()->assertJsonValidationErrors('price_type_id');

        // The same row may keep its own type on update.
        $this->putJson("/api/admin/products/{$existing->product_id}/prices/{$existing->id}", [
            'price_type_id' => $existing->price_type_id,
            'price' => 100,
        ])->assertOk();
    }

    #[Test]
    public function a_price_must_be_non_negative_with_two_decimals_at_most(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $type = PriceType::factory()->create();

        $this->postJson("/api/admin/products/{$product->id}/prices", ['price_type_id' => $type->id, 'price' => -1])
            ->assertUnprocessable()->assertJsonValidationErrors('price');
        $this->postJson("/api/admin/products/{$product->id}/prices", ['price_type_id' => $type->id, 'price' => '1.005'])
            ->assertUnprocessable()->assertJsonValidationErrors('price');
    }

    #[Test]
    public function another_products_price_is_not_found(): void
    {
        $this->actingAsManager();
        $foreign = ProductPrice::factory()->create();
        $product = Product::factory()->create();

        $this->deleteJson("/api/admin/products/{$product->id}/prices/{$foreign->id}")->assertNotFound();
        $this->assertDatabaseHas('product_prices', ['id' => $foreign->id]);
    }
}
```

`tests/Feature/Admin/ClientProductPriceApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\ClientProductPrice;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ClientProductPriceApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_client_prices(): void
    {
        $product = Product::factory()->create();

        $this->assertStaffOnly('GET', "/api/admin/products/{$product->id}/client-prices");
    }

    #[Test]
    public function a_client_price_round_trips_in_tenge(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $client = User::factory()->b2b()->approved()->create();

        $id = $this->postJson("/api/admin/products/{$product->id}/client-prices", [
            'user_id' => $client->id,
            'price' => 990,
        ])->assertCreated()->assertJsonPath('data.user.id', $client->id)->json('data.id');

        $this->assertSame(99_000, ClientProductPrice::findOrFail($id)->price);

        $this->putJson("/api/admin/products/{$product->id}/client-prices/{$id}", [
            'user_id' => $client->id,
            'price' => '950.25',
        ])->assertOk();

        $this->assertSame(95_025, ClientProductPrice::findOrFail($id)->price);

        $this->getJson("/api/admin/products/{$product->id}/client-prices")->assertOk()->assertJsonCount(1, 'data');

        $this->deleteJson("/api/admin/products/{$product->id}/client-prices/{$id}")->assertNoContent();
    }

    #[Test]
    public function only_a_b2b_client_gets_a_personal_price(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $retail = User::factory()->retail()->create();

        $this->postJson("/api/admin/products/{$product->id}/client-prices", ['user_id' => $retail->id, 'price' => 1])
            ->assertUnprocessable()->assertJsonValidationErrors('user_id');
    }

    #[Test]
    public function one_personal_price_per_client_per_product(): void
    {
        $this->actingAsManager();
        $client = User::factory()->b2b()->approved()->create();
        $existing = ClientProductPrice::factory()->create(['user_id' => $client->id]);

        $this->postJson("/api/admin/products/{$existing->product_id}/client-prices", ['user_id' => $client->id, 'price' => 1])
            ->assertUnprocessable()->assertJsonValidationErrors('user_id');
    }

    #[Test]
    public function another_products_client_price_is_not_found(): void
    {
        $this->actingAsManager();
        $foreign = ClientProductPrice::factory()->create();
        $product = Product::factory()->create();

        $this->deleteJson("/api/admin/products/{$product->id}/client-prices/{$foreign->id}")->assertNotFound();
    }
}
```

- [ ] **Step 2: Убедиться, что падают**

Run: `$TEST tests/Feature/Admin/ProductPriceApiTest.php tests/Feature/Admin/ClientProductPriceApiTest.php`
Expected: FAIL — 404.

- [ ] **Step 3: Трейт перевода денег**

`app/Http/Requests/Admin/Concerns/ConvertsTengeToTiyn.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Concerns;

/**
 * Prices cross the admin API in ₸ (at most two decimals) and are stored in
 * integer тиын. The using request lists its money fields in priceFields();
 * the conversion happens here, once, so controllers only ever see тиын.
 */
trait ConvertsTengeToTiyn
{
    /**
     * @return list<string>
     */
    abstract protected function priceFields(): array;

    /**
     * @param  string|null  $key
     * @param  mixed  $default
     */
    public function validated($key = null, $default = null): mixed
    {
        $validated = parent::validated();

        foreach ($this->priceFields() as $field) {
            if (array_key_exists($field, $validated) && $validated[$field] !== null) {
                $validated[$field] = (int) round((float) $validated[$field] * 100);
            }
        }

        return $key === null ? $validated : data_get($validated, $key, $default);
    }
}
```

- [ ] **Step 4: Запросы**

`app/Http/Requests/Admin/ProductPriceRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ConvertsTengeToTiyn;
use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductPriceRequest extends FormRequest
{
    use ConvertsTengeToTiyn;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Product $product */
        $product = $this->route('product');

        return [
            'price_type_id' => [
                'required', 'integer', 'exists:price_types,id',
                Rule::unique('product_prices', 'price_type_id')
                    ->where('product_id', $product->id)
                    ->ignore($this->route('price')),
            ],
            'price' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
        ];
    }

    /**
     * @return list<string>
     */
    protected function priceFields(): array
    {
        return ['price'];
    }
}
```

`app/Http/Requests/Admin/ClientProductPriceRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ConvertsTengeToTiyn;
use App\Models\Product;
use App\Models\User;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ClientProductPriceRequest extends FormRequest
{
    use ConvertsTengeToTiyn;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Product $product */
        $product = $this->route('product');

        return [
            'user_id' => [
                'required', 'integer',
                function (string $attribute, mixed $value, Closure $fail): void {
                    $user = User::find($value);

                    if ($user === null || ! $user->hasRole('b2b_customer')) {
                        $fail('Персональная цена задаётся только B2B-клиенту.');
                    }
                },
                Rule::unique('client_product_prices', 'user_id')
                    ->where('product_id', $product->id)
                    ->ignore($this->route('client_price')),
            ],
            'price' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
        ];
    }

    /**
     * @return list<string>
     */
    protected function priceFields(): array
    {
        return ['price'];
    }
}
```

- [ ] **Step 5: Контроллеры**

`app/Http/Controllers/Api/Admin/ProductPriceController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProductPriceRequest;
use App\Models\Product;
use App\Models\ProductPrice;
use Illuminate\Http\JsonResponse;

class ProductPriceController extends Controller
{
    public function index(Product $product): JsonResponse
    {
        return response()->json(['data' => $product->prices()->with('priceType')->orderBy('id')->get()]);
    }

    public function store(ProductPriceRequest $request, Product $product): JsonResponse
    {
        $price = $product->prices()->create($request->validated());

        return response()->json(['data' => $price->load('priceType')], 201);
    }

    public function update(ProductPriceRequest $request, Product $product, ProductPrice $price): JsonResponse
    {
        $price->update($request->validated());

        return response()->json(['data' => $price->load('priceType')]);
    }

    public function destroy(Product $product, ProductPrice $price): JsonResponse
    {
        $price->delete();

        return response()->json(null, 204);
    }
}
```

`app/Http/Controllers/Api/Admin/ClientProductPriceController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ClientProductPriceRequest;
use App\Models\ClientProductPrice;
use App\Models\Product;
use Illuminate\Http\JsonResponse;

class ClientProductPriceController extends Controller
{
    private const USER_COLUMNS = 'user:id,company_name,email,phone';

    public function index(Product $product): JsonResponse
    {
        return response()->json(['data' => $product->clientPrices()->with(self::USER_COLUMNS)->orderBy('id')->get()]);
    }

    public function store(ClientProductPriceRequest $request, Product $product): JsonResponse
    {
        $clientPrice = $product->clientPrices()->create($request->validated());

        return response()->json(['data' => $clientPrice->load(self::USER_COLUMNS)], 201);
    }

    public function update(ClientProductPriceRequest $request, Product $product, ClientProductPrice $clientPrice): JsonResponse
    {
        $clientPrice->update($request->validated());

        return response()->json(['data' => $clientPrice->load(self::USER_COLUMNS)]);
    }

    public function destroy(Product $product, ClientProductPrice $clientPrice): JsonResponse
    {
        $clientPrice->delete();

        return response()->json(null, 204);
    }
}
```

- [ ] **Step 6: Маршруты**

Импорты; в группе `admin`:

```php
        // Relations of a product; a child of another product answers 404.
        Route::apiResource('products.prices', ProductPriceController::class)->except('show')->scoped();
        Route::apiResource('products.client-prices', ClientProductPriceController::class)->except('show')->scoped();
```

Проверка имён параметров: `php artisan route:list --path=admin/products` — должны быть `{product}/prices/{price}` и `{product}/client-prices/{client_price}`.

- [ ] **Step 7: Тесты зелёные**

Run: `php artisan route:clear && $TEST tests/Feature/Admin/ProductPriceApiTest.php tests/Feature/Admin/ClientProductPriceApiTest.php`
Expected: PASS (10 tests).

- [ ] **Step 8: Коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Requests/Admin app/Http/Controllers/Api/Admin/ProductPriceController.php app/Http/Controllers/Api/Admin/ClientProductPriceController.php routes/api.php tests/Feature/Admin/ProductPriceApiTest.php tests/Feature/Admin/ClientProductPriceApiTest.php
git commit -m "feat(admin-api): product prices by type and per-client prices"
```

---

### Task 6: Атрибуты товара и варианты

**Files:**
- Create: `app/Http/Requests/Admin/AttributeValueRequest.php`, `app/Http/Controllers/Api/Admin/AttributeValueController.php`
- Create: `app/Http/Requests/Admin/ProductVariantRequest.php`, `app/Http/Controllers/Api/Admin/ProductVariantController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Admin/AttributeValueApiTest.php`, `tests/Feature/Admin/ProductVariantApiTest.php`

**Interfaces:**
- Consumes: `ActsAsStaff`, `ConvertsTengeToTiyn` (Task 5).
- Produces:
  - `GET/POST /api/admin/products/{product}/attribute-values`, `PUT/DELETE …/attribute-values/{attribute_value}`; элемент `{id, product_id, attribute_id, value, attribute: {id, name, slug}}`.
  - `GET/POST /api/admin/products/{product}/variants`, `PUT/DELETE …/variants/{variant}`; элемент `{id, product_id, name, code, retail_price, b2b_price (тиын), stock (только чтение), barcodes: string[], characteristics: Record<string,string>}` — без `source`, `external_id`, `synced_at`.

- [ ] **Step 1: Падающие тесты**

`tests/Feature/Admin/AttributeValueApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class AttributeValueApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_attribute_values(): void
    {
        $product = Product::factory()->create();

        $this->assertStaffOnly('GET', "/api/admin/products/{$product->id}/attribute-values");
    }

    #[Test]
    public function a_value_is_created_updated_and_deleted(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $attribute = Attribute::factory()->create(['name' => 'Цвет']);

        $id = $this->postJson("/api/admin/products/{$product->id}/attribute-values", [
            'attribute_id' => $attribute->id,
            'value' => 'Серый',
        ])->assertCreated()->assertJsonPath('data.attribute.name', 'Цвет')->json('data.id');

        $this->putJson("/api/admin/products/{$product->id}/attribute-values/{$id}", [
            'attribute_id' => $attribute->id,
            'value' => 'Графит',
        ])->assertOk()->assertJsonPath('data.value', 'Графит');

        $this->getJson("/api/admin/products/{$product->id}/attribute-values")->assertOk()->assertJsonCount(1, 'data');

        $this->deleteJson("/api/admin/products/{$product->id}/attribute-values/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('attribute_values', ['id' => $id]);
    }

    #[Test]
    public function one_value_per_attribute_per_product(): void
    {
        $this->actingAsManager();
        $existing = AttributeValue::factory()->create();

        $this->postJson("/api/admin/products/{$existing->product_id}/attribute-values", [
            'attribute_id' => $existing->attribute_id,
            'value' => 'x',
        ])->assertUnprocessable()->assertJsonValidationErrors('attribute_id');
    }

    #[Test]
    public function another_products_value_is_not_found(): void
    {
        $this->actingAsManager();
        $foreign = AttributeValue::factory()->create();
        $product = Product::factory()->create();

        $this->deleteJson("/api/admin/products/{$product->id}/attribute-values/{$foreign->id}")->assertNotFound();
    }
}
```

`tests/Feature/Admin/ProductVariantApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ProductVariantApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_variants(): void
    {
        $product = Product::factory()->create();

        $this->assertStaffOnly('GET', "/api/admin/products/{$product->id}/variants");
    }

    #[Test]
    public function a_variant_is_created_locally_with_prices_in_tiyn(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();

        $response = $this->postJson("/api/admin/products/{$product->id}/variants", [
            'name' => 'Диван, серый',
            'code' => 'SOFA-GREY',
            'retail_price' => '150000',
            'b2b_price' => 120000.5,
            'barcodes' => ['4870000000011'],
            'characteristics' => ['Цвет' => 'Серый'],
        ])->assertCreated();

        $variant = ProductVariant::findOrFail($response->json('data.id'));

        $this->assertSame('local', $variant->source);
        $this->assertNotEmpty($variant->external_id);
        $this->assertSame(15_000_000, $variant->retail_price);
        $this->assertSame(12_000_050, $variant->b2b_price);
        $this->assertSame(['4870000000011'], $variant->barcodes);
        $this->assertSame(['Цвет' => 'Серый'], $variant->characteristics);

        $response->assertJsonMissingPath('data.external_id')
            ->assertJsonMissingPath('data.source')
            ->assertJsonMissingPath('data.synced_at');
    }

    #[Test]
    public function stock_and_erp_fields_are_not_accepted(): void
    {
        $this->actingAsManager();
        $variant = ProductVariant::factory()->create(['stock' => 3, 'external_id' => 'keep-me']);

        $this->putJson("/api/admin/products/{$variant->product_id}/variants/{$variant->id}", [
            'name' => 'Новое имя',
            'stock' => 999,
            'external_id' => 'changed',
            'source' => 'changed',
        ])->assertOk();

        $variant->refresh();
        $this->assertSame('Новое имя', $variant->name);
        $this->assertSame('3.000', $variant->stock);
        $this->assertSame('keep-me', $variant->external_id);
    }

    #[Test]
    public function a_variant_is_listed_and_deleted(): void
    {
        $this->actingAsManager();
        $variant = ProductVariant::factory()->create();

        $this->getJson("/api/admin/products/{$variant->product_id}/variants")->assertOk()->assertJsonCount(1, 'data');
        $this->deleteJson("/api/admin/products/{$variant->product_id}/variants/{$variant->id}")->assertNoContent();
        $this->assertDatabaseMissing('product_variants', ['id' => $variant->id]);
    }

    #[Test]
    public function another_products_variant_is_not_found(): void
    {
        $this->actingAsManager();
        $foreign = ProductVariant::factory()->create();
        $product = Product::factory()->create();

        $this->putJson("/api/admin/products/{$product->id}/variants/{$foreign->id}", ['name' => 'x'])->assertNotFound();
    }
}
```

- [ ] **Step 2: Убедиться, что падают**

Run: `$TEST tests/Feature/Admin/AttributeValueApiTest.php tests/Feature/Admin/ProductVariantApiTest.php`
Expected: FAIL — 404.

- [ ] **Step 3: Запросы**

`app/Http/Requests/Admin/AttributeValueRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AttributeValueRequest extends FormRequest
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
        /** @var Product $product */
        $product = $this->route('product');

        return [
            'attribute_id' => [
                'required', 'integer', 'exists:attributes,id',
                Rule::unique('attribute_values', 'attribute_id')
                    ->where('product_id', $product->id)
                    ->ignore($this->route('attribute_value')),
            ],
            'value' => ['required', 'string', 'max:255'],
        ];
    }
}
```

`app/Http/Requests/Admin/ProductVariantRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ConvertsTengeToTiyn;
use Illuminate\Foundation\Http\FormRequest;

/**
 * `stock`, `source`, `external_id` and `synced_at` are deliberately absent:
 * stock moves only through FifoInventoryService, and the ERP fields are
 * historical data the admin neither shows nor edits.
 */
class ProductVariantRequest extends FormRequest
{
    use ConvertsTengeToTiyn;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['code', 'retail_price', 'b2b_price'] as $field) {
            if ($this->input($field) === '') {
                $this->merge([$field => null]);
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:255'],
            'retail_price' => ['nullable', 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
            'b2b_price' => ['nullable', 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
            'barcodes' => ['nullable', 'array'],
            'barcodes.*' => ['string', 'max:64'],
            'characteristics' => ['nullable', 'array'],
            'characteristics.*' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return list<string>
     */
    protected function priceFields(): array
    {
        return ['retail_price', 'b2b_price'];
    }
}
```

- [ ] **Step 4: Контроллеры**

`app/Http/Controllers/Api/Admin/AttributeValueController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AttributeValueRequest;
use App\Models\AttributeValue;
use App\Models\Product;
use Illuminate\Http\JsonResponse;

class AttributeValueController extends Controller
{
    private const ATTRIBUTE_COLUMNS = 'attribute:id,name,slug';

    public function index(Product $product): JsonResponse
    {
        return response()->json(['data' => $product->attributeValues()->with(self::ATTRIBUTE_COLUMNS)->orderBy('id')->get()]);
    }

    public function store(AttributeValueRequest $request, Product $product): JsonResponse
    {
        $value = $product->attributeValues()->create($request->validated());

        return response()->json(['data' => $value->load(self::ATTRIBUTE_COLUMNS)], 201);
    }

    public function update(AttributeValueRequest $request, Product $product, AttributeValue $attributeValue): JsonResponse
    {
        $attributeValue->update($request->validated());

        return response()->json(['data' => $attributeValue->load(self::ATTRIBUTE_COLUMNS)]);
    }

    public function destroy(Product $product, AttributeValue $attributeValue): JsonResponse
    {
        $attributeValue->delete();

        return response()->json(null, 204);
    }
}
```

`app/Http/Controllers/Api/Admin/ProductVariantController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProductVariantRequest;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class ProductVariantController extends Controller
{
    /** ERP bookkeeping kept as data, never shown in the admin. */
    private const HIDDEN = ['source', 'external_id', 'synced_at'];

    public function index(Product $product): JsonResponse
    {
        $variants = $product->variants()->orderBy('id')->get()->each->makeHidden(self::HIDDEN);

        return response()->json(['data' => $variants]);
    }

    public function store(ProductVariantRequest $request, Product $product): JsonResponse
    {
        $variant = $product->variants()->create([
            ...$request->validated(),
            // NOT NULL columns from the ERP days; a hand-made variant is local.
            'source' => 'local',
            'external_id' => (string) Str::uuid(),
        ]);

        return response()->json(['data' => $variant->makeHidden(self::HIDDEN)], 201);
    }

    public function update(ProductVariantRequest $request, Product $product, ProductVariant $variant): JsonResponse
    {
        $variant->update($request->validated());

        return response()->json(['data' => $variant->makeHidden(self::HIDDEN)]);
    }

    public function destroy(Product $product, ProductVariant $variant): JsonResponse
    {
        $variant->delete();

        return response()->json(null, 204);
    }
}
```

- [ ] **Step 5: Маршруты**

Импорты; в группе `admin` рядом с Task 5:

```php
        Route::apiResource('products.attribute-values', AttributeValueController::class)->except('show')->scoped();
        Route::apiResource('products.variants', ProductVariantController::class)->except('show')->scoped();
```

Важно: `name` в `stock_and_erp_fields_are_not_accepted` — единственное обязательное поле; `PUT` отправляет только его, `validated()` не содержит цен, и `update()` их не трогает.

- [ ] **Step 6: Тесты зелёные**

Run: `php artisan route:clear && $TEST tests/Feature/Admin/AttributeValueApiTest.php tests/Feature/Admin/ProductVariantApiTest.php`
Expected: PASS (9 tests).

- [ ] **Step 7: Коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Requests/Admin app/Http/Controllers/Api/Admin/AttributeValueController.php app/Http/Controllers/Api/Admin/ProductVariantController.php routes/api.php tests/Feature/Admin/AttributeValueApiTest.php tests/Feature/Admin/ProductVariantApiTest.php
git commit -m "feat(admin-api): product attribute values and variants"
```

---

### Task 7: Медиа товара и доработка ProductController

**Files:**
- Create: `app/Http/Controllers/Api/Admin/ProductMediaController.php`
- Modify: `app/Http/Controllers/Api/Admin/ProductController.php` (`store`, `update`, `show`, `destroy`)
- Modify: `app/Http/Requests/Admin/ProductSaveRequest.php` (убрать `images`, `images.*`)
- Modify: `routes/api.php`
- Modify: `tests/Feature/Admin/ProductCrudTest.php`
- Test: `tests/Feature/Admin/ProductMediaApiTest.php`

**Interfaces:**
- Consumes: `ActsAsStaff`.
- Produces:
  - `ProductMediaController::present(Media $media): array{id:int, file_name:string, url:string, thumb_url:string, order:int|null}` (public static).
  - `GET /api/admin/products/{product}/media` → `{data: Image[]}` по `order_column`.
  - `POST /api/admin/products/{product}/media` (multipart `file`: jpeg/png/webp, ≤ 10 МБ) → 201 `{data: Image}`.
  - `PUT /api/admin/products/{product}/media/order` body `{ids: int[]}` — ровно все картинки товара → `{data: Image[]}`; чужой/неполный набор → 422.
  - `DELETE /api/admin/products/{product}/media/{media}` → 204; чужое медиа → 404.
  - `GET /api/admin/products/{product}` дополнительно отдаёт `data.images: Image[]`.
  - `DELETE /api/admin/products/{product}` при записях в `stock_movements` → 422.

- [ ] **Step 1: Падающий тест медиа**

`tests/Feature/Admin/ProductMediaApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ProductMediaApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        Storage::fake(config('media-library.disk_name'));
    }

    private function upload(Product $product, string $name = 'sofa.jpg'): int
    {
        return $this->post(
            "/api/admin/products/{$product->id}/media",
            ['file' => UploadedFile::fake()->image($name)],
            ['Accept' => 'application/json'],
        )->assertCreated()->json('data.id');
    }

    #[Test]
    public function only_staff_may_manage_media(): void
    {
        $product = Product::factory()->create();

        $this->assertStaffOnly('GET', "/api/admin/products/{$product->id}/media");
    }

    #[Test]
    public function an_image_is_uploaded_listed_and_deleted(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();

        $id = $this->upload($product);

        $this->getJson("/api/admin/products/{$product->id}/media")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonStructure(['data' => [['id', 'file_name', 'url', 'thumb_url', 'order']]]);

        $this->getJson("/api/admin/products/{$product->id}")->assertJsonPath('data.images.0.id', $id);

        $this->deleteJson("/api/admin/products/{$product->id}/media/{$id}")->assertNoContent();
        $this->assertCount(0, $product->fresh()->getMedia(Product::IMAGE_COLLECTION));
    }

    #[Test]
    public function uploading_adds_rather_than_replaces(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();

        $this->upload($product, 'a.jpg');
        $this->upload($product, 'b.jpg');

        $this->assertCount(2, $product->fresh()->getMedia(Product::IMAGE_COLLECTION));
    }

    #[Test]
    public function only_images_within_the_size_limit_are_accepted(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();

        $this->post("/api/admin/products/{$product->id}/media", [
            'file' => UploadedFile::fake()->create('price.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');

        $this->post("/api/admin/products/{$product->id}/media", [
            'file' => UploadedFile::fake()->image('huge.jpg')->size(11_000),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');
    }

    #[Test]
    public function images_are_reordered(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $first = $this->upload($product, 'a.jpg');
        $second = $this->upload($product, 'b.jpg');

        $this->putJson("/api/admin/products/{$product->id}/media/order", ['ids' => [$second, $first]])
            ->assertOk()
            ->assertJsonPath('data.0.id', $second)
            ->assertJsonPath('data.1.id', $first);

        $this->assertSame($second, $product->fresh()->getFirstMedia(Product::IMAGE_COLLECTION)->id);
    }

    #[Test]
    public function reordering_must_name_exactly_the_products_images(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $other = Product::factory()->create();
        $mine = $this->upload($product);
        $foreign = $this->upload($other);

        $this->putJson("/api/admin/products/{$product->id}/media/order", ['ids' => [$mine, $foreign]])->assertUnprocessable();
        $this->putJson("/api/admin/products/{$product->id}/media/order", ['ids' => []])->assertUnprocessable();
    }

    #[Test]
    public function another_products_image_is_not_found(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $foreign = $this->upload(Product::factory()->create());

        $this->deleteJson("/api/admin/products/{$product->id}/media/{$foreign}")->assertNotFound();
    }
}
```

- [ ] **Step 2: Правка ProductCrudTest**

В `tests/Feature/Admin/ProductCrudTest.php`:

1. В `the_multipart_payload_the_admin_form_sends_round_trips`: удалить `Storage::fake(...)`, строку `'images' => [UploadedFile::fake()->image('sofa.jpg')],` и последнюю проверку `assertCount(1, $product->getMedia(...))`. Docblock: `images as files` → убрать.
2. Добавить тесты (импорт `App\Models\StockMovement`):

```php
    #[Test]
    public function images_are_no_longer_accepted_by_the_product_form(): void
    {
        Storage::fake(config('media-library.disk_name'));
        $product = Product::factory()->create();

        $this->post("/api/admin/products/{$product->id}", [
            '_method' => 'PUT',
            'name' => ['ru' => 'Диван'],
            'images' => [UploadedFile::fake()->image('sofa.jpg')],
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertCount(0, $product->fresh()->getMedia(Product::IMAGE_COLLECTION));
    }

    #[Test]
    public function a_product_with_stock_movements_cannot_be_deleted(): void
    {
        $movement = StockMovement::factory()->create();

        $this->deleteJson("/api/admin/products/{$movement->product_id}")
            ->assertUnprocessable()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseHas('products', ['id' => $movement->product_id]);
    }

    #[Test]
    public function a_product_without_movements_is_deleted(): void
    {
        $product = Product::factory()->create();

        $this->deleteJson("/api/admin/products/{$product->id}")->assertNoContent();
        $this->assertDatabaseMissing('products', ['id' => $product->id]);
    }
```

Если `Product` использует SoftDeletes — заменить последнюю проверку на `assertSoftDeleted('products', ['id' => $product->id])` (проверить `grep -n SoftDeletes app/Models/Product.php`).

- [ ] **Step 3: Убедиться, что падают**

Run: `$TEST tests/Feature/Admin/ProductMediaApiTest.php tests/Feature/Admin/ProductCrudTest.php`
Expected: FAIL — медиа 404; `images_are_no_longer_accepted…` (1 картинка); `a_product_with_stock_movements…` (204).

- [ ] **Step 4: Медиа-контроллер**

`app/Http/Controllers/Api/Admin/ProductMediaController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/**
 * Product images, one at a time. Replaces the old "upload replaces them all"
 * behaviour of the product form: a manager adds, removes and reorders.
 */
class ProductMediaController extends Controller
{
    /**
     * @return array{id: int, file_name: string, url: string, thumb_url: string, order: int|null}
     */
    public static function present(Media $media): array
    {
        return [
            'id' => $media->id,
            'file_name' => $media->file_name,
            'url' => $media->getUrl(),
            'thumb_url' => $media->hasGeneratedConversion('thumb') ? $media->getUrl('thumb') : $media->getUrl(),
            'order' => $media->order_column,
        ];
    }

    /**
     * @return list<array{id: int, file_name: string, url: string, thumb_url: string, order: int|null}>
     */
    public static function presentAll(Product $product): array
    {
        return $product->getMedia(Product::IMAGE_COLLECTION)
            ->map(fn (Media $media): array => self::present($media))
            ->values()
            ->all();
    }

    public function index(Product $product): JsonResponse
    {
        return response()->json(['data' => self::presentAll($product)]);
    }

    public function store(Request $request, Product $product): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:jpeg,png,webp', 'max:10240'],
        ]);

        $media = $product->addMediaFromRequest('file')->toMediaCollection(Product::IMAGE_COLLECTION);

        return response()->json(['data' => self::present($media)], 201);
    }

    public function order(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'distinct'],
        ]);

        $ids = array_map('intval', $validated['ids']);
        $own = $product->getMedia(Product::IMAGE_COLLECTION)->pluck('id')->all();

        sort($own);
        $sorted = $ids;
        sort($sorted);

        if ($sorted !== $own) {
            return response()->json(['message' => 'Порядок должен перечислять ровно все картинки товара.'], 422);
        }

        Media::setNewOrder($ids);

        return response()->json(['data' => self::presentAll($product->fresh())]);
    }

    public function destroy(Product $product, Media $media): JsonResponse
    {
        $media->delete();

        return response()->json(null, 204);
    }
}
```

- [ ] **Step 5: ProductController и ProductSaveRequest**

В `ProductSaveRequest::rules()` удалить строки `'images' => 'nullable|array',` и `'images.*' => 'image|max:5120',`.

В `ProductController`:

```php
    public function show(Product $product): JsonResponse
    {
        $product->load(['category', 'brand', 'externalMapping']);

        return response()->json(['data' => [
            ...$product->toArray(),
            'images' => ProductMediaController::presentAll($product),
        ]]);
    }

    public function store(ProductSaveRequest $request): JsonResponse
    {
        $product = Product::create($request->validated());

        return response()->json(['data' => $product->load(['category', 'brand'])], 201);
    }

    public function update(ProductSaveRequest $request, Product $product): JsonResponse
    {
        $product->update($request->validated());

        return response()->json(['data' => $product->load(['category', 'brand'])]);
    }

    /**
     * The stock ledger is append-only history; a product it mentions stays.
     * A manager switches it off (is_active) instead.
     */
    public function destroy(Product $product): JsonResponse
    {
        if ($product->stockMovements()->exists()) {
            return response()->json(['message' => 'По товару есть движения по складу — удалить нельзя, выключите его.'], 422);
        }

        $product->delete();

        return response()->json(null, 204);
    }
```

Добавить `use Illuminate\Http\JsonResponse;`, убрать неиспользуемый `use Illuminate\Support\Facades\DB;`. Сигнатура `index(Request $request)` не меняется; маршрут `apiResource('products')` уже даёт параметр `{product}`, так что binding модели работает.

- [ ] **Step 6: Маршруты**

Импорт `ProductMediaController`; в группе `admin` (**до** `apiResource('products.…')` не важно, но `media/order` объявить раньше `media/{media}`):

```php
        Route::get('products/{product}/media', [ProductMediaController::class, 'index']);
        Route::post('products/{product}/media', [ProductMediaController::class, 'store']);
        Route::put('products/{product}/media/order', [ProductMediaController::class, 'order']);
        Route::delete('products/{product}/media/{media}', [ProductMediaController::class, 'destroy'])->scopeBindings();
```

- [ ] **Step 7: Тесты зелёные**

Run: `php artisan route:clear && $TEST tests/Feature/Admin/ProductMediaApiTest.php tests/Feature/Admin/ProductCrudTest.php`
Expected: PASS.

- [ ] **Step 8: Весь админский набор API**

Run: `$TEST tests/Feature/Admin`
Expected: PASS (включая старые Filament-тесты — Filament пока не трогаем).

- [ ] **Step 9: Коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Controllers/Api/Admin/ProductMediaController.php app/Http/Controllers/Api/Admin/ProductController.php app/Http/Requests/Admin/ProductSaveRequest.php routes/api.php tests/Feature/Admin/ProductMediaApiTest.php tests/Feature/Admin/ProductCrudTest.php
git commit -m "feat(admin-api): product media endpoints; refuse deleting products with stock history"
```

---

### Task 8: Основа `admin/` — зависимости, уведомления, ошибки, деньги, `useResource`

У `admin/` нет unit-тестов (только Playwright); проверка этого и следующих фронтенд-задач — `tsc` + `build`, поведение — e2e в Task 15.

**Files:**
- Modify: `admin/package.json` (через npm)
- Create: `admin/src/stores/toastStore.ts`
- Create: `admin/src/components/ui/Toaster.tsx`
- Create: `admin/src/lib/money.ts`, `admin/src/lib/errors.ts`, `admin/src/lib/crud.ts`
- Modify: `admin/src/lib/api.ts`, `admin/src/app/layout.tsx`

**Interfaces:**
- Produces:
  - `toast.success(message: string): void`, `toast.error(message: string): void` (`@/stores/toastStore`).
  - `tiynToTenge(value: unknown): string` — `''` для null/undefined/''; `formatTenge(value: number | null | undefined): string` — `'—'` или `'1 500,5 ₸'` (`@/lib/money`).
  - `applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): string | null` — раскладывает 422 `errors` по полям (ключи Laravel в dot-нотации = пути RHF), возвращает `message` для 422 без `errors`, иначе `null`; `serverMessage(error: unknown): string | null` — `message` 422 или `null` (`@/lib/errors`).
  - `useResource<T extends { id: number }>(path: string | null, params?: Record<string, unknown>)` → `{ items: T[]; meta: PageMeta | null; page: number; setPage(p: number): void; loading: boolean; reload(): Promise<void>; create(payload: unknown): Promise<T>; update(id: number, payload: unknown): Promise<T>; remove(id: number): Promise<boolean> }`; `type PageMeta = { current_page: number; last_page: number }` (`@/lib/crud`). Понимает ответ-массив, `{data: []}` и пагинатор Laravel. `create`/`update` бросают ошибку axios (форма разберёт 422); `remove` сам показывает toast.
  - Интерсептор: 401 → `logout()` + `/login` (кроме самой `/login`); 403 → toast «Нет доступа»; нет ответа или 5xx → toast об ошибке; ошибка всегда пробрасывается.

- [ ] **Step 1: Зависимости**

```bash
cd admin && npm install react-hook-form zod @hookform/resolvers
```

Expected: в `dependencies` появились три пакета; `zod` — 4.x, `@hookform/resolvers` — 5.x.

- [ ] **Step 2: Уведомления**

`admin/src/stores/toastStore.ts`:

```ts
import { create } from 'zustand';

export type ToastKind = 'success' | 'error';

export type Toast = { id: number; kind: ToastKind; message: string };

type ToastState = {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, kind, message }] }));
    setTimeout(() => get().dismiss(id), 5000);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Callable from anywhere, including the axios interceptor (outside React). */
export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
};
```

`admin/src/components/ui/Toaster.tsx`:

```tsx
'use client';

import { useToastStore } from '@/stores/toastStore';

export default function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`rounded-lg px-4 py-3 text-left text-sm shadow-lg ${
            t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-white'
          }`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
```

В `admin/src/app/layout.tsx` импортировать `Toaster from "@/components/ui/Toaster"` и поставить `<Toaster />` сразу после `</AuthInitializer>` внутри `<body>`.

- [ ] **Step 3: Интерсептор ответов**

В конец `admin/src/lib/api.ts`, перед `export default api;`:

```ts
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    if (typeof window !== 'undefined') {
      const status = error.response?.status;

      if (status === 401 && window.location.pathname !== '/login') {
        // Expired or revoked token: without this, tables just stay empty.
        useAuthStore.getState().logout();
        window.location.assign('/login');
      } else if (status === 403) {
        toast.error('Нет доступа');
      } else if (status === undefined || status >= 500) {
        toast.error('Ошибка сервера или сети — попробуйте ещё раз');
      }
    }

    return Promise.reject(error);
  },
);
```

Импорты вверху: `import axios, { AxiosError } from 'axios';`, `import { useAuthStore } from '@/stores/authStore';`, `import { toast } from '@/stores/toastStore';`.

- [ ] **Step 4: Деньги и ошибки**

`admin/src/lib/money.ts`:

```ts
/**
 * Prices cross the admin API in ₸ and are stored in тиын (see
 * App\Http\Requests\Admin\Concerns\ConvertsTengeToTiyn). The factor of 100
 * lives here and nowhere else on the client.
 */
export const tiynToTenge = (value: unknown): string =>
  value === null || value === undefined || value === '' ? '' : String(Number(value) / 100);

export const formatTenge = (value: number | null | undefined): string =>
  value === null || value === undefined
    ? '—'
    : `${(value / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₸`;

/** zod-friendly check for a ₸ amount typed into a form: digits, up to two decimals. */
export const TENGE_PATTERN = /^\d+(\.\d{1,2})?$/;
```

`admin/src/lib/errors.ts`:

```ts
import { isAxiosError } from 'axios';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

type LaravelError = { message?: string; errors?: Record<string, string[]> };

/**
 * Puts a Laravel 422 onto the form fields. Laravel's dot keys (`name.ru`)
 * are the same paths react-hook-form uses. Returns a message to show above
 * the form when the 422 is a business rule rather than a field error;
 * 401/403/5xx are already reported by the axios interceptor.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): string | null {
  if (!isAxiosError<LaravelError>(error) || error.response?.status !== 422) {
    return isAxiosError(error) ? null : 'Неизвестная ошибка';
  }

  const { errors, message } = error.response.data ?? {};

  if (!errors) {
    return message ?? 'Операция отклонена';
  }

  for (const [field, messages] of Object.entries(errors)) {
    setError(field as Path<T>, { type: 'server', message: messages[0] });
  }

  return null;
}

/** The server's explanation of a refused action (422), if any. */
export function serverMessage(error: unknown): string | null {
  if (isAxiosError<LaravelError>(error) && error.response?.status === 422) {
    return error.response.data?.message ?? 'Операция отклонена';
  }

  return null;
}
```

- [ ] **Step 5: `useResource`**

`admin/src/lib/crud.ts`:

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/stores/toastStore';

export type PageMeta = { current_page: number; last_page: number };

type ListBody<T> = T[] | { data: T[]; current_page?: number; last_page?: number };

/**
 * One REST collection: list (plain array, {data: []} or a Laravel paginator),
 * create, update, remove — each followed by a reload.
 */
export function useResource<T extends { id: number }>(path: string | null, params?: Record<string, unknown>) {
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const paramsKey = JSON.stringify(params ?? {});

  const reload = useCallback(async () => {
    if (!path) {
      return;
    }

    setLoading(true);

    try {
      const res = await api.get<ListBody<T>>(path, { params: { ...JSON.parse(paramsKey), page } });
      const body = res.data;

      if (Array.isArray(body)) {
        setItems(body);
        setMeta(null);
      } else {
        setItems(body.data ?? []);
        setMeta(body.last_page ? { current_page: body.current_page ?? 1, last_page: body.last_page } : null);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [path, paramsKey, page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = async (payload: unknown): Promise<T> => {
    const res = await api.post(path as string, payload);
    await reload();

    return (res.data?.data ?? res.data) as T;
  };

  const update = async (id: number, payload: unknown): Promise<T> => {
    const res = await api.put(`${path}/${id}`, payload);
    await reload();

    return (res.data?.data ?? res.data) as T;
  };

  const remove = async (id: number): Promise<boolean> => {
    try {
      await api.delete(`${path}/${id}`);
      await reload();
      toast.success('Удалено');

      return true;
    } catch (error) {
      const message = serverMessage(error);

      if (message) {
        toast.error(message);
      }

      return false;
    }
  };

  return { items, meta, page, setPage, loading, reload, create, update, remove };
}
```

- [ ] **Step 6: Проверка**

Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: без ошибок.

- [ ] **Step 7: Коммит**

```bash
git add admin/package.json admin/package-lock.json admin/src/stores/toastStore.ts admin/src/components/ui/Toaster.tsx admin/src/lib admin/src/app/layout.tsx
git commit -m "feat(admin): toasts, API error interceptor, money helpers and useResource"
```

---

### Task 9: Общие UI-компоненты

**Files:**
- Create: `admin/src/components/ui/styles.ts`, `Field.tsx`, `TranslatableField.tsx`, `MoneyInput.tsx`, `Modal.tsx`, `CrudModal.tsx`, `DataTable.tsx`, `ConfirmButton.tsx`, `Tabs.tsx`, `EntityPicker.tsx`, `PageHeader.tsx`

**Interfaces:**
- Consumes: `toast` (Task 8), `applyServerErrors` (Task 8), `api`.
- Produces (все — default export, путь `@/components/ui/<Name>`):
  - `styles.ts`: `inputClass`, `buttonPrimary`, `buttonSecondary`, `buttonDanger`, `buttonLink`, `cardClass` (строки).
  - `Field({ label, htmlFor?, error?, hint?, children })`.
  - `TranslatableField<T>({ form: UseFormReturn<T>, name: string, label: string, required?: boolean, multiline?: boolean })` — поля `${name}.ru` / `${name}.kk`, id `${name}-ru` / `${name}-kk`, подписи `«<label> (RU)»`, `«<label> (KK)»`.
  - `MoneyInput(props: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> })`.
  - `Modal({ title, onClose, children })` — `role="dialog"`, Esc закрывает.
  - `CrudModal<T>({ title, schema: ZodType<T>, defaultValues: DefaultValues<T>, onSubmit(values: T): Promise<unknown>, onClose(), children(form: UseFormReturn<T>): ReactNode, submitLabel? })` — после успеха toast «Сохранено» и `onClose()`.
  - `DataTable<T>({ columns: Column<T>[], rows: T[], loading?, emptyText?, meta?: PageMeta | null, onPageChange?(page: number), rowKey?(row: T) })`, `type Column<T> = { key: string; header: string; render(row: T): ReactNode; className?: string }`.
  - `ConfirmButton({ onConfirm(): unknown, question?, children, className? })` — `window.confirm`.
  - `Tabs({ tabs: Tab[] })`, `type Tab = { key: string; label: string; content: ReactNode; disabled?: boolean; hint?: string }`.
  - `EntityPicker<T extends { id: number }>({ searchPath, label(item: T): string, onPick(item: T): unknown, placeholder, excludeIds?: number[] })` — ищет `GET searchPath?filter[search]=…` от 2 символов, debounce 300 мс.
  - `PageHeader({ title, back?: string, actions?: ReactNode })`.
  - Формы держат числа строками (`''` = пусто): API принимает числовые строки, а zod-схемы без `coerce` имеют одинаковый вход и выход.

- [ ] **Step 1: Стили и `Field`**

`admin/src/components/ui/styles.ts`:

```ts
export const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-zinc-100';

export const buttonPrimary =
  'inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors';

export const buttonSecondary =
  'inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-60 transition-colors';

export const buttonDanger = 'text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50';

export const buttonLink = 'text-sm font-medium text-blue-600 hover:text-blue-800';

export const cardClass = 'bg-white rounded-xl shadow-sm border border-zinc-200';
```

`admin/src/components/ui/Field.tsx`:

```tsx
import type { ReactNode } from 'react';

type FieldProps = {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

export default function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-zinc-500">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `TranslatableField` и `MoneyInput`**

`admin/src/components/ui/TranslatableField.tsx`:

```tsx
'use client';

import { get, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';
import Field from './Field';
import { inputClass } from './styles';

type Props<T extends FieldValues> = {
  form: UseFormReturn<T>;
  name: string;
  label: string;
  required?: boolean;
  multiline?: boolean;
};

const LOCALES = ['ru', 'kk'] as const;

export default function TranslatableField<T extends FieldValues>({ form, name, label, required, multiline }: Props<T>) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {LOCALES.map((locale) => {
        const path = `${name}.${locale}` as Path<T>;
        const id = `${name}-${locale}`;
        const error = get(errors, path)?.message as string | undefined;
        const star = required && locale === 'ru' ? ' *' : '';

        return (
          <Field key={locale} label={`${label} (${locale.toUpperCase()})${star}`} htmlFor={id} error={error}>
            {multiline ? (
              <textarea id={id} rows={3} className={`${inputClass} resize-y`} {...register(path)} />
            ) : (
              <input id={id} className={inputClass} {...register(path)} />
            )}
          </Field>
        );
      })}
    </div>
  );
}
```

`admin/src/components/ui/MoneyInput.tsx`:

```tsx
import type { InputHTMLAttributes, Ref } from 'react';
import { inputClass } from './styles';

type Props = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> };

/** An amount in ₸. Kept as a string; the API converts to тиын. */
export default function MoneyInput({ className, ...props }: Props) {
  return (
    <div className="relative">
      <input
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        className={`${inputClass} pr-8 ${className ?? ''}`}
        {...props}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">₸</span>
    </div>
  );
}
```

- [ ] **Step 3: `Modal` и `CrudModal`**

`admin/src/components/ui/Modal.tsx`:

```tsx
'use client';

import { useEffect, useId, type ReactNode } from 'react';

type ModalProps = { title: string; onClose: () => void; children: ReactNode };

export default function Modal({ title, onClose, children }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="mb-4 text-lg font-semibold text-zinc-900">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
```

`admin/src/components/ui/CrudModal.tsx`:

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { useForm, type DefaultValues, type FieldValues, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';
import { applyServerErrors } from '@/lib/errors';
import { toast } from '@/stores/toastStore';
import Modal from './Modal';
import { buttonPrimary, buttonSecondary } from './styles';

type CrudModalProps<T extends FieldValues> = {
  title: string;
  schema: ZodType<T>;
  defaultValues: DefaultValues<T>;
  onSubmit: (values: T) => Promise<unknown>;
  onClose: () => void;
  children: (form: UseFormReturn<T>) => ReactNode;
  submitLabel?: string;
};

export default function CrudModal<T extends FieldValues>({
  title,
  schema,
  defaultValues,
  onSubmit,
  onClose,
  children,
  submitLabel = 'Сохранить',
}: CrudModalProps<T>) {
  // Schemas here never coerce (numbers stay strings), so input and output
  // types coincide and the resolver can be narrowed to T.
  const form = useForm<T>({ resolver: zodResolver(schema) as unknown as Resolver<T>, defaultValues });
  const [formError, setFormError] = useState<string | null>(null);

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);

    try {
      await onSubmit(values);
      toast.success('Сохранено');
      onClose();
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError));
    }
  });

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError && (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {formError}
          </div>
        )}
        {children(form)}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={buttonSecondary}>
            Отмена
          </button>
          <button type="submit" disabled={form.formState.isSubmitting} className={buttonPrimary}>
            {form.formState.isSubmitting ? 'Сохранение…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 4: `DataTable`, `ConfirmButton`, `PageHeader`**

`admin/src/components/ui/DataTable.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { PageMeta } from '@/lib/crud';
import { buttonSecondary } from './styles';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
  meta?: PageMeta | null;
  onPageChange?: (page: number) => void;
  rowKey?: (row: T) => string | number;
};

export default function DataTable<T extends { id?: number }>({
  columns,
  rows,
  loading = false,
  emptyText = 'Ничего не найдено',
  meta,
  onPageChange,
  rowKey = (row) => row.id ?? JSON.stringify(row),
}: DataTableProps<T>) {
  const message = loading ? 'Загрузка…' : rows.length === 0 ? emptyText : null;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm text-zinc-700">
        <thead className="border-b border-zinc-200 bg-zinc-50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-3 font-medium ${c.className ?? ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {message ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-500">
                {message}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-zinc-50">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 ${c.className ?? ''}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {meta && meta.last_page > 1 && onPageChange && (
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-sm">
          <span className="text-zinc-500">
            Стр. {meta.current_page} из {meta.last_page}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className={buttonSecondary}
              disabled={meta.current_page <= 1}
              onClick={() => onPageChange(meta.current_page - 1)}
            >
              Назад
            </button>
            <button
              type="button"
              className={buttonSecondary}
              disabled={meta.current_page >= meta.last_page}
              onClick={() => onPageChange(meta.current_page + 1)}
            >
              Вперёд
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

`admin/src/components/ui/ConfirmButton.tsx`:

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { buttonDanger } from './styles';

type Props = {
  onConfirm: () => unknown;
  question?: string;
  children: ReactNode;
  className?: string;
};

export default function ConfirmButton({ onConfirm, question = 'Удалить? Это действие необратимо.', children, className }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (!window.confirm(question)) {
      return;
    }

    setBusy(true);

    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" disabled={busy} onClick={handleClick} className={className ?? buttonDanger}>
      {children}
    </button>
  );
}
```

`admin/src/components/ui/PageHeader.tsx`:

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

type Props = { title: string; back?: string; actions?: ReactNode };

export default function PageHeader({ title, back, actions }: Props) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {back && (
          <Link href={back} className="text-zinc-400 hover:text-zinc-700" aria-label="Назад">
            ←
          </Link>
        )}
        <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 5: `Tabs` и `EntityPicker`**

`admin/src/components/ui/Tabs.tsx`:

```tsx
'use client';

import { useState, type ReactNode } from 'react';

export type Tab = { key: string; label: string; content: ReactNode; disabled?: boolean; hint?: string };

export default function Tabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs.find((t) => !t.disabled)?.key);
  const current = tabs.find((t) => t.key === active);

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-zinc-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === active}
            disabled={t.disabled}
            title={t.disabled ? t.hint : undefined}
            onClick={() => setActive(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              t.key === active ? 'border-blue-600 text-blue-700' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-4">
        {current?.content}
      </div>
    </div>
  );
}
```

`admin/src/components/ui/EntityPicker.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { inputClass } from './styles';

type Props<T extends { id: number }> = {
  searchPath: string;
  label: (item: T) => string;
  onPick: (item: T) => unknown;
  placeholder: string;
  excludeIds?: number[];
};

/** Search-as-you-type over an admin list endpoint that supports filter[search]. */
export default function EntityPicker<T extends { id: number }>({ searchPath, label, onPick, placeholder, excludeIds = [] }: Props<T>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);

      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get(searchPath, { params: { 'filter[search]': query.trim() } });
        setResults((res.data?.data ?? res.data ?? []) as T[]);
      } catch {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchPath]);

  const visible = results.filter((r) => !excludeIds.includes(r.id));

  return (
    <div className="relative">
      <input
        className={inputClass}
        placeholder={placeholder}
        aria-label={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {visible.length > 0 && (
        <ul role="listbox" className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
          {visible.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                onClick={async () => {
                  await onPick(item);
                  setQuery('');
                  setResults([]);
                }}
              >
                {label(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Проверка**

Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: без ошибок. Если `zodResolver(schema)` не принимает `ZodType<T>` — поменять тип пропа на `schema: ZodType<T, T>` (zod 4: `ZodType<Output, Input>`) и повторить.

- [ ] **Step 7: Коммит**

```bash
git add admin/src/components/ui
git commit -m "feat(admin): shared table, form, modal, tabs and picker components"
```

---

### Task 10: Бренды и категории на общих компонентах

Первое реальное применение компонентов из Task 9. Поля и эндпоинты не меняются.

**Files:**
- Create: `admin/src/lib/validation.ts`
- Modify (переписать целиком): `admin/src/app/brands/page.tsx`, `admin/src/app/categories/page.tsx`
- Delete: `admin/src/components/BrandModal.tsx`, `admin/src/components/CategoryModal.tsx`

**Interfaces:**
- Consumes: `useResource`, `DataTable`, `CrudModal`, `TranslatableField`, `Field`, `PageHeader`, `ConfirmButton`, стили (Tasks 8–9).
- Produces: `@/lib/validation`: `SLUG_PATTERN: RegExp` (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), `REQUIRED = 'Обязательное поле'`, `translatable = z.object({ ru: z.string().min(1, REQUIRED).max(255), kk: z.string().max(255) })`.

- [ ] **Step 1: Валидация**

`admin/src/lib/validation.ts`:

```ts
import { z } from 'zod';

export const REQUIRED = 'Обязательное поле';

/** Mirrors the server's slug regex on attributes and collections. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A {ru, kk} pair where only ru is required. */
export const translatable = z.object({
  ru: z.string().min(1, REQUIRED).max(255),
  kk: z.string().max(255),
});
```

- [ ] **Step 2: Бренды**

`admin/src/app/brands/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { REQUIRED, translatable } from '@/lib/validation';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import TranslatableField from '@/components/ui/TranslatableField';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

type Brand = { id: number; name: { ru?: string; kk?: string }; slug: string; is_active: boolean };

const schema = z.object({
  name: translatable,
  slug: z.string().min(1, REQUIRED).max(255),
  is_active: z.boolean(),
});

type BrandForm = z.infer<typeof schema>;

const toForm = (brand: Brand | null): BrandForm => ({
  name: { ru: brand?.name?.ru ?? '', kk: brand?.name?.kk ?? '' },
  slug: brand?.slug ?? '',
  is_active: brand?.is_active ?? true,
});

export default function BrandsPage() {
  const brands = useResource<Brand>('/admin/brands');
  // undefined — modal closed, null — creating.
  const [editing, setEditing] = useState<Brand | null | undefined>(undefined);

  const columns: Column<Brand>[] = [
    { key: 'id', header: 'ID', render: (b) => b.id },
    { key: 'name', header: 'Название', render: (b) => <span className="font-medium text-zinc-900">{b.name?.ru || '—'}</span> },
    { key: 'slug', header: 'Slug', render: (b) => b.slug },
    { key: 'status', header: 'Статус', render: (b) => (b.is_active ? 'Активен' : 'Выключен') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (b) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(b)}>Изменить</button>
          <ConfirmButton onConfirm={() => brands.remove(b.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Бренды"
        actions={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить бренд</button>}
      />
      <DataTable columns={columns} rows={brands.items} loading={brands.loading} emptyText="Брендов пока нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить бренд' : 'Новый бренд'}
          schema={schema}
          defaultValues={toForm(editing)}
          onSubmit={(values) => (editing ? brands.update(editing.id, values) : brands.create(values))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => (
            <>
              <TranslatableField form={form} name="name" label="Название" required />
              <Field label="Slug *" htmlFor="slug" error={form.formState.errors.slug?.message}>
                <input id="slug" className={inputClass} {...form.register('slug')} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" {...form.register('is_active')} />
                Активен
              </label>
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Категории**

`admin/src/app/categories/page.tsx` — тот же код, что у брендов, со следующими заменами (полный файл):

```tsx
'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { REQUIRED, translatable } from '@/lib/validation';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import TranslatableField from '@/components/ui/TranslatableField';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

type Category = { id: number; name: { ru?: string; kk?: string }; slug: string; is_active: boolean };

const schema = z.object({
  name: translatable,
  slug: z.string().min(1, REQUIRED).max(255),
  is_active: z.boolean(),
});

type CategoryForm = z.infer<typeof schema>;

const toForm = (category: Category | null): CategoryForm => ({
  name: { ru: category?.name?.ru ?? '', kk: category?.name?.kk ?? '' },
  slug: category?.slug ?? '',
  is_active: category?.is_active ?? true,
});

export default function CategoriesPage() {
  const categories = useResource<Category>('/admin/categories');
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);

  const columns: Column<Category>[] = [
    { key: 'id', header: 'ID', render: (c) => c.id },
    { key: 'name', header: 'Название', render: (c) => <span className="font-medium text-zinc-900">{c.name?.ru || '—'}</span> },
    { key: 'slug', header: 'Slug', render: (c) => c.slug },
    { key: 'status', header: 'Статус', render: (c) => (c.is_active ? 'Активна' : 'Выключена') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(c)}>Изменить</button>
          <ConfirmButton onConfirm={() => categories.remove(c.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Категории"
        actions={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить категорию</button>}
      />
      <DataTable columns={columns} rows={categories.items} loading={categories.loading} emptyText="Категорий пока нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить категорию' : 'Новая категория'}
          schema={schema}
          defaultValues={toForm(editing)}
          onSubmit={(values) => (editing ? categories.update(editing.id, values) : categories.create(values))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => (
            <>
              <TranslatableField form={form} name="name" label="Название" required />
              <Field label="Slug *" htmlFor="slug" error={form.formState.errors.slug?.message}>
                <input id="slug" className={inputClass} {...form.register('slug')} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" {...form.register('is_active')} />
                Активна
              </label>
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Удалить старые модалки**

```bash
git rm admin/src/components/BrandModal.tsx admin/src/components/CategoryModal.tsx
```

- [ ] **Step 5: Проверка**

Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: без ошибок.

Ручная проверка через `preview_start` (или `npm run dev` + API на :8000): `/brands` — создать бренд с пустым slug → под полем «Обязательное поле»; с занятым slug → ошибка сервера под полем; изменить; удалить.

- [ ] **Step 6: Коммит**

```bash
git add admin/src/lib/validation.ts admin/src/app/brands/page.tsx admin/src/app/categories/page.tsx
git commit -m "refactor(admin): brands and categories on the shared components"
```

---

### Task 11: Меню, атрибуты, типы цен

**Files:**
- Modify (переписать): `admin/src/components/Sidebar.tsx`
- Create: `admin/src/lib/catalogTypes.ts`
- Create: `admin/src/app/attributes/page.tsx`, `admin/src/app/price-types/page.tsx`

**Interfaces:**
- Consumes: API из Tasks 1–2; компоненты Tasks 8–10.
- Produces: `@/lib/catalogTypes`: `type Attribute = { id: number; name: string; slug: string; is_filterable: boolean }`, `type PriceType = { id: number; code: string; name: string; sort_order: number }` (в `page.tsx` Next разрешает только свои экспорты, поэтому типы — отдельным модулем); пункты меню и маршруты `/attributes`, `/price-types`, `/catalog-groups`, `/product-collections` (последние два — страницы в Tasks 12–13). Тексты ссылок существующих пунктов («Товары», «Заказы», «Склад», «Клиенты (B2B)», «Категории», «Бренды») не меняются.

- [ ] **Step 1: Типы каталога**

`admin/src/lib/catalogTypes.ts`:

```ts
export type Attribute = { id: number; name: string; slug: string; is_filterable: boolean };

export type PriceType = { id: number; code: string; name: string; sort_order: number };
```

- [ ] **Step 1a: Меню**

`admin/src/components/Sidebar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

type NavLink = { href: string; label: string };

// Group titles differ from link texts so tests and screen readers never
// see two elements named, say, «Склад».
const groups: { title: string | null; links: NavLink[] }[] = [
  { title: null, links: [{ href: '/', label: 'Главная' }] },
  {
    title: 'Продажи',
    links: [
      { href: '/orders', label: 'Заказы' },
      { href: '/users', label: 'Клиенты (B2B)' },
    ],
  },
  {
    title: 'Каталог',
    links: [
      { href: '/products', label: 'Товары' },
      { href: '/categories', label: 'Категории' },
      { href: '/brands', label: 'Бренды' },
      { href: '/attributes', label: 'Атрибуты' },
      { href: '/price-types', label: 'Типы цен' },
      { href: '/catalog-groups', label: 'Группы каталога' },
      { href: '/product-collections', label: 'Подборки' },
    ],
  },
  { title: 'Запасы', links: [{ href: '/stock', label: 'Склад' }] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuthStore();

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <div className="flex min-h-full w-64 shrink-0 flex-col bg-zinc-900 text-white shadow-lg">
      <div className="border-b border-zinc-800 p-6 text-2xl font-bold">Paradise Admin</div>
      <nav className="flex-1 space-y-4 overflow-y-auto py-4">
        {groups.map((group) => (
          <div key={group.title ?? 'root'} className="px-4">
            {group.title && (
              <div className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">{group.title}</div>
            )}
            <ul className="space-y-1">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`block rounded-lg px-4 py-2 transition-colors ${
                      isActive(link.href) ? 'bg-blue-600 text-white' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-zinc-800 p-4">
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-lg px-4 py-2.5 text-left text-red-400 transition-colors hover:bg-zinc-800"
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Атрибуты**

`admin/src/app/attributes/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { REQUIRED, SLUG_PATTERN } from '@/lib/validation';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';
import type { Attribute } from '@/lib/catalogTypes';

const schema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  slug: z.string().regex(SLUG_PATTERN, 'Латиница в нижнем регистре, цифры и дефисы'),
  is_filterable: z.boolean(),
});

type AttributeForm = z.infer<typeof schema>;

const toForm = (a: Attribute | null): AttributeForm => ({
  name: a?.name ?? '',
  slug: a?.slug ?? '',
  is_filterable: a?.is_filterable ?? false,
});

export default function AttributesPage() {
  const attributes = useResource<Attribute>('/admin/attributes');
  const [editing, setEditing] = useState<Attribute | null | undefined>(undefined);

  const columns: Column<Attribute>[] = [
    { key: 'name', header: 'Название', render: (a) => <span className="font-medium text-zinc-900">{a.name}</span> },
    { key: 'slug', header: 'Slug', render: (a) => a.slug },
    { key: 'filterable', header: 'В фильтрах', render: (a) => (a.is_filterable ? 'Да' : 'Нет') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (a) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(a)}>Изменить</button>
          <ConfirmButton onConfirm={() => attributes.remove(a.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Атрибуты"
        actions={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить атрибут</button>}
      />
      <DataTable columns={columns} rows={attributes.items} loading={attributes.loading} emptyText="Атрибутов пока нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить атрибут' : 'Новый атрибут'}
          schema={schema}
          defaultValues={toForm(editing)}
          onSubmit={(values) => (editing ? attributes.update(editing.id, values) : attributes.create(values))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => (
            <>
              <Field label="Название *" htmlFor="attr-name" error={form.formState.errors.name?.message}>
                <input id="attr-name" className={inputClass} {...form.register('name')} />
              </Field>
              <Field label="Slug *" htmlFor="attr-slug" error={form.formState.errors.slug?.message}>
                <input id="attr-slug" className={inputClass} {...form.register('slug')} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" {...form.register('is_filterable')} />
                Показывать в фильтрах витрины
              </label>
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Типы цен**

`admin/src/app/price-types/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { REQUIRED } from '@/lib/validation';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';
import type { PriceType } from '@/lib/catalogTypes';

const schema = z.object({
  code: z.string().regex(/^[a-z0-9_]+$/, 'Латиница в нижнем регистре, цифры и _'),
  name: z.string().min(1, REQUIRED).max(255),
  sort_order: z.string().regex(/^\d*$/, 'Целое число'),
});

type PriceTypeForm = z.infer<typeof schema>;

const toForm = (t: PriceType | null): PriceTypeForm => ({
  code: t?.code ?? '',
  name: t?.name ?? '',
  sort_order: t ? String(t.sort_order) : '0',
});

export default function PriceTypesPage() {
  const types = useResource<PriceType>('/admin/price-types');
  const [editing, setEditing] = useState<PriceType | null | undefined>(undefined);

  const columns: Column<PriceType>[] = [
    { key: 'name', header: 'Название', render: (t) => <span className="font-medium text-zinc-900">{t.name}</span> },
    { key: 'code', header: 'Код', render: (t) => <code className="text-xs">{t.code}</code> },
    { key: 'sort', header: 'Порядок', render: (t) => t.sort_order },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (t) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(t)}>Изменить</button>
          <ConfirmButton onConfirm={() => types.remove(t.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Типы цен"
        actions={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить тип цены</button>}
      />
      <p className="mb-4 text-sm text-zinc-500">
        Код используется в расчёте цен — меняйте его, только если понимаете, где он задействован.
      </p>
      <DataTable columns={columns} rows={types.items} loading={types.loading} emptyText="Типов цен пока нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить тип цены' : 'Новый тип цены'}
          schema={schema}
          defaultValues={toForm(editing)}
          onSubmit={(values) => (editing ? types.update(editing.id, values) : types.create(values))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => (
            <>
              <Field label="Название *" htmlFor="pt-name" error={form.formState.errors.name?.message}>
                <input id="pt-name" className={inputClass} {...form.register('name')} />
              </Field>
              <Field label="Код *" htmlFor="pt-code" error={form.formState.errors.code?.message}>
                <input id="pt-code" className={inputClass} {...form.register('code')} />
              </Field>
              <Field label="Порядок" htmlFor="pt-sort" error={form.formState.errors.sort_order?.message}>
                <input id="pt-sort" type="number" min="0" className={inputClass} {...form.register('sort_order')} />
              </Field>
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Проверка**

Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: без ошибок; в выводе build есть маршруты `/attributes`, `/price-types`.

- [ ] **Step 5: Коммит**

```bash
git add admin/src/lib/catalogTypes.ts admin/src/components/Sidebar.tsx admin/src/app/attributes admin/src/app/price-types
git commit -m "feat(admin): grouped sidebar, attributes and price types screens"
```

---

### Task 12: Группы каталога — список и карточка

**Files:**
- Create: `admin/src/lib/text.ts`
- Create: `admin/src/app/catalog-groups/page.tsx`, `admin/src/app/catalog-groups/[id]/page.tsx`

**Interfaces:**
- Consumes: API Task 3; `GET /api/admin/products?filter[search]=` и `GET /api/admin/users?filter[search]=` (существуют) для `EntityPicker`; компоненты Tasks 8–10.
- Produces: `@/lib/text`: `type Translatable = string | { ru?: string; kk?: string } | null | undefined`, `ru(value: Translatable): string`; `type ProductRef = { id: number; name: Translatable; code: string | null; article: string | null }`, `productLabel(p: ProductRef): string` (`«Имя · артикул»`); `type ClientRef = { id: number; company_name: string | null; email: string | null; phone: string | null }`, `clientLabel(c: ClientRef): string`.

- [ ] **Step 1: Текстовые хелперы**

`admin/src/lib/text.ts`:

```ts
export type Translatable = string | { ru?: string; kk?: string } | null | undefined;

/** The Russian text of a translatable column, whichever shape the API sent. */
export const ru = (value: Translatable): string => (typeof value === 'string' ? value : value?.ru ?? '');

export type ProductRef = { id: number; name: Translatable; code: string | null; article: string | null };

export const productLabel = (p: ProductRef): string =>
  [ru(p.name) || `#${p.id}`, p.article || p.code].filter(Boolean).join(' · ');

export type ClientRef = { id: number; company_name: string | null; email: string | null; phone: string | null };

export const clientLabel = (c: ClientRef): string =>
  [c.company_name || `Клиент #${c.id}`, c.phone || c.email].filter(Boolean).join(' · ');
```

- [ ] **Step 2: Список групп**

`admin/src/app/catalog-groups/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { REQUIRED } from '@/lib/validation';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

type CatalogGroup = { id: number; name: string; products_count: number; users_count: number };

const schema = z.object({ name: z.string().min(1, REQUIRED).max(255) });

export default function CatalogGroupsPage() {
  const router = useRouter();
  const groups = useResource<CatalogGroup>('/admin/catalog-groups');
  const [creating, setCreating] = useState(false);

  const columns: Column<CatalogGroup>[] = [
    {
      key: 'name',
      header: 'Название',
      render: (g) => (
        <Link href={`/catalog-groups/${g.id}`} className="font-medium text-zinc-900 hover:text-blue-700">
          {g.name}
        </Link>
      ),
    },
    { key: 'products', header: 'Товаров', render: (g) => g.products_count },
    { key: 'users', header: 'Клиентов', render: (g) => g.users_count },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (g) => (
        <div className="flex justify-end gap-4">
          <Link href={`/catalog-groups/${g.id}`} className={buttonLink}>Открыть</Link>
          <ConfirmButton onConfirm={() => groups.remove(g.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Группы каталога"
        actions={<button type="button" className={buttonPrimary} onClick={() => setCreating(true)}>Добавить группу</button>}
      />
      <p className="mb-4 text-sm text-zinc-500">
        Товар в любой группе пропадает с витрины и виден только B2B-клиентам этой группы.
      </p>
      <DataTable columns={columns} rows={groups.items} loading={groups.loading} emptyText="Групп пока нет" />

      {creating && (
        <CrudModal
          title="Новая группа"
          schema={schema}
          defaultValues={{ name: '' }}
          onSubmit={async (values) => {
            const group = await groups.create(values);
            router.push(`/catalog-groups/${group.id}`);
          }}
          onClose={() => setCreating(false)}
        >
          {(form) => (
            <Field label="Название *" htmlFor="group-name" error={form.formState.errors.name?.message}>
              <input id="group-name" className={inputClass} {...form.register('name')} />
            </Field>
          )}
        </CrudModal>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Карточка группы**

`admin/src/app/catalog-groups/[id]/page.tsx`:

```tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import api from '@/lib/api';
import { clientLabel, productLabel, type ClientRef, type ProductRef } from '@/lib/text';
import { REQUIRED } from '@/lib/validation';
import { toast } from '@/stores/toastStore';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EntityPicker from '@/components/ui/EntityPicker';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import { buttonSecondary, inputClass } from '@/components/ui/styles';

type GroupDetail = { id: number; name: string; products: ProductRef[]; users: ClientRef[] };

const schema = z.object({ name: z.string().min(1, REQUIRED).max(255) });

export default function CatalogGroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const base = `/admin/catalog-groups/${id}`;
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [renaming, setRenaming] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<{ data: GroupDetail }>(base);
    setGroup(res.data.data);
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = async (request: Promise<unknown>, message: string) => {
    await request;
    toast.success(message);
    await load();
  };

  if (!group) {
    return <div className="text-zinc-500">Загрузка…</div>;
  }

  const productColumns: Column<ProductRef>[] = [
    { key: 'name', header: 'Товар', render: (p) => productLabel(p) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (p) => (
        <ConfirmButton question="Убрать товар из группы? Он вернётся на витрину, если не состоит в других группах." onConfirm={() => change(api.delete(`${base}/products/${p.id}`), 'Товар убран из группы')}>
          Убрать
        </ConfirmButton>
      ),
    },
  ];

  const clientColumns: Column<ClientRef>[] = [
    { key: 'name', header: 'Клиент', render: (c) => clientLabel(c) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <ConfirmButton question="Убрать клиента из группы?" onConfirm={() => change(api.delete(`${base}/users/${c.id}`), 'Клиент убран из группы')}>
          Убрать
        </ConfirmButton>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={group.name}
        back="/catalog-groups"
        actions={
          <>
            <button type="button" className={buttonSecondary} onClick={() => setRenaming(true)}>Переименовать</button>
            <ConfirmButton
              question="Удалить группу? Её товары вернутся на витрину."
              onConfirm={async () => {
                await api.delete(base);
                toast.success('Группа удалена');
                router.push('/catalog-groups');
              }}
            >
              Удалить группу
            </ConfirmButton>
          </>
        }
      />

      <Tabs
        tabs={[
          {
            key: 'products',
            label: `Товары (${group.products.length})`,
            content: (
              <div className="space-y-4">
                <EntityPicker<ProductRef>
                  searchPath="/admin/products"
                  placeholder="Найти товар по названию или коду"
                  label={productLabel}
                  excludeIds={group.products.map((p) => p.id)}
                  onPick={(p) => change(api.post(`${base}/products/${p.id}`), 'Товар добавлен в группу')}
                />
                <DataTable columns={productColumns} rows={group.products} emptyText="В группе нет товаров" />
              </div>
            ),
          },
          {
            key: 'users',
            label: `Клиенты (${group.users.length})`,
            content: (
              <div className="space-y-4">
                <EntityPicker<ClientRef>
                  searchPath="/admin/users"
                  placeholder="Найти B2B-клиента по компании, БИН, телефону"
                  label={clientLabel}
                  excludeIds={group.users.map((c) => c.id)}
                  onPick={(c) => change(api.post(`${base}/users/${c.id}`), 'Клиент добавлен в группу')}
                />
                <DataTable columns={clientColumns} rows={group.users} emptyText="В группе нет клиентов" />
              </div>
            ),
          },
        ]}
      />

      {renaming && (
        <CrudModal
          title="Переименовать группу"
          schema={schema}
          defaultValues={{ name: group.name }}
          onSubmit={async (values) => {
            await api.put(base, values);
            await load();
          }}
          onClose={() => setRenaming(false)}
        >
          {(form) => (
            <Field label="Название *" htmlFor="group-name" error={form.formState.errors.name?.message}>
              <input id="group-name" className={inputClass} {...form.register('name')} />
            </Field>
          )}
        </CrudModal>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Проверка**

Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: без ошибок.

- [ ] **Step 5: Коммит**

```bash
git add admin/src/lib/text.ts admin/src/app/catalog-groups
git commit -m "feat(admin): catalog groups with product and client membership"
```

---

### Task 13: Подборки — список и карточка

**Files:**
- Create: `admin/src/components/collections/CollectionForm.tsx`
- Create: `admin/src/app/product-collections/page.tsx`, `admin/src/app/product-collections/[id]/page.tsx`

**Interfaces:**
- Consumes: API Task 4; `ru`, `productLabel`, `ProductRef` (Task 12); компоненты Tasks 8–10.
- Produces: `CollectionForm` — `collectionSchema` (zod), `type CollectionFormValues`, `toCollectionForm(c: Collection | null): CollectionFormValues`, `CollectionFields({ form })`; `type Collection = { id: number; title: { ru?: string; kk?: string }; slug: string; sort_order: number; is_active: boolean; products_count?: number }`.

- [ ] **Step 1: Общая форма подборки**

`admin/src/components/collections/CollectionForm.tsx`:

```tsx
'use client';

import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { SLUG_PATTERN, translatable } from '@/lib/validation';
import Field from '@/components/ui/Field';
import TranslatableField from '@/components/ui/TranslatableField';
import { inputClass } from '@/components/ui/styles';

export type Collection = {
  id: number;
  title: { ru?: string; kk?: string };
  slug: string;
  sort_order: number;
  is_active: boolean;
  products_count?: number;
};

export const collectionSchema = z.object({
  title: translatable,
  slug: z.string().regex(SLUG_PATTERN, 'Латиница в нижнем регистре, цифры и дефисы'),
  sort_order: z.string().regex(/^-?\d*$/, 'Целое число'),
  is_active: z.boolean(),
});

export type CollectionFormValues = z.infer<typeof collectionSchema>;

export const toCollectionForm = (c: Collection | null): CollectionFormValues => ({
  title: { ru: c?.title?.ru ?? '', kk: c?.title?.kk ?? '' },
  slug: c?.slug ?? '',
  sort_order: c ? String(c.sort_order) : '0',
  is_active: c?.is_active ?? true,
});

export function CollectionFields({ form }: { form: UseFormReturn<CollectionFormValues> }) {
  const { errors } = form.formState;

  return (
    <>
      <TranslatableField form={form} name="title" label="Заголовок" required />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Slug *" htmlFor="col-slug" error={errors.slug?.message}>
          <input id="col-slug" className={inputClass} {...form.register('slug')} />
        </Field>
        <Field label="Порядок" htmlFor="col-sort" error={errors.sort_order?.message}>
          <input id="col-sort" type="number" className={inputClass} {...form.register('sort_order')} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input type="checkbox" {...form.register('is_active')} />
        Показывать на витрине
      </label>
    </>
  );
}
```

- [ ] **Step 2: Список подборок**

`admin/src/app/product-collections/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useResource } from '@/lib/crud';
import { ru } from '@/lib/text';
import { CollectionFields, collectionSchema, toCollectionForm, type Collection } from '@/components/collections/CollectionForm';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary } from '@/components/ui/styles';

export default function ProductCollectionsPage() {
  const router = useRouter();
  const collections = useResource<Collection>('/admin/product-collections');
  const [creating, setCreating] = useState(false);

  const columns: Column<Collection>[] = [
    {
      key: 'title',
      header: 'Заголовок',
      render: (c) => (
        <Link href={`/product-collections/${c.id}`} className="font-medium text-zinc-900 hover:text-blue-700">
          {ru(c.title) || '—'}
        </Link>
      ),
    },
    { key: 'slug', header: 'Slug', render: (c) => c.slug },
    { key: 'products', header: 'Товаров', render: (c) => c.products_count ?? 0 },
    { key: 'sort', header: 'Порядок', render: (c) => c.sort_order },
    { key: 'active', header: 'Статус', render: (c) => (c.is_active ? 'Показана' : 'Скрыта') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <div className="flex justify-end gap-4">
          <Link href={`/product-collections/${c.id}`} className={buttonLink}>Открыть</Link>
          <ConfirmButton onConfirm={() => collections.remove(c.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Подборки"
        actions={<button type="button" className={buttonPrimary} onClick={() => setCreating(true)}>Добавить подборку</button>}
      />
      <DataTable columns={columns} rows={collections.items} loading={collections.loading} emptyText="Подборок пока нет" />

      {creating && (
        <CrudModal
          title="Новая подборка"
          schema={collectionSchema}
          defaultValues={toCollectionForm(null)}
          onSubmit={async (values) => {
            const collection = await collections.create(values);
            router.push(`/product-collections/${collection.id}`);
          }}
          onClose={() => setCreating(false)}
        >
          {(form) => <CollectionFields form={form} />}
        </CrudModal>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Карточка подборки**

`admin/src/app/product-collections/[id]/page.tsx`:

```tsx
'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { productLabel, ru, type ProductRef } from '@/lib/text';
import { toast } from '@/stores/toastStore';
import { CollectionFields, collectionSchema, toCollectionForm, type Collection } from '@/components/collections/CollectionForm';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EntityPicker from '@/components/ui/EntityPicker';
import PageHeader from '@/components/ui/PageHeader';
import { buttonSecondary, inputClass } from '@/components/ui/styles';

type CollectionProduct = ProductRef & { pivot: { sort_order: number } };
type CollectionDetail = Collection & { products: CollectionProduct[] };

export default function ProductCollectionPage() {
  const { id } = useParams<{ id: string }>();
  const base = `/admin/product-collections/${id}`;
  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<{ data: CollectionDetail }>(base);
    setCollection(res.data.data);
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const place = async (productId: number, sortOrder: number, message?: string) => {
    await api.put(`${base}/products/${productId}`, { sort_order: sortOrder });
    if (message) {
      toast.success(message);
    }
    await load();
  };

  if (!collection) {
    return <div className="text-zinc-500">Загрузка…</div>;
  }

  const nextOrder = Math.max(0, ...collection.products.map((p) => p.pivot.sort_order)) + 1;

  const columns: Column<CollectionProduct>[] = [
    {
      key: 'order',
      header: 'Порядок',
      className: 'w-28',
      render: (p) => (
        <input
          type="number"
          aria-label={`Порядок: ${productLabel(p)}`}
          defaultValue={p.pivot.sort_order}
          className={inputClass}
          onBlur={(e) => {
            const value = Number(e.target.value);
            if (Number.isInteger(value) && value !== p.pivot.sort_order) {
              void place(p.id, value, 'Порядок сохранён');
            }
          }}
        />
      ),
    },
    { key: 'name', header: 'Товар', render: (p) => productLabel(p) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (p) => (
        <ConfirmButton
          question="Убрать товар из подборки?"
          onConfirm={async () => {
            await api.delete(`${base}/products/${p.id}`);
            toast.success('Товар убран из подборки');
            await load();
          }}
        >
          Убрать
        </ConfirmButton>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={ru(collection.title) || 'Подборка'}
        back="/product-collections"
        actions={<button type="button" className={buttonSecondary} onClick={() => setEditing(true)}>Изменить</button>}
      />
      <EntityPicker<ProductRef>
        searchPath="/admin/products"
        placeholder="Добавить товар: название или код"
        label={productLabel}
        excludeIds={collection.products.map((p) => p.id)}
        onPick={(p) => place(p.id, nextOrder, 'Товар добавлен')}
      />
      <DataTable
        columns={columns}
        rows={collection.products}
        emptyText="В подборке нет товаров"
        rowKey={(p) => `${p.id}-${p.pivot.sort_order}`}
      />

      {editing && (
        <CrudModal
          title="Изменить подборку"
          schema={collectionSchema}
          defaultValues={toCollectionForm(collection)}
          onSubmit={async (values) => {
            await api.put(base, values);
            await load();
          }}
          onClose={() => setEditing(false)}
        >
          {(form) => <CollectionFields form={form} />}
        </CrudModal>
      )}
    </div>
  );
}
```

`rowKey` включает `sort_order`, чтобы неуправляемый `input` пересоздавался после перезагрузки с новым порядком.

- [ ] **Step 4: Проверка**

Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: без ошибок.

- [ ] **Step 5: Коммит**

```bash
git add admin/src/components/collections admin/src/app/product-collections
git commit -m "feat(admin): product collections with ordered products"
```

---

### Task 14: Карточка товара — вкладки медиа, цен, атрибутов, вариантов

**Files:**
- Create: `admin/src/components/products/ProductRelations.tsx`, `MediaTab.tsx`, `PricesTab.tsx`, `ClientPricesTab.tsx`, `AttributeValuesTab.tsx`, `VariantsTab.tsx`
- Modify: `admin/src/app/products/[id]/page.tsx`

**Interfaces:**
- Consumes: API Tasks 5–7; `PriceType`, `Attribute` (Task 11, `@/lib/catalogTypes`); `ClientRef`, `clientLabel` (Task 12); `tiynToTenge`, `formatTenge`, `TENGE_PATTERN` (Task 8); компоненты Tasks 8–10.
- Produces: `ProductRelations({ productId: number })` — `Tabs` с ключами `media` («Фото»), `prices` («Цены»), `client-prices` («Цены клиентов»), `attributes` («Характеристики»), `variants` («Варианты»). Каждая вкладка — `XxxTab({ productId: number })`.

- [ ] **Step 2: Фото**

`admin/src/components/products/MediaTab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { useResource } from '@/lib/crud';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/stores/toastStore';
import ConfirmButton from '@/components/ui/ConfirmButton';
import { buttonSecondary } from '@/components/ui/styles';

type Image = { id: number; file_name: string; url: string; thumb_url: string; order: number | null };

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

export default function MediaTab({ productId }: { productId: number }) {
  const path = `/admin/products/${productId}/media`;
  const images = useResource<Image>(path);
  const [uploading, setUploading] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files) {
      return;
    }

    setUploading(true);

    for (const file of Array.from(files)) {
      // Same limits as the server; checked first so a 30 MB photo fails instantly.
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`${file.name}: только JPEG, PNG или WebP`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: больше 10 МБ`);
        continue;
      }

      const body = new FormData();
      body.append('file', file);

      try {
        await api.post(path, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      } catch (error) {
        toast.error(serverMessage(error) ?? `${file.name}: не загрузилось`);
      }
    }

    setUploading(false);
    await images.reload();
  };

  const move = async (index: number, delta: -1 | 1) => {
    const ids = images.items.map((i) => i.id);
    const target = index + delta;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await api.put(`${path}/order`, { ids });
    await images.reload();
  };

  return (
    <div className="space-y-4">
      <label className={`${buttonSecondary} cursor-pointer`}>
        {uploading ? 'Загрузка…' : 'Загрузить фото'}
        <input
          type="file"
          multiple
          accept={ACCEPTED.join(',')}
          className="sr-only"
          disabled={uploading}
          aria-label="Загрузить фото"
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {images.loading ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : images.items.length === 0 ? (
        <p className="text-sm text-zinc-500">Фото нет. Первое фото — главное на витрине.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {images.items.map((image, index) => (
            <li key={image.id} className="overflow-hidden rounded-lg border border-zinc-200" data-testid="product-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.thumb_url} alt={image.file_name} className="aspect-square w-full object-cover" />
              <div className="flex items-center justify-between gap-2 p-2 text-xs">
                <div className="flex gap-1">
                  <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Раньше" className="px-2 disabled:opacity-30">←</button>
                  <button type="button" disabled={index === images.items.length - 1} onClick={() => move(index, 1)} aria-label="Позже" className="px-2 disabled:opacity-30">→</button>
                </div>
                <ConfirmButton question="Удалить фото?" onConfirm={() => images.remove(image.id)}>Удалить</ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Цены по типам**

`admin/src/components/products/PricesTab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { z } from 'zod';
import type { PriceType } from '@/lib/catalogTypes';
import { useResource } from '@/lib/crud';
import { formatTenge, TENGE_PATTERN, tiynToTenge } from '@/lib/money';
import { REQUIRED } from '@/lib/validation';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import MoneyInput from '@/components/ui/MoneyInput';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

type Price = { id: number; price_type_id: number; price: number; price_type: PriceType };

const schema = z.object({
  price_type_id: z.string().min(1, REQUIRED),
  price: z.string().regex(TENGE_PATTERN, 'Сумма в ₸, до двух знаков после точки'),
});

export default function PricesTab({ productId }: { productId: number }) {
  const prices = useResource<Price>(`/admin/products/${productId}/prices`);
  const types = useResource<PriceType>('/admin/price-types');
  const [editing, setEditing] = useState<Price | null | undefined>(undefined);

  const columns: Column<Price>[] = [
    { key: 'type', header: 'Тип цены', render: (p) => p.price_type?.name ?? `#${p.price_type_id}` },
    { key: 'price', header: 'Цена', render: (p) => formatTenge(p.price) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (p) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(p)}>Изменить</button>
          <ConfirmButton onConfirm={() => prices.remove(p.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить цену</button>
      <DataTable columns={columns} rows={prices.items} loading={prices.loading} emptyText="Цен по типам нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить цену' : 'Новая цена'}
          schema={schema}
          defaultValues={{ price_type_id: editing ? String(editing.price_type_id) : '', price: tiynToTenge(editing?.price) }}
          onSubmit={(values) => (editing ? prices.update(editing.id, values) : prices.create(values))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => (
            <>
              <Field label="Тип цены *" htmlFor="price-type" error={form.formState.errors.price_type_id?.message}>
                <select id="price-type" className={inputClass} {...form.register('price_type_id')}>
                  <option value="">Выберите тип</option>
                  {types.items.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Цена, ₸ *" htmlFor="price-value" error={form.formState.errors.price?.message}>
                <MoneyInput id="price-value" {...form.register('price')} />
              </Field>
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Цены клиентов**

`admin/src/components/products/ClientPricesTab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { formatTenge, TENGE_PATTERN, tiynToTenge } from '@/lib/money';
import { clientLabel, type ClientRef } from '@/lib/text';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EntityPicker from '@/components/ui/EntityPicker';
import Field from '@/components/ui/Field';
import MoneyInput from '@/components/ui/MoneyInput';
import { buttonLink, buttonPrimary } from '@/components/ui/styles';

type ClientPrice = { id: number; user_id: number; price: number; user: ClientRef };

const schema = z.object({
  user_id: z.string().min(1, 'Выберите клиента'),
  price: z.string().regex(TENGE_PATTERN, 'Сумма в ₸, до двух знаков после точки'),
});

export default function ClientPricesTab({ productId }: { productId: number }) {
  const prices = useResource<ClientPrice>(`/admin/products/${productId}/client-prices`);
  const [editing, setEditing] = useState<ClientPrice | null | undefined>(undefined);
  const [picked, setPicked] = useState<ClientRef | null>(null);

  const close = () => {
    setEditing(undefined);
    setPicked(null);
  };

  const columns: Column<ClientPrice>[] = [
    { key: 'client', header: 'Клиент', render: (p) => clientLabel(p.user) },
    { key: 'price', header: 'Цена', render: (p) => formatTenge(p.price) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (p) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(p)}>Изменить</button>
          <ConfirmButton onConfirm={() => prices.remove(p.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить цену клиента</button>
      <DataTable columns={columns} rows={prices.items} loading={prices.loading} emptyText="Персональных цен нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить цену клиента' : 'Новая цена клиента'}
          schema={schema}
          defaultValues={{ user_id: editing ? String(editing.user_id) : '', price: tiynToTenge(editing?.price) }}
          onSubmit={(values) => (editing ? prices.update(editing.id, values) : prices.create(values))}
          onClose={close}
        >
          {(form) => (
            <>
              <Field label="Клиент *" error={form.formState.errors.user_id?.message}>
                {editing ? (
                  <p className="text-sm text-zinc-900">{clientLabel(editing.user)}</p>
                ) : picked ? (
                  <p className="text-sm text-zinc-900">
                    {clientLabel(picked)}{' '}
                    <button
                      type="button"
                      className={buttonLink}
                      onClick={() => {
                        setPicked(null);
                        form.setValue('user_id', '');
                      }}
                    >
                      сменить
                    </button>
                  </p>
                ) : (
                  <EntityPicker<ClientRef>
                    searchPath="/admin/users"
                    placeholder="Найти B2B-клиента"
                    label={clientLabel}
                    excludeIds={prices.items.map((p) => p.user_id)}
                    onPick={(c) => {
                      setPicked(c);
                      form.setValue('user_id', String(c.id), { shouldValidate: true });
                    }}
                  />
                )}
              </Field>
              <Field label="Цена, ₸ *" htmlFor="client-price" error={form.formState.errors.price?.message}>
                <MoneyInput id="client-price" {...form.register('price')} />
              </Field>
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Характеристики**

`admin/src/components/products/AttributeValuesTab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { z } from 'zod';
import type { Attribute } from '@/lib/catalogTypes';
import { useResource } from '@/lib/crud';
import { REQUIRED } from '@/lib/validation';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

type AttributeValue = { id: number; attribute_id: number; value: string; attribute: Pick<Attribute, 'id' | 'name' | 'slug'> };

const schema = z.object({
  attribute_id: z.string().min(1, REQUIRED),
  value: z.string().min(1, REQUIRED).max(255),
});

export default function AttributeValuesTab({ productId }: { productId: number }) {
  const values = useResource<AttributeValue>(`/admin/products/${productId}/attribute-values`);
  const attributes = useResource<Attribute>('/admin/attributes');
  const [editing, setEditing] = useState<AttributeValue | null | undefined>(undefined);

  const columns: Column<AttributeValue>[] = [
    { key: 'attribute', header: 'Атрибут', render: (v) => v.attribute?.name ?? `#${v.attribute_id}` },
    { key: 'value', header: 'Значение', render: (v) => v.value },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (v) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(v)}>Изменить</button>
          <ConfirmButton onConfirm={() => values.remove(v.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить характеристику</button>
      <DataTable columns={columns} rows={values.items} loading={values.loading} emptyText="Характеристик нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить характеристику' : 'Новая характеристика'}
          schema={schema}
          defaultValues={{ attribute_id: editing ? String(editing.attribute_id) : '', value: editing?.value ?? '' }}
          onSubmit={(v) => (editing ? values.update(editing.id, v) : values.create(v))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => (
            <>
              <Field label="Атрибут *" htmlFor="av-attribute" error={form.formState.errors.attribute_id?.message}>
                <select id="av-attribute" className={inputClass} {...form.register('attribute_id')}>
                  <option value="">Выберите атрибут</option>
                  {attributes.items.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Значение *" htmlFor="av-value" error={form.formState.errors.value?.message}>
                <input id="av-value" className={inputClass} {...form.register('value')} />
              </Field>
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Варианты**

`admin/src/components/products/VariantsTab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { formatTenge, TENGE_PATTERN, tiynToTenge } from '@/lib/money';
import { REQUIRED } from '@/lib/validation';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import MoneyInput from '@/components/ui/MoneyInput';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

type Variant = {
  id: number;
  name: string;
  code: string | null;
  retail_price: number | null;
  b2b_price: number | null;
  stock: string;
  barcodes: string[] | null;
  characteristics: Record<string, string> | null;
};

const optionalTenge = z.string().refine((v) => v === '' || TENGE_PATTERN.test(v), 'Сумма в ₸, до двух знаков после точки');

const schema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  code: z.string().max(255),
  retail_price: optionalTenge,
  b2b_price: optionalTenge,
  barcodes: z.string(),
  characteristics: z.string().refine(
    (v) => v.split('\n').every((line) => line.trim() === '' || line.includes(':')),
    'Каждая строка — «Название: значение»',
  ),
});

type VariantForm = z.infer<typeof schema>;

const toForm = (v: Variant | null): VariantForm => ({
  name: v?.name ?? '',
  code: v?.code ?? '',
  retail_price: tiynToTenge(v?.retail_price),
  b2b_price: tiynToTenge(v?.b2b_price),
  barcodes: (v?.barcodes ?? []).join('\n'),
  characteristics: Object.entries(v?.characteristics ?? {})
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n'),
});

/** Textareas are one-per-line; the API takes an array and an object. */
const toPayload = (f: VariantForm) => ({
  name: f.name,
  code: f.code,
  retail_price: f.retail_price,
  b2b_price: f.b2b_price,
  barcodes: f.barcodes.split('\n').map((s) => s.trim()).filter(Boolean),
  characteristics: Object.fromEntries(
    f.characteristics
      .split('\n')
      .filter((line) => line.includes(':'))
      .map((line) => {
        const at = line.indexOf(':');
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
      }),
  ),
});

export default function VariantsTab({ productId }: { productId: number }) {
  const variants = useResource<Variant>(`/admin/products/${productId}/variants`);
  const [editing, setEditing] = useState<Variant | null | undefined>(undefined);

  const columns: Column<Variant>[] = [
    { key: 'name', header: 'Вариант', render: (v) => <span className="font-medium text-zinc-900">{v.name}</span> },
    { key: 'code', header: 'Код', render: (v) => v.code ?? '—' },
    { key: 'retail', header: 'Розница', render: (v) => formatTenge(v.retail_price) },
    { key: 'b2b', header: 'Опт', render: (v) => formatTenge(v.b2b_price) },
    { key: 'stock', header: 'Остаток', render: (v) => Number(v.stock) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (v) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(v)}>Изменить</button>
          <ConfirmButton onConfirm={() => variants.remove(v.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить вариант</button>
      <DataTable columns={columns} rows={variants.items} loading={variants.loading} emptyText="Вариантов нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить вариант' : 'Новый вариант'}
          schema={schema}
          defaultValues={toForm(editing)}
          onSubmit={(f) => (editing ? variants.update(editing.id, toPayload(f)) : variants.create(toPayload(f)))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => {
            const { errors } = form.formState;
            return (
              <>
                <Field label="Название *" htmlFor="v-name" error={errors.name?.message}>
                  <input id="v-name" className={inputClass} {...form.register('name')} />
                </Field>
                <Field label="Код" htmlFor="v-code" error={errors.code?.message}>
                  <input id="v-code" className={inputClass} {...form.register('code')} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Розничная цена, ₸" htmlFor="v-retail" error={errors.retail_price?.message}>
                    <MoneyInput id="v-retail" {...form.register('retail_price')} />
                  </Field>
                  <Field label="Оптовая цена, ₸" htmlFor="v-b2b" error={errors.b2b_price?.message}>
                    <MoneyInput id="v-b2b" {...form.register('b2b_price')} />
                  </Field>
                </div>
                <Field label="Штрихкоды" htmlFor="v-barcodes" hint="По одному на строку" error={errors.barcodes?.message}>
                  <textarea id="v-barcodes" rows={2} className={inputClass} {...form.register('barcodes')} />
                </Field>
                <Field label="Характеристики" htmlFor="v-chars" hint="«Цвет: Серый» — по одной на строку" error={errors.characteristics?.message}>
                  <textarea id="v-chars" rows={3} className={inputClass} {...form.register('characteristics')} />
                </Field>
                <p className="text-xs text-zinc-500">Остаток варианта здесь не меняется — только приёмками и заказами.</p>
              </>
            );
          }}
        </CrudModal>
      )}
    </div>
  );
}
```

Ошибки сервера по `barcodes.0` / `characteristics.X` не совпадут с полями формы — `applyServerErrors` поставит их на несуществующие пути. Это допустимо: клиентская валидация ловит формат раньше, а лимиты (64/255 символов) на практике не достигаются.

- [ ] **Step 7: Контейнер вкладок**

`admin/src/components/products/ProductRelations.tsx`:

```tsx
'use client';

import Tabs from '@/components/ui/Tabs';
import AttributeValuesTab from './AttributeValuesTab';
import ClientPricesTab from './ClientPricesTab';
import MediaTab from './MediaTab';
import PricesTab from './PricesTab';
import VariantsTab from './VariantsTab';

export default function ProductRelations({ productId }: { productId: number }) {
  return (
    <Tabs
      tabs={[
        { key: 'media', label: 'Фото', content: <MediaTab productId={productId} /> },
        { key: 'prices', label: 'Цены', content: <PricesTab productId={productId} /> },
        { key: 'client-prices', label: 'Цены клиентов', content: <ClientPricesTab productId={productId} /> },
        { key: 'attributes', label: 'Характеристики', content: <AttributeValuesTab productId={productId} /> },
        { key: 'variants', label: 'Варианты', content: <VariantsTab productId={productId} /> },
      ]}
    />
  );
}
```

`Tabs` рендерит только активную вкладку, поэтому данные каждой грузятся при первом открытии.

- [ ] **Step 8: Страница товара**

В `admin/src/app/products/[id]/page.tsx`:

1. Удалить локальный `kopecksToTenge` вместе с его docblock; добавить импорты:

```tsx
import { tiynToTenge } from '@/lib/money';
import ProductRelations from '@/components/products/ProductRelations';
```

и заменить все `kopecksToTenge(` на `tiynToTenge(`.

2. Удалить состояния `images` / `currentMedia`, строку `setCurrentMedia(p.media || []);` и цикл `images.forEach((img) => { data.append('images[]', img); });`.

3. После успешного сохранения нового товара вести на его карточку, чтобы сразу добавить фото и цены — заменить блок `if (res.status === 200 || res.status === 201) { router.push('/products'); }` на:

```tsx
      if (isCreate && res.status === 201) {
        router.push(`/products/${res.data.data.id}`);
      } else if (res.status === 200) {
        router.push('/products');
      }
```

4. Заменить весь блок `{/* ----------------------------------------------------------- Media */}` (от этого комментария до закрывающего `</div>` секции перед блоком кнопок) на:

```tsx
          {isCreate && (
            <p className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
              Фото, цены по типам, цены клиентов, характеристики и варианты появятся после сохранения товара.
            </p>
          )}
```

5. После закрывающего `</form>` (внутри `max-w-4xl` контейнера) добавить:

```tsx
        {!isCreate && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-12">
            <ProductRelations productId={Number(id)} />
          </div>
        )}
```

- [ ] **Step 9: Проверка**

Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: без ошибок. `grep -n "images\|kopecksToTenge\|currentMedia" admin/src/app/products/\[id\]/page.tsx` — пусто.

- [ ] **Step 10: Коммит**

```bash
git add admin/src/components/products admin/src/app/products/\[id\]/page.tsx
git commit -m "feat(admin): product tabs for photos, prices, client prices, attributes and variants"
```

---

### Task 15: E2E-спеки этапа 1

**Files:**
- Create: `admin/e2e/assets/pixel.png`
- Create: `admin/e2e/attributes.spec.ts`, `admin/e2e/catalog-groups.spec.ts`, `admin/e2e/product-relations.spec.ts`

**Interfaces:**
- Consumes: `ADMIN_SESSION` (`./session`), `requireB2bClient()`, `requireInStockProduct()` (`./fixtures`); подписи и тексты кнопок из Tasks 9–14.
- Produces: три спеки; каждая за собой убирает (удаляет созданное), чтобы не влиять на параллельные тесты витрины и B2B.

Порядок запуска — как в `docs/e2e-runbook.md`: сначала `php artisan mvp:acceptance --fresh --fixtures` (в docker — с `--no-interaction`), потом Playwright.

- [ ] **Step 1: Картинка для загрузки**

```bash
mkdir -p admin/e2e/assets
node -e "require('fs').writeFileSync('admin/e2e/assets/pixel.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))"
```

- [ ] **Step 2: Атрибуты**

`admin/e2e/attributes.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { ADMIN_SESSION } from "./session";

/**
 * Атрибуты — первый экран на общих компонентах: форма в модалке, клиентская
 * валидация, ошибка сервера под полем, удаление с подтверждением.
 */
test.use({ storageState: ADMIN_SESSION });

test.beforeEach(({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

test("атрибут создаётся, правится и удаляется", async ({ page }) => {
  const slug = `e2e-attr-${Date.now()}`;

  await page.goto("/attributes");
  await page.getByRole("button", { name: "Добавить атрибут" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Название *").fill("E2E цвет");
  await dialog.getByLabel("Slug *").fill("Bad Slug");
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog.getByText("Латиница в нижнем регистре, цифры и дефисы")).toBeVisible();

  await dialog.getByLabel("Slug *").fill(slug);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();

  const row = page.locator("tbody tr").filter({ hasText: slug });
  await expect(row).toContainText("E2E цвет");

  await row.getByRole("button", { name: "Изменить" }).click();
  await dialog.getByLabel("Название *").fill("E2E цвет обивки");
  await dialog.getByLabel("Показывать в фильтрах витрины").check();
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(row).toContainText("E2E цвет обивки");
  await expect(row).toContainText("Да");

  await row.getByRole("button", { name: "Удалить" }).click();
  await expect(page.locator("tbody tr").filter({ hasText: slug })).toHaveCount(0);
});

test("занятый slug возвращается ошибкой под полем", async ({ page }) => {
  const slug = `e2e-dup-${Date.now()}`;
  const dialog = page.getByRole("dialog");

  await page.goto("/attributes");

  for (const attempt of [1, 2]) {
    await page.getByRole("button", { name: "Добавить атрибут" }).click();
    await dialog.getByLabel("Название *").fill(`E2E дубль ${attempt}`);
    await dialog.getByLabel("Slug *").fill(slug);
    await dialog.getByRole("button", { name: "Сохранить" }).click();
  }

  // Вторая попытка: модалка осталась, у поля slug — текст ошибки от Laravel.
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toBeVisible();

  await dialog.getByRole("button", { name: "Отмена" }).click();
  await page.locator("tbody tr").filter({ hasText: slug }).getByRole("button", { name: "Удалить" }).click();
  await expect(page.locator("tbody tr").filter({ hasText: slug })).toHaveCount(0);
});
```

- [ ] **Step 3: Группы каталога**

`admin/e2e/catalog-groups.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { requireB2bClient } from "./fixtures";
import { ADMIN_SESSION } from "./session";

/**
 * Группа каталога: создать, привязать клиента, отвязать, удалить.
 *
 * Товары в группу здесь не добавляются намеренно: товар в группе пропадает с
 * витрины, а тесты storefront/ идут параллельно на тех же фикстурах. Пустая
 * группа с клиентом ничью видимость не меняет.
 */
test.use({ storageState: ADMIN_SESSION });

test("клиент добавляется в группу и убирается из неё", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());

  const client = requireB2bClient();
  const name = `E2E группа ${Date.now()}`;
  const query = client.company_name ?? client.phone;

  await page.goto("/catalog-groups");
  await page.getByRole("button", { name: "Добавить группу" }).click();
  await page.getByRole("dialog").getByLabel("Название *").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Сохранить" }).click();

  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.getByRole("tab", { name: /Клиенты/ }).click();
  await page.getByLabel("Найти B2B-клиента по компании, БИН, телефону").fill(query);
  await page.getByRole("option").filter({ hasText: query }).first().click();

  const tabpanel = page.getByRole("tabpanel");
  await expect(tabpanel.locator("tbody tr").filter({ hasText: query })).toHaveCount(1);
  await expect(page.getByRole("tab", { name: "Клиенты (1)" })).toBeVisible();

  await tabpanel.locator("tbody tr").filter({ hasText: query }).getByRole("button", { name: "Убрать" }).click();
  await expect(page.getByRole("tab", { name: "Клиенты (0)" })).toBeVisible();

  await page.getByRole("button", { name: "Удалить группу" }).click();
  await expect(page).toHaveURL(/\/catalog-groups$/);
  await expect(page.locator("tbody tr").filter({ hasText: name })).toHaveCount(0);
});
```

- [ ] **Step 4: Вкладки товара**

`admin/e2e/product-relations.spec.ts`:

```ts
import path from "node:path";
import { test, expect } from "@playwright/test";
import { requireInStockProduct } from "./fixtures";
import { ADMIN_SESSION } from "./session";

/**
 * Вкладки карточки товара: фото и цены по типам. Всё созданное удаляется в
 * конце теста. Тип цены заводится свой, со случайным кодом, — существующие
 * retail/b2b не трогаются, так что цена на витрине не меняется.
 */
test.use({ storageState: ADMIN_SESSION });

test.beforeEach(({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

test("фото загружается в товар и удаляется", async ({ page }) => {
  const product = requireInStockProduct();

  await page.goto(`/products/${product.id}`);
  await page.getByRole("tab", { name: "Фото" }).click();

  const images = page.getByTestId("product-image");
  const before = await images.count();

  await page.getByLabel("Загрузить фото").setInputFiles(path.join(__dirname, "assets/pixel.png"));
  await expect(images).toHaveCount(before + 1);

  await images.last().getByRole("button", { name: "Удалить" }).click();
  await expect(images).toHaveCount(before);
});

test("цена по своему типу добавляется, показывается в ₸ и удаляется", async ({ page }) => {
  const product = requireInStockProduct();
  const stamp = Date.now();
  const typeName = `E2E тип ${stamp}`;
  const dialog = page.getByRole("dialog");

  await page.goto("/price-types");
  await page.getByRole("button", { name: "Добавить тип цены" }).click();
  await dialog.getByLabel("Название *").fill(typeName);
  await dialog.getByLabel("Код *").fill(`e2e_${stamp}`);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();

  await page.goto(`/products/${product.id}`);
  await page.getByRole("tab", { name: "Цены", exact: true }).click();
  await page.getByRole("button", { name: "Добавить цену" }).click();
  await dialog.getByLabel("Тип цены *").selectOption({ label: typeName });
  await dialog.getByLabel("Цена, ₸ *").fill("1234.5");
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  const row = page.getByRole("tabpanel").locator("tbody tr").filter({ hasText: typeName });
  // toLocaleString('ru-RU') разделяет тысячи неразрывным пробелом.
  await expect(row).toContainText(/1\s234,5 ₸/);

  await row.getByRole("button", { name: "Удалить" }).click();
  await expect(row).toHaveCount(0);

  await page.goto("/price-types");
  await page.locator("tbody tr").filter({ hasText: typeName }).getByRole("button", { name: "Удалить" }).click();
  await expect(page.locator("tbody tr").filter({ hasText: typeName })).toHaveCount(0);
});
```

- [ ] **Step 5: Прогон**

```bash
php artisan mvp:acceptance --fresh --fixtures
cd admin && npx playwright test
```

Expected: все спеки `admin/e2e` зелёные, включая старые `orders`, `products`, `stock`. При падении — смотреть `npx playwright show-report`; если локаторы расходятся с реальной разметкой, чинить компонент (подписи/роли), а не ослаблять проверку.

- [ ] **Step 6: Коммит**

```bash
git add admin/e2e/assets admin/e2e/attributes.spec.ts admin/e2e/catalog-groups.spec.ts admin/e2e/product-relations.spec.ts
git commit -m "test(admin-e2e): attributes, catalog groups and product tabs"
```

---

### Task 16: Итоговая проверка, спек и документация

**Files:**
- Modify: `docs/superpowers/specs/2026-09-17-admin-catalog-migration-design.md`
- Modify: `CLAUDE.md` (раздел «Two admin panels, split by job»)

**Interfaces:**
- Consumes: всё выше.

- [ ] **Step 1: Форматирование и полный PHP-набор**

```bash
vendor/bin/pint --dirty --format agent
php artisan route:clear
STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact
```

Expected: всё зелёное (Filament-тесты тоже — Filament ещё на месте).

- [ ] **Step 2: Сборка админки**

Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: без ошибок.

- [ ] **Step 3: Сверить спек с реализацией**

Пройтись по разделу 1 спека: если в ходе задач что-то отклонилось (имена полей, коды ответов), поправить спек, чтобы он описывал то, что в коде.

- [ ] **Step 4: CLAUDE.md**

В `CLAUDE.md`, раздел «Two admin panels, split by job», заменить два пункта на:

```markdown
- **`admin/` (Next.js)** — operational screens for managers: orders and status
  changes, products (with photos, prices by type, per-client prices,
  attributes, variants), read-only stock, B2B client approval, categories,
  brands, attributes, price types, catalog groups, product collections.
  Calls `/api/admin/*` (`auth:sanctum` + `role:admin|manager`). Shared UI lives
  in `admin/src/components/ui`, data access in `admin/src/lib/crud.ts`.
- **Filament (`/admin` on the API host)** — being retired stage by stage
  (`docs/superpowers/specs/2026-09-17-admin-catalog-migration-design.md`).
  Still the only place for goods receipts, warehouses (Stores), suppliers,
  CMS pages, banners, reviews, shorts, catalog settings and user editing.
  `admin/` links out to it (`ERP_ADMIN_URL` in `admin/src/lib/api.ts`).
```

- [ ] **Step 5: Коммит**

```bash
git add docs/superpowers/specs/2026-09-17-admin-catalog-migration-design.md CLAUDE.md
git commit -m "docs: catalog back-office now lives in admin/"
```

- [ ] **Step 6: Завершение ветки**

Проверить, что ни в одном коммите нет трейлеров: `git log main..HEAD --format=%B | grep -i "co-authored\|generated with"` — пусто. Дальше — superpowers:finishing-a-development-branch (PR / merge — по решению пользователя).
