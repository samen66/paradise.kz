# Admin Orders Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить список заказов админки в рабочее место: сегменты B2B/розница, вкладки по статусам со счётчиками, состояние в URL, смена статуса из строки, валидация переходов на API.

**Architecture:** API (`Api\Admin\OrderController::index`) получает фильтр `segment` (через `whereHas('user')` по `users.type`), разворот псевдостатуса `archived` в `whereIn(['synced','failed'])` и ключ `meta.status_counts`, посчитанный по тому же базовому запросу без фильтра статуса. `Order` получает матрицу переходов, `update` её проверяет. Фронт переписывается на общие компоненты админки (`ui/DataTable`, `ui/PageHeader`, `ui/styles`), состояние экрана переезжает в query-параметры, вкладки становятся `<Link>`.

**Tech Stack:** Laravel 13 / PHP 8.4, Spatie Query Builder, PHPUnit 12; Next.js 16 App Router, TypeScript, Tailwind 4, axios; Playwright для e2e админки.

**Spec:** `docs/superpowers/specs/2026-09-20-admin-orders-workspace-design.md`

## Global Constraints

- **Склад трогать нельзя.** Движения запасов идут только через `FifoInventoryService`; отмена заказа — только через `OrderCancellationService::cancel()`. Ни одна задача плана не пишет `products.stock`, `product_store_stock` и не расширяет `OrderCancellationService::CANCELLABLE`.
- **Отмена возможна только из `pending` и `confirmed`** — граница `OrderCancellationService::CANCELLABLE` (`app/Services/Orders/OrderCancellationService.php:39`).
- **Легаси-статусы `synced` и `failed` присваивать нельзя** ни при каких условиях. Они остаются читаемыми и фильтруемыми.
- **PHP:** после правок PHP запускать `vendor/bin/pint --dirty --format agent`.
- **Тесты API:** `php artisan test --compact --filter=<Имя>`. Тестовая база отдельная и берётся из `phpunit.xml` — `DB_*` в `.env` не трогать.
- **Фронт:** юнит-тестов нет; проверка — `cd admin && npx tsc --noEmit && npm run build`.
- **Палитра админки:** `zinc-*` и классы из `admin/src/components/ui/styles.ts`. Новый `gray-*` не вводить.
- **Язык интерфейса:** русский. Язык кода и комментариев — как в соседних файлах.
- **Коммиты:** без трейлеров `Co-Authored-By` и `Generated with`.

**Матрица переходов — единственный источник истины для всего плана:**

| Из | Куда можно |
|---|---|
| `pending` | `confirmed`, `cancelled` |
| `confirmed` | `in_delivery`, `cancelled` |
| `in_delivery` | `completed`, `confirmed` |
| `completed` | — |
| `cancelled` | — |
| `synced` | `confirmed`, `in_delivery`, `completed` |
| `failed` | `confirmed`, `in_delivery`, `completed` |

---

## File Structure

**API**

| Файл | Ответственность |
|---|---|
| `app/Models/Order.php` (modify) | Константа `ALLOWED_TRANSITIONS` и метод `canTransitionTo()` — матрица как данные модели |
| `app/Http/Controllers/Api/Admin/OrderController.php` (modify) | `index`: фильтры `segment` + `status` (с `archived`), `meta.status_counts`. `update`: проверка перехода |
| `tests/Feature/Admin/OrderStatusAdminTest.php` (modify) | Переходы: разрешённые, запрещённые, отмена через сервис |
| `tests/Feature/Admin/AdminOrdersListTest.php` (create) | Список: сегменты, `archived`, счётчики |

**Админка**

| Файл | Ответственность |
|---|---|
| `admin/src/components/orders/orderStatus.ts` (create) | Лейблы, цвета бейджей, матрица переходов, типы. Никакого JSX |
| `admin/src/components/orders/OrderTabs.tsx` (create) | Два ряда вкладок-ссылок со счётчиками |
| `admin/src/components/orders/OrdersTable.tsx` (create) | Колонки поверх `ui/DataTable` |
| `admin/src/components/orders/OrderRowActions.tsx` (create) | Меню «⋯», подтверждение отмены, PATCH |
| `admin/src/app/orders/page.tsx` (rewrite) | Чтение query-параметров, запрос к API, композиция |
| `admin/src/app/orders/[id]/page.tsx` (modify) | Подключение `orderStatus.ts`, удаление дублей, выпадашка по матрице |
| `admin/e2e/orders.spec.ts` (modify) | Оба теста под новую матрицу |

Порядок задач: сначала API целиком (1–3), потом фронт снизу вверх (4–7), потом e2e (8). Каждая задача оставляет приложение рабочим.

---

## Task 1: Матрица переходов на модели и валидация в API

**Files:**
- Modify: `app/Models/Order.php`
- Modify: `app/Http/Controllers/Api/Admin/OrderController.php:57-80` (метод `update`)
- Test: `tests/Feature/Admin/OrderStatusAdminTest.php`

**Interfaces:**
- Consumes: ничего из предыдущих задач (первая).
- Produces:
  - `Order::ALLOWED_TRANSITIONS` — `array<string, list<string>>`, карта «из» → «куда можно».
  - `Order::canTransitionTo(string $status): bool` — вызывается на экземпляре, сравнивает с текущим `$this->status`. Неизвестный текущий статус → `false`.
  - `PATCH /api/admin/orders/{order}` отвечает `422` с ключом ошибки `status` на недопустимый переход.

- [ ] **Step 1: Написать падающие тесты**

Дописать в `tests/Feature/Admin/OrderStatusAdminTest.php`. Файл сейчас не использует ни `ActsAsStaff`, ни HTTP-запросов — добавляем импорты и трейт.

Заменить шапку класса на:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class OrderStatusAdminTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }
```

Существующие два теста (`test_order_has_expanded_status_constants`, `test_all_statuses_returns_all_values`) оставить как есть. Дописать перед закрывающей скобкой класса:

```php
    #[Test]
    public function an_allowed_transition_goes_through(): void
    {
        $this->actingAsManager();

        $order = Order::factory()->create(['status' => Order::STATUS_PENDING]);

        $this->patchJson("/api/admin/orders/{$order->id}", ['status' => Order::STATUS_CONFIRMED])
            ->assertOk();

        $this->assertSame(Order::STATUS_CONFIRMED, $order->fresh()->status);
    }

    #[Test]
    public function a_completed_order_cannot_be_rolled_back(): void
    {
        $this->actingAsManager();

        $order = Order::factory()->create(['status' => Order::STATUS_COMPLETED]);

        $this->patchJson("/api/admin/orders/{$order->id}", ['status' => Order::STATUS_PENDING])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');

        $this->assertSame(Order::STATUS_COMPLETED, $order->fresh()->status);
    }

    #[Test]
    public function a_cancelled_order_is_terminal(): void
    {
        $this->actingAsManager();

        $order = Order::factory()->create(['status' => Order::STATUS_CANCELLED]);

        $this->patchJson("/api/admin/orders/{$order->id}", ['status' => Order::STATUS_CONFIRMED])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    /**
     * Отмена возможна только оттуда, откуда её пускает OrderCancellationService.
     * Если бы матрица разрешала больше, менеджеру рисовали бы пункт меню,
     * который гарантированно падает.
     */
    #[Test]
    public function an_order_out_for_delivery_cannot_be_cancelled(): void
    {
        $this->actingAsManager();

        $order = Order::factory()->create(['status' => Order::STATUS_IN_DELIVERY]);

        $this->patchJson("/api/admin/orders/{$order->id}", ['status' => Order::STATUS_CANCELLED])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');

        $this->assertSame(Order::STATUS_IN_DELIVERY, $order->fresh()->status);
    }

    /**
     * Обратный ход — единственный путь к отмене заказа, который уже уехал.
     */
    #[Test]
    public function an_order_out_for_delivery_can_go_back_to_confirmed(): void
    {
        $this->actingAsManager();

        $order = Order::factory()->create(['status' => Order::STATUS_IN_DELIVERY]);

        $this->patchJson("/api/admin/orders/{$order->id}", ['status' => Order::STATUS_CONFIRMED])
            ->assertOk();

        $this->assertSame(Order::STATUS_CONFIRMED, $order->fresh()->status);
    }

    #[Test]
    public function legacy_statuses_can_never_be_assigned(): void
    {
        $this->actingAsManager();

        $order = Order::factory()->create(['status' => Order::STATUS_PENDING]);

        foreach ([Order::STATUS_SYNCED, Order::STATUS_FAILED] as $legacy) {
            $this->patchJson("/api/admin/orders/{$order->id}", ['status' => $legacy])
                ->assertStatus(422)
                ->assertJsonValidationErrors('status');
        }
    }

    /**
     * Спасательный люк для исторических заказов внешней системы.
     */
    #[Test]
    public function a_legacy_order_can_be_rescued_into_the_working_flow(): void
    {
        $this->actingAsManager();

        $order = Order::factory()->synced()->create();

        $this->patchJson("/api/admin/orders/{$order->id}", ['status' => Order::STATUS_CONFIRMED])
            ->assertOk();

        $this->assertSame(Order::STATUS_CONFIRMED, $order->fresh()->status);
    }
}
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `php artisan test --compact --filter=OrderStatusAdminTest`

Expected: FAIL. `an_allowed_transition_goes_through` пройдёт (это сегодняшнее поведение), а запрещающие тесты упадут — API сейчас отвечает 200 на любой статус из `CLIENT_STATUSES`. `legacy_statuses_can_never_be_assigned` уже проходит (правило `in:` их не пускает).

- [ ] **Step 3: Добавить матрицу на модель**

В `app/Models/Order.php` сразу после константы `ALL_STATUSES` вставить:

```php
    /**
     * Куда заказ может уехать из каждого статуса.
     *
     * Отмена стоит только у `pending` и `confirmed` — ровно там, где её пускает
     * {@see \App\Services\Orders\OrderCancellationService}. Разрешить больше
     * значило бы предлагать менеджеру заведомо падающее действие.
     *
     * `completed` и `cancelled` терминальны: у отмены нет обратной операции,
     * она уже вернула товар на склад. `in_delivery` умеет вернуться в
     * `confirmed` — это единственный путь к отмене уехавшего заказа.
     *
     * Легаси-статусы имеют выход в рабочий поток, но входа в них нет ни
     * откуда: присваивать `synced` / `failed` нельзя.
     *
     * @var array<string, list<string>>
     */
    public const ALLOWED_TRANSITIONS = [
        self::STATUS_PENDING => [self::STATUS_CONFIRMED, self::STATUS_CANCELLED],
        self::STATUS_CONFIRMED => [self::STATUS_IN_DELIVERY, self::STATUS_CANCELLED],
        self::STATUS_IN_DELIVERY => [self::STATUS_COMPLETED, self::STATUS_CONFIRMED],
        self::STATUS_COMPLETED => [],
        self::STATUS_CANCELLED => [],
        self::STATUS_SYNCED => [self::STATUS_CONFIRMED, self::STATUS_IN_DELIVERY, self::STATUS_COMPLETED],
        self::STATUS_FAILED => [self::STATUS_CONFIRMED, self::STATUS_IN_DELIVERY, self::STATUS_COMPLETED],
    ];
```

И метод — рядом с `isDelivery()`:

```php
    /**
     * Можно ли из текущего статуса перейти в переданный.
     *
     * Статус, которого нет в матрице (испорченная строка в базе), никуда не
     * ведёт: лучше отказать, чем гадать.
     */
    public function canTransitionTo(string $status): bool
    {
        return in_array($status, self::ALLOWED_TRANSITIONS[$this->status] ?? [], true);
    }
```

- [ ] **Step 4: Проверить переход в контроллере**

В `app/Http/Controllers/Api/Admin/OrderController.php` заменить тело метода `update` (сейчас строки 57-80) на:

```php
    public function update(
        Request $request,
        int $id,
        OrderCancellationService $cancellation,
    ): JsonResponse {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', Order::CLIENT_STATUSES)],
        ]);

        $order = Order::findOrFail($id);

        // Статус уже стоит — не ошибка и не работа: молча отдаём заказ.
        if ($validated['status'] === $order->status) {
            return response()->json(['data' => $order->fresh(['user', 'address', 'items.product.media'])]);
        }

        if (! $order->canTransitionTo($validated['status'])) {
            throw ValidationException::withMessages([
                'status' => ['Из статуса «'.$order->status.'» нельзя перейти в «'.$validated['status'].'».'],
            ]);
        }

        if ($validated['status'] === Order::STATUS_CANCELLED) {
            $cancellation->cancel($order, $request->user());
        } else {
            $order->update(['status' => $validated['status']]);
        }

        return response()->json(['data' => $order->fresh(['user', 'address', 'items.product.media'])]);
    }
```

Добавить импорт в шапку файла:

```php
use Illuminate\Validation\ValidationException;
```

Комментарий к методу (`/** Move an order to another status. ... */`) дополнить абзацем:

```
     * Переход проверяется по {@see Order::ALLOWED_TRANSITIONS} — иначе
     * завершённый заказ можно было бы одним PATCH вернуть в «новый».
```

- [ ] **Step 5: Запустить тесты и убедиться, что они проходят**

Run: `php artisan test --compact --filter=OrderStatusAdminTest`
Expected: PASS, 9 тестов.

- [ ] **Step 6: Проверить, что не сломались соседние тесты заказов**

Run: `php artisan test --compact tests/Feature/Orders`
Expected: PASS. Если `OrderCancelReturnsStockTest` упадёт — читать сообщение: скорее всего тест отменяет заказ из статуса, которого нет в `CANCELLABLE`. Матрицу под тест не подгонять, разобраться, какое поведение верное, и доложить.

- [ ] **Step 7: Формат и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Models/Order.php app/Http/Controllers/Api/Admin/OrderController.php tests/Feature/Admin/OrderStatusAdminTest.php
git commit -m "feat(admin-api): validate order status transitions"
```

---

## Task 2: Фильтр сегмента и псевдостатус archived

**Files:**
- Modify: `app/Http/Controllers/Api/Admin/OrderController.php:17-39` (метод `index`)
- Test: `tests/Feature/Admin/AdminOrdersListTest.php` (создать)

**Interfaces:**
- Consumes: из Task 1 — ничего (независимая часть контроллера).
- Produces:
  - `GET /api/admin/orders?filter[segment]=b2b|retail` — сужает список по `users.type`.
  - `GET /api/admin/orders?filter[status]=archived` — отдаёт `synced` + `failed`.
  - Приватная константа `OrderController::ARCHIVED = 'archived'` и приватный метод `baseQuery(): QueryBuilder` — его переиспользует Task 3.

- [ ] **Step 1: Написать падающие тесты**

Создать `tests/Feature/Admin/AdminOrdersListTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

/**
 * Список заказов админки: сегменты, архив и счётчики вкладок.
 */
class AdminOrdersListTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    /** @return array{b2b: Order, retail: Order, guest: Order} */
    private function seedOneOrderPerSegment(): array
    {
        return [
            'b2b' => Order::factory()->for(User::factory()->b2b()->approved())->create(),
            'retail' => Order::factory()->for(User::factory()->retail())->create(),
            'guest' => Order::factory()->for(User::factory()->guest())->create(),
        ];
    }

    #[Test]
    public function the_b2b_segment_returns_only_partner_orders(): void
    {
        $this->actingAsManager();
        $orders = $this->seedOneOrderPerSegment();

        $ids = collect(
            $this->getJson('/api/admin/orders?filter[segment]=b2b')->assertOk()->json('data')
        )->pluck('id');

        $this->assertContains($orders['b2b']->id, $ids);
        $this->assertNotContains($orders['retail']->id, $ids);
        $this->assertNotContains($orders['guest']->id, $ids);
    }

    #[Test]
    public function the_retail_segment_includes_guest_checkouts(): void
    {
        $this->actingAsManager();
        $orders = $this->seedOneOrderPerSegment();

        $ids = collect(
            $this->getJson('/api/admin/orders?filter[segment]=retail')->assertOk()->json('data')
        )->pluck('id');

        $this->assertContains($orders['retail']->id, $ids);
        $this->assertContains($orders['guest']->id, $ids);
        $this->assertNotContains($orders['b2b']->id, $ids);
    }

    #[Test]
    public function without_a_segment_both_sides_come_back(): void
    {
        $this->actingAsManager();
        $orders = $this->seedOneOrderPerSegment();

        $ids = collect(
            $this->getJson('/api/admin/orders')->assertOk()->json('data')
        )->pluck('id');

        $this->assertContains($orders['b2b']->id, $ids);
        $this->assertContains($orders['retail']->id, $ids);
        $this->assertContains($orders['guest']->id, $ids);
    }

    /**
     * `archived` — выдумка интерфейса: такого значения в колонке status нет,
     * оно разворачивается в пару легаси-статусов.
     */
    #[Test]
    public function the_archived_pseudo_status_expands_to_both_legacy_statuses(): void
    {
        $this->actingAsManager();

        $synced = Order::factory()->synced()->create();
        $failed = Order::factory()->failed()->create();
        $working = Order::factory()->create(['status' => Order::STATUS_PENDING]);

        $ids = collect(
            $this->getJson('/api/admin/orders?filter[status]=archived')->assertOk()->json('data')
        )->pluck('id');

        $this->assertContains($synced->id, $ids);
        $this->assertContains($failed->id, $ids);
        $this->assertNotContains($working->id, $ids);
    }

    #[Test]
    public function a_real_status_still_filters_exactly(): void
    {
        $this->actingAsManager();

        $pending = Order::factory()->create(['status' => Order::STATUS_PENDING]);
        $completed = Order::factory()->create(['status' => Order::STATUS_COMPLETED]);

        $ids = collect(
            $this->getJson('/api/admin/orders?filter[status]=pending')->assertOk()->json('data')
        )->pluck('id');

        $this->assertContains($pending->id, $ids);
        $this->assertNotContains($completed->id, $ids);
    }

    #[Test]
    public function the_list_is_staff_only(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/orders');
    }

    /**
     * У модели User нет $hidden, поэтому отношение, загруженное целиком,
     * вынесло бы в JSON хеш пароля. Список отдаёт только нужные колонки.
     */
    #[Test]
    public function the_list_never_leaks_user_secrets(): void
    {
        $this->actingAsManager();

        Order::factory()->for(User::factory()->retail())->create();

        $user = $this->getJson('/api/admin/orders')->assertOk()->json('data.0.user');

        $this->assertArrayNotHasKey('password', $user);
        $this->assertArrayNotHasKey('remember_token', $user);
        $this->assertArrayHasKey('type', $user);
    }
}
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `php artisan test --compact --filter=AdminOrdersListTest`
Expected: FAIL. `filter[segment]` сейчас не разрешён — Spatie Query Builder бросит `InvalidFilterQuery` (HTTP 400), поэтому `assertOk()` упадёт. `the_archived_pseudo_status_expands_to_both_legacy_statuses` вернёт пустой список.

- [ ] **Step 3: Вынести базовый запрос и добавить фильтры**

В `app/Http/Controllers/Api/Admin/OrderController.php` заменить метод `index` на пару «метод + приватный сборщик»:

```php
    /** Псевдостатус вкладки «Архив»: в колонке status такого значения нет. */
    private const ARCHIVED = 'archived';

    /** Легаси-статусы внешней учётной системы, которых больше нет. */
    private const LEGACY_STATUSES = [Order::STATUS_SYNCED, Order::STATUS_FAILED];

    public function index(): JsonResponse
    {
        $orders = $this->baseQuery()
            // Поимённо, а не ->with(['user']): у модели User нет $hidden, и
            // отношение целиком утащило бы в ответ хеш пароля и remember_token.
            ->with(['user:id,name,phone,email,type'])
            ->latest()
            ->paginate(20);

        return response()->json($orders);
    }

    /**
     * Общая основа списка: фильтры сегмента, статуса и поиска.
     *
     * Вынесено отдельно, потому что счётчики вкладок считаются по этой же
     * основе — иначе они разъехались бы со списком.
     */
    private function baseQuery(): QueryBuilder
    {
        return QueryBuilder::for(Order::class)
            ->allowedFilters(
                AllowedFilter::callback('status', function ($query, $value): void {
                    if ($value === self::ARCHIVED) {
                        $query->whereIn('status', self::LEGACY_STATUSES);

                        return;
                    }

                    $query->where('status', $value);
                }),
                AllowedFilter::callback('segment', fn ($query, $value) => $this->applySegment($query, (string) $value)),
                AllowedFilter::callback('search', fn ($query, $value) => $this->applySearch($query, (string) $value)),
            );
    }

    /**
     * Сегмент живёт на пользователе (users.type), не на заказе: тип клиента не
     * переключается, поэтому снапшот на заказе не нужен.
     *
     * Вынесено отдельным методом, потому что счётчики вкладок применяют тот же
     * сегмент к своему запросу — а он собирается мимо Query Builder.
     */
    private function applySegment(Builder $query, string $value): void
    {
        $type = $value === 'b2b' ? User::TYPE_B2B : User::TYPE_RETAIL;

        $query->whereHas('user', function ($uq) use ($type): void {
            $uq->where('type', $type);
        });
    }

    private function applySearch(Builder $query, string $value): void
    {
        $query->where(function ($q) use ($value): void {
            $q->where('id', $value)
              ->orWhere('number', 'LIKE', "%{$value}%")
              ->orWhereHas('user', function ($uq) use ($value): void {
                  $uq->where('phone', 'LIKE', "%{$value}%")
                     ->orWhere('name', 'LIKE', "%{$value}%");
              });
        });
    }
```

Добавить импорты в шапку файла:

```php
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
```

Фильтр `AllowedFilter::exact('type')` удалён — колонки `type` в таблице `orders` нет, он всегда был мёртвым.

- [ ] **Step 4: Запустить тесты и убедиться, что они проходят**

Run: `php artisan test --compact --filter=AdminOrdersListTest`
Expected: PASS, 7 тестов.

- [ ] **Step 5: Проверить, что список по-прежнему открывается с фронта**

Run: `php artisan test --compact --filter=AdminPagesRenderTest`
Expected: PASS.

- [ ] **Step 6: Формат и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Controllers/Api/Admin/OrderController.php tests/Feature/Admin/AdminOrdersListTest.php
git commit -m "feat(admin-api): segment filter and archived pseudo-status on the orders list"
```

---

## Task 3: Счётчики вкладок в meta.status_counts

**Files:**
- Modify: `app/Http/Controllers/Api/Admin/OrderController.php` (метод `index`)
- Test: `tests/Feature/Admin/AdminOrdersListTest.php`

**Interfaces:**
- Consumes: из Task 2 — `OrderController::baseQuery(): QueryBuilder`, константы `ARCHIVED`, `LEGACY_STATUSES`.
- Produces: ответ `GET /api/admin/orders` содержит `meta.status_counts` — объект с ключами `all`, `pending`, `confirmed`, `in_delivery`, `completed`, `cancelled`, `archived`, значения `int`. Ключ есть всегда, отсутствующие статусы равны `0`.

- [ ] **Step 1: Написать падающие тесты**

Дописать в `tests/Feature/Admin/AdminOrdersListTest.php` перед закрывающей скобкой класса:

```php
    #[Test]
    public function every_counter_key_is_always_present(): void
    {
        $this->actingAsManager();

        $counts = $this->getJson('/api/admin/orders')->assertOk()->json('meta.status_counts');

        $this->assertSame(
            ['all', 'pending', 'confirmed', 'in_delivery', 'completed', 'cancelled', 'archived'],
            array_keys($counts),
        );
        $this->assertSame(0, $counts['pending']);
    }

    #[Test]
    public function the_archived_counter_sums_both_legacy_statuses(): void
    {
        $this->actingAsManager();

        Order::factory()->synced()->create();
        Order::factory()->failed()->count(2)->create();

        $counts = $this->getJson('/api/admin/orders')->assertOk()->json('meta.status_counts');

        $this->assertSame(3, $counts['archived']);
        $this->assertSame(3, $counts['all']);
    }

    /**
     * Главное правило: счётчики не зависят от выбранной вкладки. Иначе на
     * активной стояло бы её число, а на всех остальных — нули.
     */
    #[Test]
    public function the_counters_ignore_the_active_status_tab(): void
    {
        $this->actingAsManager();

        Order::factory()->create(['status' => Order::STATUS_PENDING]);
        Order::factory()->count(2)->create(['status' => Order::STATUS_COMPLETED]);

        $counts = $this->getJson('/api/admin/orders?filter[status]=pending')
            ->assertOk()
            ->json('meta.status_counts');

        $this->assertSame(1, $counts['pending']);
        $this->assertSame(2, $counts['completed']);
        $this->assertSame(3, $counts['all']);
    }

    #[Test]
    public function the_counters_follow_the_segment(): void
    {
        $this->actingAsManager();

        Order::factory()->for(User::factory()->b2b()->approved())->create(['status' => Order::STATUS_PENDING]);
        Order::factory()->for(User::factory()->retail())->count(2)->create(['status' => Order::STATUS_PENDING]);

        $counts = $this->getJson('/api/admin/orders?filter[segment]=b2b')
            ->assertOk()
            ->json('meta.status_counts');

        $this->assertSame(1, $counts['pending']);
        $this->assertSame(1, $counts['all']);
    }

    #[Test]
    public function the_counters_follow_the_search(): void
    {
        $this->actingAsManager();

        $mine = Order::factory()
            ->for(User::factory()->retail()->state(['name' => 'Асель Смагулова']))
            ->create(['status' => Order::STATUS_PENDING]);
        Order::factory()->count(2)->create(['status' => Order::STATUS_PENDING]);

        $counts = $this->getJson('/api/admin/orders?filter[search]=Асель')
            ->assertOk()
            ->json('meta.status_counts');

        $this->assertSame(1, $counts['pending']);
        $this->assertSame(1, $counts['all']);
        $this->assertNotNull($mine->id);
    }
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `php artisan test --compact --filter=AdminOrdersListTest`
Expected: FAIL — `meta.status_counts` в ответе нет, `json('meta.status_counts')` вернёт `null`.

- [ ] **Step 3: Посчитать счётчики и приклеить их к пагинатору**

В `app/Http/Controllers/Api/Admin/OrderController.php` заменить метод `index` на:

```php
    public function index(Request $request): JsonResponse
    {
        $orders = $this->baseQuery()
            ->with(['user:id,name,phone,email,type'])
            ->latest()
            ->paginate(20);

        $payload = $orders->toArray();
        $payload['meta'] = [
            'status_counts' => $this->statusCounts($request),
        ];

        return response()->json($payload);
    }

    /**
     * Сколько заказов на каждой вкладке.
     *
     * Считается по той же основе, что и список, но без фильтра статуса:
     * вкладка «Подтверждённые» должна показывать своё число и тогда, когда
     * открыта вкладка «Новые». Сегмент и поиск, наоборот, учитываются — они
     * сужают всю картину, а не одну вкладку.
     *
     * @return array<string, int>
     */
    private function statusCounts(Request $request): array
    {
        $query = Order::query();

        $filters = $request->input('filter', []);

        if (is_array($filters)) {
            if (($filters['segment'] ?? '') !== '') {
                $this->applySegment($query, (string) $filters['segment']);
            }

            if (($filters['search'] ?? '') !== '') {
                $this->applySearch($query, (string) $filters['search']);
            }
        }

        $raw = $query->toBase()
            ->select('status', DB::raw('COUNT(*) as aggregate'))
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $counts = ['all' => 0];

        foreach (Order::CLIENT_STATUSES as $status) {
            $counts[$status] = (int) $raw->get($status, 0);
        }

        $counts['archived'] = array_sum(
            array_map(static fn (string $s): int => (int) $raw->get($s, 0), self::LEGACY_STATUSES)
        );

        $counts['all'] = array_sum($raw->all());

        return $counts;
    }
```

Добавить импорт в шапку файла:

```php
use Illuminate\Support\Facades\DB;
```

Порядок ключей в `$counts` задан намеренно: `all` кладётся первым пустым и перезаписывается в конце, чтобы `array_keys()` шли в том порядке, в котором рисуются вкладки.

Изменить сигнатуру `index` на `public function index(Request $request): JsonResponse` и вызывать `$this->statusCounts($request)`.

**Почему счётчики не используют `baseQuery()`.** Spatie Query Builder читает `filter[...]` прямо из текущего запроса, поэтому второй вызов `baseQuery()` применил бы и фильтр статуса — и на неактивных вкладках встали бы нули. Собрать «тот же билдер, но без одного фильтра» нельзя: `filter[status]`, не объявленный в `allowedFilters`, считается неизвестным и бросает `InvalidFilterQuery` (в проекте нет `config/query-builder.php`, то есть действует строгий режим пакета по умолчанию).

Поэтому счётчики собираются обычным Eloquent-билдером и применяют сегмент с поиском вручную через `applySegment()` / `applySearch()` — те самые методы, которые Task 2 вынес из замыканий. Одна реализация фильтра, два потребителя.

- [ ] **Step 4: Запустить тесты и убедиться, что они проходят**

Run: `php artisan test --compact --filter=AdminOrdersListTest`
Expected: PASS, 12 тестов.

- [ ] **Step 5: Прогнать всё, что касается заказов и админки**

Run: `php artisan test --compact tests/Feature/Admin tests/Feature/Orders`
Expected: PASS.

- [ ] **Step 6: Формат и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Controllers/Api/Admin/OrderController.php tests/Feature/Admin/AdminOrdersListTest.php
git commit -m "feat(admin-api): per-status counters in the orders list meta"
```

---

## Task 4: orderStatus.ts — единственный источник правды на фронте

**Files:**
- Create: `admin/src/components/orders/orderStatus.ts`
- Modify: `admin/src/app/orders/[id]/page.tsx:8-39` (удалить дубли) и блок смены статуса (строки ~272-300)

**Interfaces:**
- Consumes: из Task 1 — матрица переходов (та же таблица, вторая копия на фронте — сознательно: фронт рисует меню, бэк защищает данные).
- Produces (всё из `@/components/orders/orderStatus`):
  - `type OrderStatus = 'pending' | 'confirmed' | 'in_delivery' | 'completed' | 'cancelled' | 'synced' | 'failed'`
  - `type OrderSegment = 'all' | 'b2b' | 'retail'`
  - `type StatusTabKey = 'all' | 'pending' | 'confirmed' | 'in_delivery' | 'completed' | 'cancelled' | 'archived'` — перечислен явно, без `synced` / `failed`
  - `STATUS_LABELS: Record<OrderStatus, string>`
  - `STATUS_BADGE: Record<OrderStatus, string>` — классы Tailwind для бейджа
  - `STATUS_TABS: { key: StatusTabKey; label: string }[]` — порядок вкладок
  - `SEGMENT_TABS: { key: OrderSegment; label: string }[]`
  - `allowedTransitions(from: OrderStatus): OrderStatus[]`
  - `isDestructive(status: OrderStatus): boolean` — сейчас `true` только для `cancelled`
  - `type StatusCounts = Record<StatusTabKey, number>`

- [ ] **Step 1: Создать модуль**

Создать `admin/src/components/orders/orderStatus.ts`:

```ts
/**
 * Статусы заказа: подписи, цвета, допустимые переходы.
 *
 * Единственное место, где это знание живёт на фронте. Матрица переходов
 * повторяет Order::ALLOWED_TRANSITIONS на бэке — дублирование сознательное:
 * здесь она рисует меню, там защищает данные, и каждая сторона должна быть
 * права сама по себе.
 */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'in_delivery'
  | 'completed'
  | 'cancelled'
  | 'synced'
  | 'failed';

export type OrderSegment = 'all' | 'b2b' | 'retail';

/**
 * Ключ вкладки. Перечислен явно, а не выведен из OrderStatus: `synced` и
 * `failed` вкладок не имеют — они спрятаны за одной «Архив», и API счётчик по
 * ним отдельно не отдаёт. Вывести тип из OrderStatus значило бы пообещать
 * counts.synced, которого в ответе нет.
 */
export type StatusTabKey =
  | 'all'
  | 'pending'
  | 'confirmed'
  | 'in_delivery'
  | 'completed'
  | 'cancelled'
  | 'archived';

export type StatusCounts = Record<StatusTabKey, number>;

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Новый',
  confirmed: 'Подтверждён',
  in_delivery: 'В доставке',
  completed: 'Завершён',
  cancelled: 'Отменён',
  synced: 'Архив (отправлен)',
  failed: 'Архив (ошибка отправки)',
};

export const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  in_delivery: 'bg-violet-50 text-violet-700 border-violet-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  synced: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  failed: 'bg-zinc-100 text-zinc-600 border-zinc-200',
};

export const SEGMENT_TABS: { key: OrderSegment; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'b2b', label: 'B2B' },
  { key: 'retail', label: 'Розница' },
];

export const STATUS_TABS: { key: StatusTabKey; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'pending', label: 'Новые' },
  { key: 'confirmed', label: 'Подтверждённые' },
  { key: 'in_delivery', label: 'В доставке' },
  { key: 'completed', label: 'Завершённые' },
  { key: 'cancelled', label: 'Отменённые' },
  { key: 'archived', label: 'Архив' },
];

/**
 * Отмена стоит только у «нового» и «подтверждённого» — ровно там, где её
 * пускает OrderCancellationService на бэке. Предлагать её у «в доставке»
 * значило бы рисовать заведомо падающий пункт меню.
 *
 * «В доставке» умеет вернуться в «подтверждён»: это единственный путь к
 * отмене уехавшего заказа.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_delivery', 'cancelled'],
  in_delivery: ['completed', 'confirmed'],
  completed: [],
  cancelled: [],
  synced: ['confirmed', 'in_delivery', 'completed'],
  failed: ['confirmed', 'in_delivery', 'completed'],
};

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

/** Требует подтверждения: отмена возвращает товар на склад. */
export function isDestructive(status: OrderStatus): boolean {
  return status === 'cancelled';
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as OrderStatus] ?? status;
}

export function statusBadge(status: string): string {
  return STATUS_BADGE[status as OrderStatus] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200';
}
```

- [ ] **Step 2: Подключить модуль к карточке заказа**

В `admin/src/app/orders/[id]/page.tsx`:

1. Удалить локальные `ASSIGNABLE_STATUSES`, `STATUS_STYLES`, `STATUS_LABELS` (строки 8-39).
2. Добавить импорт:

```ts
import { allowedTransitions, statusBadge, statusLabel, type OrderStatus } from '@/components/orders/orderStatus';
```

3. Заменить обращения `STATUS_STYLES[order.status] || '...'` на `statusBadge(order.status)`, а `STATUS_LABELS[order.status] || order.status` на `statusLabel(order.status)`.
4. Выпадашку смены статуса заполнять не всеми назначаемыми статусами, а текущим плюс допустимыми переходами:

```tsx
{[order.status as OrderStatus, ...allowedTransitions(order.status as OrderStatus)].map((s) => (
  <option key={s} value={s}>{statusLabel(s)}</option>
))}
```

Текущий статус идёт первым, чтобы селект показывал то, что есть сейчас, и кнопка «Сохранить статус» оставалась неактивной до реального выбора (она уже завязана на `selectedStatus === order.status`).

5. Если заказ терминальный (`allowedTransitions(...)` пуст), вместо селекта и кнопки показать строку:

```tsx
<p className="text-sm text-zinc-500">Статус финальный — изменить нельзя.</p>
```

- [ ] **Step 3: Проверить типы и сборку**

Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: обе команды завершаются без ошибок.

- [ ] **Step 4: Коммит**

```bash
git add admin/src/components/orders/orderStatus.ts admin/src/app/orders/\[id\]/page.tsx
git commit -m "refactor(admin): single source for order status labels and transitions"
```

---

## Task 5: OrderTabs — вкладки-ссылки со счётчиками

**Files:**
- Create: `admin/src/components/orders/OrderTabs.tsx`

**Interfaces:**
- Consumes: из Task 4 — `SEGMENT_TABS`, `STATUS_TABS`, `OrderSegment`, `StatusTabKey`, `StatusCounts`.
- Produces: `export default function OrderTabs(props: { segment: OrderSegment; status: StatusTabKey; counts: StatusCounts | null; buildHref: (next: { segment?: OrderSegment; status?: StatusTabKey }) => string })` — чистый компонент, сам ничего не грузит.

`buildHref` приходит сверху, потому что страница знает про поиск и страницу, а вкладки — нет: их дело нарисовать ссылку, а не собирать query-строку.

- [ ] **Step 1: Создать компонент**

Создать `admin/src/components/orders/OrderTabs.tsx`:

```tsx
'use client';

import Link from 'next/link';
import {
  SEGMENT_TABS,
  STATUS_TABS,
  type OrderSegment,
  type StatusCounts,
  type StatusTabKey,
} from './orderStatus';

type Props = {
  segment: OrderSegment;
  status: StatusTabKey;
  counts: StatusCounts | null;
  buildHref: (next: { segment?: OrderSegment; status?: StatusTabKey }) => string;
};

/**
 * Два ряда вкладок: сегмент клиента и статус заказа.
 *
 * Вкладки — ссылки, а не кнопки с состоянием: так отфильтрованный список можно
 * передать ссылкой, F5 его не сбрасывает, а «назад» в браузере работает.
 * Поэтому общий ui/Tabs здесь не подходит — он держит активную вкладку в
 * useState и сам рисует панель содержимого.
 *
 * Вкладка с нулём не прячется: исчезающие вкладки ломают мышечную память.
 */
export default function OrderTabs({ segment, status, counts, buildHref }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div role="tablist" aria-label="Сегмент клиента" className="flex gap-1 border-b border-zinc-200 px-2 pt-2">
        {SEGMENT_TABS.map((tab) => (
          <Link
            key={tab.key}
            role="tab"
            aria-selected={tab.key === segment}
            href={buildHref({ segment: tab.key })}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab.key === segment ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div role="tablist" aria-label="Статус заказа" className="flex flex-wrap gap-1 px-2 py-2">
        {STATUS_TABS.map((tab) => {
          const count = counts?.[tab.key];

          return (
            <Link
              key={tab.key}
              role="tab"
              aria-selected={tab.key === status}
              href={buildHref({ status: tab.key })}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                tab.key === status ? 'bg-blue-50 font-medium text-blue-700' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {tab.label}
              {count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                    tab.key === status ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Проверить типы**

Run: `cd admin && npx tsc --noEmit`
Expected: без ошибок. Компонент пока никем не используется — это нормально, он подключается в Task 6.

- [ ] **Step 3: Коммит**

```bash
git add admin/src/components/orders/OrderTabs.tsx
git commit -m "feat(admin): order tabs for segment and status"
```

---

## Task 6: OrderRowActions — смена статуса из строки

**Files:**
- Create: `admin/src/components/orders/OrderRowActions.tsx`

**Interfaces:**
- Consumes: из Task 4 — `allowedTransitions`, `isDestructive`, `statusLabel`, `OrderStatus`.
- Produces: `export default function OrderRowActions(props: { orderId: number; status: OrderStatus; onChanged: () => void })`. После успешного PATCH вызывает `onChanged()` — перезагрузку списка делает страница, компонент не знает про фильтры.

- [ ] **Step 1: Создать компонент**

Создать `admin/src/components/orders/OrderRowActions.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { allowedTransitions, isDestructive, statusLabel, type OrderStatus } from './orderStatus';

type Props = {
  orderId: number;
  status: OrderStatus;
  onChanged: () => void;
};

/**
 * Действия над заказом прямо из строки списка.
 *
 * Показываются только допустимые переходы — те же, что разрешает
 * Order::ALLOWED_TRANSITIONS на бэке. Отмена спрашивает подтверждение: она не
 * просто пишет статус, а возвращает товар на склад через
 * OrderCancellationService, и отменить это нечем.
 */
export default function OrderRowActions({ orderId, status, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const transitions = allowedTransitions(status);

  const move = async (next: OrderStatus) => {
    if (isDestructive(next) && !window.confirm('Отменить заказ? Товар вернётся на склад, отменить это будет нельзя.')) {
      return;
    }

    setOpen(false);
    setBusy(true);

    try {
      await api.patch(`/admin/orders/${orderId}`, { status: next });
      toast.success(`Статус изменён: ${statusLabel(next)}`);
      onChanged();
    } catch {
      // 401/403/5xx показывает перехватчик в lib/api; здесь остаётся 422 —
      // переход, который бэк считает недопустимым.
      toast.error('Не удалось изменить статус');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/orders/${orderId}`} className="rounded-md px-2 py-1 text-sm text-blue-600 hover:bg-blue-50">
        Открыть
      </Link>

      {transitions.length > 0 && (
        <div className="relative">
          <button
            type="button"
            disabled={busy}
            aria-label="Действия"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
          >
            ⋯
          </button>

          {open && (
            <>
              {/* Клик мимо меню закрывает его. */}
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 min-w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                {transitions.map((next) => (
                  <button
                    key={next}
                    type="button"
                    onClick={() => move(next)}
                    className={`block w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 ${
                      isDestructive(next) ? 'text-red-600' : 'text-zinc-700'
                    }`}
                  >
                    {statusLabel(next)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Проверить типы**

Run: `cd admin && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Коммит**

```bash
git add admin/src/components/orders/OrderRowActions.tsx
git commit -m "feat(admin): inline order status actions"
```

---

## Task 7: Переписать страницу списка на URL-состояние и общие компоненты

**Files:**
- Create: `admin/src/components/orders/OrdersTable.tsx`
- Rewrite: `admin/src/app/orders/page.tsx`

**Interfaces:**
- Consumes: Task 4 (`orderStatus.ts`), Task 5 (`OrderTabs`), Task 6 (`OrderRowActions`), Task 2-3 (`filter[segment]`, `filter[status]`, `meta.status_counts`), а также существующие `@/components/ui/DataTable` (`Column<T>`, `PageMeta`), `@/components/ui/PageHeader`, `@/components/ui/styles`.
- Produces: `type OrderRow` — строка списка, экспортируется из `OrdersTable.tsx` и используется страницей.

- [ ] **Step 1: Создать описание колонок**

Создать `admin/src/components/orders/OrdersTable.tsx`:

```tsx
'use client';

import type { Column } from '@/components/ui/DataTable';
import OrderRowActions from './OrderRowActions';
import { statusBadge, statusLabel, type OrderStatus } from './orderStatus';

export type OrderRow = {
  id: number;
  number: string | null;
  status: OrderStatus;
  total: number | null;
  created_at: string | null;
  user: { id: number; name: string | null; phone: string | null; email: string | null; type: string | null } | null;
};

const money = (kopecks: number | null) =>
  kopecks === null ? '—' : `${(kopecks / 100).toLocaleString('ru-RU')} ₸`;

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ru-KZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export function orderColumns(onChanged: () => void): Column<OrderRow>[] {
  return [
    {
      key: 'id',
      header: '#',
      render: (row) => (
        <div>
          <div className="font-medium text-zinc-800">#{row.id}</div>
          {row.number && <div className="text-xs text-zinc-400">{row.number}</div>}
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Клиент',
      render: (row) =>
        row.user ? (
          <div>
            <div className="font-medium text-zinc-900">{row.user.name || '—'}</div>
            <div className="text-xs text-zinc-500">{row.user.phone || row.user.email || '—'}</div>
          </div>
        ) : (
          <span className="text-xs italic text-zinc-400">Без клиента</span>
        ),
    },
    {
      key: 'segment',
      header: 'Сегмент',
      render: (row) => (
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
            row.user?.type === 'b2b'
              ? 'border-sky-200 bg-sky-50 text-sky-700'
              : 'border-zinc-200 bg-zinc-50 text-zinc-600'
          }`}
        >
          {row.user?.type === 'b2b' ? 'B2B' : 'Розница'}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Сумма',
      className: 'tabular-nums',
      render: (row) => money(row.total),
    },
    {
      key: 'status',
      header: 'Статус',
      render: (row) => (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge(row.status)}`}>
          {statusLabel(row.status)}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Дата',
      className: 'whitespace-nowrap text-zinc-500',
      render: (row) => date(row.created_at),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => <OrderRowActions orderId={row.id} status={row.status} onChanged={onChanged} />,
    },
  ];
}
```

- [ ] **Step 2: Переписать страницу**

Заменить `admin/src/app/orders/page.tsx` целиком:

```tsx
'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';
import type { PageMeta } from '@/lib/crud';
import { inputClass } from '@/components/ui/styles';
import OrderTabs from '@/components/orders/OrderTabs';
import { orderColumns, type OrderRow } from '@/components/orders/OrdersTable';
import {
  SEGMENT_TABS,
  STATUS_TABS,
  type OrderSegment,
  type StatusCounts,
  type StatusTabKey,
} from '@/components/orders/orderStatus';

/**
 * Рабочее место менеджера по заказам.
 *
 * Состояние экрана (сегмент, статус, поиск, страница) живёт в query-параметрах,
 * а не в useState: так ссылку на «новые B2B» можно передать, F5 её не теряет и
 * «назад» в браузере работает.
 */
function OrdersScreen() {
  const router = useRouter();
  const params = useSearchParams();

  // Неизвестное значение параметра трактуем как умолчание, а не как ошибку.
  const segment: OrderSegment =
    (SEGMENT_TABS.find((t) => t.key === params.get('segment'))?.key as OrderSegment) ?? 'all';
  const status: StatusTabKey =
    (STATUS_TABS.find((t) => t.key === params.get('status'))?.key as StatusTabKey) ?? 'all';
  const query = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [counts, setCounts] = useState<StatusCounts | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(query);

  // Поле ввода — своё состояние, URL догоняет его с задержкой: иначе каждая
  // буква оставляла бы запись в истории и дёргала запрос.
  useEffect(() => {
    setDraft(query);
  }, [query]);

  const buildHref = useCallback(
    (next: { segment?: OrderSegment; status?: StatusTabKey; q?: string; page?: number }) => {
      const sp = new URLSearchParams();
      const nextSegment = next.segment ?? segment;
      const nextStatus = next.status ?? status;
      const nextQuery = next.q ?? query;
      // Смена вкладки или поиска всегда возвращает на первую страницу.
      const nextPage = next.page ?? (next.segment || next.status || next.q !== undefined ? 1 : page);

      if (nextSegment !== 'all') sp.set('segment', nextSegment);
      if (nextStatus !== 'all') sp.set('status', nextStatus);
      if (nextQuery) sp.set('q', nextQuery);
      if (nextPage > 1) sp.set('page', String(nextPage));

      const qs = sp.toString();

      return qs ? `/orders?${qs}` : '/orders';
    },
    [segment, status, query, page],
  );

  useEffect(() => {
    if (draft === query) {
      return;
    }

    const t = setTimeout(() => router.replace(buildHref({ q: draft })), 300);

    return () => clearTimeout(t);
  }, [draft, query, router, buildHref]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const requestParams: Record<string, string> = { page: String(page) };
      if (segment !== 'all') requestParams['filter[segment]'] = segment;
      if (status !== 'all') requestParams['filter[status]'] = status;
      if (query) requestParams['filter[search]'] = query;

      const { data } = await api.get('/admin/orders', { params: requestParams });

      setRows(data.data ?? []);
      setCounts(data.meta?.status_counts ?? null);
      setMeta({ current_page: data.current_page ?? 1, last_page: data.last_page ?? 1 });
      setTotal(data.total ?? 0);
    } catch (error) {
      console.error('Не удалось загрузить заказы', error);
    } finally {
      setLoading(false);
    }
  }, [segment, status, query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo(() => orderColumns(() => void load()), [load]);

  return (
    <div className="min-h-screen bg-zinc-50/50 p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader title="Заказы" />

        <OrderTabs segment={segment} status={status} counts={counts} buildHref={buildHref} />

        <div className="flex items-center gap-4">
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Поиск по ID, номеру или телефону…"
            className={`${inputClass} max-w-md`}
          />
          <span className="text-sm text-zinc-500">{total} всего</span>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyText="Заказы не найдены"
          meta={meta}
          onPageChange={(next) => router.push(buildHref({ page: next }))}
        />
      </div>
    </div>
  );
}

/**
 * useSearchParams требует границы Suspense — без неё Next валит сборку
 * страницы в статическом рендере.
 */
export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-zinc-500">Загрузка…</div>}>
      <OrdersScreen />
    </Suspense>
  );
}
```

- [ ] **Step 3: Проверить типы и сборку**

Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: обе команды без ошибок.

- [ ] **Step 4: Коммит**

```bash
git add admin/src/components/orders/OrdersTable.tsx admin/src/app/orders/page.tsx
git commit -m "feat(admin): orders workspace with segment and status tabs"
```

---

## Task 8: Привести e2e админки к новой матрице

**Files:**
- Modify: `admin/e2e/orders.spec.ts`

**Interfaces:**
- Consumes: Task 1 (валидация переходов на API), Task 4 (выпадашка карточки заказа показывает только допустимые переходы).
- Produces: ничего для следующих задач — последняя.

**Почему тесты ломаются.** Оба написаны против прежнего поведения: первый требует в выпадашке ровно пять назначаемых статусов, второй гоняет заказ по кольцу и замыкает его переходом `completed → pending`, который теперь вернёт 422.

- [ ] **Step 1: Переписать тест про содержимое выпадашки**

Заменить первый тест в `admin/e2e/orders.spec.ts` на:

```ts
test("в выпадашке только допустимые переходы, без synced и failed", async ({ page }) => {
  const order = requireOrder("buyout");

  await page.goto(`/orders/${order.id}`);
  await settled(page);

  const select = page.getByRole("combobox");
  const current = await select.inputValue();

  // Из «нового» ведут ровно два пути; сам текущий статус стоит первым, чтобы
  // селект показывал то, что есть сейчас.
  if (current === "pending") {
    await expect(select.locator("option")).toHaveText(["Новый", "Подтверждён", "Отменён"]);
  }

  // Главное, ради чего тест и писался: мёртвые статусы внешней системы
  // менеджеру не предлагают ни при каком текущем статусе.
  for (const legacy of [...LEGACY, "synced", "failed"]) {
    await expect(select.locator("option").filter({ hasText: legacy })).toHaveCount(0);
  }
});
```

Константу `ASSIGNABLE` удалить — она больше не описывает содержимое выпадашки. `LEGACY` оставить.

- [ ] **Step 2: Переписать тест про проход по статусам**

Заменить второй тест на односторонний проход:

```ts
/** Рабочий путь заказа. Он односторонний: откат назад API больше не примет. */
const CHAIN = ["pending", "confirmed", "in_delivery", "completed"];

test("менеджер проводит заказ по рабочим статусам", async ({ page }) => {
  const order = requireOrder("buyout");

  await page.goto(`/orders/${order.id}`);
  await expect(page.getByRole("heading", { name: new RegExp(order.number) })).toBeVisible();
  await settled(page);

  const select = page.getByRole("combobox");
  const started = CHAIN.indexOf(await select.inputValue());

  expect(
    started,
    "заказ выпал из рабочего пути (отменён?) — перезапустите прогон приёмки",
  ).toBeGreaterThanOrEqual(0);

  // Путь односторонний, поэтому повторный прогон без пересева доходит до
  // «завершён» и дальше идти некуда — это не провал, а исчерпанная фикстура.
  test.skip(
    started === CHAIN.length - 1,
    "заказ уже завершён — прогоните `php artisan mvp:acceptance --fresh --fixtures`",
  );

  for (let step = started + 1; step < CHAIN.length; step++) {
    const next = CHAIN[step];
    const save = page.getByRole("button", { name: "Сохранить статус" });

    await select.selectOption(next);
    await expect(save).toBeEnabled();

    const saved = page.waitForResponse(
      (response) =>
        response.url().includes(`/admin/orders/${order.id}`) &&
        response.request().method() === "PATCH",
    );
    await save.click();
    expect((await saved).status(), `перевод в «${next}» не сохранился`).toBe(200);

    await page.reload();
    await settled(page);
    await expect(select).toHaveValue(next);
  }
});
```

- [ ] **Step 3: Обновить комментарий-шапку файла**

Заменить блок `/** Карточка заказа: смена статуса. ... */` на:

```ts
/**
 * Карточка заказа: смена статуса.
 *
 * Прогон приёмки доказал, что API проводит заказ по рабочим статусам и
 * отвечает 422 на мёртвые synced/failed. Здесь проверяется то, чего он
 * проверить не может: что менеджеру предлагают только допустимые переходы.
 *
 * Путь односторонний — Order::ALLOWED_TRANSITIONS не пускает заказ назад из
 * «завершён», — поэтому тест идёт от текущего статуса до конца цепочки и
 * пропускается, если фикстура уже исчерпана.
 *
 * Берётся заказ на выкуп остатка: он единственный, кто остаётся новым.
 * «Отменён» не трогаем намеренно — отмена вернула бы товар на склад и
 * развалила бы проверки распроданного товара на витрине.
 */
```

- [ ] **Step 4: Прогнать e2e**

```bash
php artisan mvp:acceptance --fresh --fixtures --no-interaction
cd admin && npx playwright test e2e/orders.spec.ts
```

Expected: оба теста PASS. Подробности про окружение прогона — `docs/e2e-runbook.md`.

Если прогон приёмки недоступен локально — зафиксировать это в отчёте и не выдавать e2e за проверенные.

- [ ] **Step 5: Коммит**

```bash
git add admin/e2e/orders.spec.ts
git commit -m "test(admin): e2e follows the one-way status chain"
```

---

## Финальная проверка

- [ ] **Полный прогон API**

Run: `php artisan test --compact`
Expected: PASS.

- [ ] **Сборка админки**

Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: без ошибок.

- [ ] **Ручная проверка владельцем проекта**

`http://localhost:3002/orders`:
- вкладки сегмента и статуса переключаются, URL меняется, F5 сохраняет выбор;
- счётчики не обнуляются на неактивных вкладках;
- «⋯» у нового заказа предлагает «Подтверждён» и «Отменён», у завершённого меню нет;
- отмена спрашивает подтверждение;
- поиск работает и попадает в URL.
