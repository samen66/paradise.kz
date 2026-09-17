# Страница заказа в B2B-портале — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** партнёр видит в заказе фото и артикул каждой позиции, переходит по позиции в карточку товара и видит подробности заказа (получение, статус оплаты, комментарий, email, сумма разбивкой).

**Architecture:** API только расширяется: `OrderItemResource` отдаёт `image`/`article` из живого товара, когда связь `product` загружена; `OrderResource` отдаёт `payment_status`; `OrderController::show` грузит `items.product.media` одним eager-load. Портал перерисовывает `orders/[id]/page.tsx` в две колонки, подписи — через next-intl.

**Tech Stack:** Laravel 13, PHPUnit 12, Spatie Media Library; Next.js 16, React 19, TypeScript, Tailwind 4, next-intl, zustand.

**Spec:** `docs/superpowers/specs/2026-09-17-b2b-order-detail-design.md`

## Global Constraints

- Ветка `feat/b2b-order-detail` (worktree `.claude/worktrees/b2b-order-detail`). Коммиты Conventional Commits, **без** `Co-Authored-By` и без «Generated with Claude Code».
- API только добавляет ключи; существующие ключи и их типы не меняются.
- Название, количество, цена позиции — из снимка `order_items`; из живого `Product` — только `image` и `article`.
- Способ оплаты (`payment_method`) не отдаём и не показываем.
- PHP: `declare(strict_types=1);`, типы возврата; после правок `vendor/bin/pint --dirty --format agent`.
- Прогон PHP-тестов (далее `$TEST`), `.env` не трогать:
  `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= vendor/bin/phpunit`
  (`php artisan test` локально падает на `package:discover` из-за reverb DevCommands.)
- Проверка портала: `cd b2b-portal && npx tsc --noEmit && npm run build`.
- UI-тексты по-русски и по-казахски в `b2b-portal/src/messages/{ru,kk}.json`.

## Файловая карта

**Backend — изменить**
- `app/Http/Resources/OrderItemResource.php` — ключи `image`, `article`.
- `app/Http/Resources/OrderResource.php` — ключ `payment_status`.
- `app/Http/Controllers/Api/OrderController.php` — eager-load в `show`.
- `tests/Feature/Orders/OrderApiTest.php` — новые тесты.

**Портал — изменить**
- `b2b-portal/src/lib/types.ts` — `OrderItem.article`, `Order.payment_status`.
- `b2b-portal/src/messages/ru.json`, `kk.json` — ключи `account.*`.
- `b2b-portal/src/app/(portal)/orders/[id]/page.tsx` — новая разметка.

---

### Task 1: API — фото, артикул и статус оплаты в заказе

**Files:**
- Modify: `app/Http/Resources/OrderItemResource.php`
- Modify: `app/Http/Resources/OrderResource.php`
- Modify: `app/Http/Controllers/Api/OrderController.php` (метод `show`)
- Test: `tests/Feature/Orders/OrderApiTest.php`

**Interfaces:**
- Produces (JSON `GET /api/orders/{id}`): `data.payment_status: string`; `data.items[].image: string|null`, `data.items[].article: string|null`. В `GET /api/orders` ключей `image`/`article` у позиций нет, `payment_status` есть.

- [ ] **Step 1: Написать падающие тесты**

В `tests/Feature/Orders/OrderApiTest.php` добавить импорты:

```php
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
```

И тесты после `show_returns_404_for_another_clients_order`:

```php
    /**
     * An order with `$lines` lines, each pointing at a product that has a photo.
     */
    private function orderWithPhotographedProducts(User $user, int $lines): Order
    {
        Storage::fake(config('media-library.disk_name'));

        $order = Order::factory()->for($user)->create();

        for ($i = 1; $i <= $lines; $i++) {
            $product = Product::factory()->create(['article' => "ART-{$i}"]);
            $product->addMedia(UploadedFile::fake()->image("p{$i}.jpg"))
                ->toMediaCollection(Product::IMAGE_COLLECTION);

            $order->items()->create([
                'product_id' => $product->id,
                'external_product_id' => null,
                'name' => "Товар {$i}",
                'quantity' => 1,
                'price' => 100_000,
            ]);
        }

        return $order;
    }

    #[Test]
    public function show_returns_the_photo_and_article_of_each_line(): void
    {
        $user = $this->approvedClient();
        $order = $this->orderWithPhotographedProducts($user, 1);
        $product = $order->items()->first()->product;

        Sanctum::actingAs($user);

        $this->getJson('/api/orders/'.$order->id)
            ->assertOk()
            ->assertJsonPath('data.items.0.article', 'ART-1')
            ->assertJsonPath('data.items.0.image', $product->getFirstMedia(Product::IMAGE_COLLECTION)->getUrl('thumb'))
            // The line keeps its own snapshot name, not the live product name.
            ->assertJsonPath('data.items.0.name', 'Товар 1');
    }

    #[Test]
    public function a_line_whose_product_is_gone_has_null_photo_and_article(): void
    {
        $user = $this->approvedClient();
        $order = Order::factory()->for($user)->create();
        $order->items()->create([
            'product_id' => null,
            'external_product_id' => null,
            'name' => 'Удалённый товар',
            'quantity' => 1,
            'price' => 100_000,
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/orders/'.$order->id)->assertOk();

        $this->assertArrayHasKey('image', $response->json('data.items.0'));
        $this->assertNull($response->json('data.items.0.image'));
        $this->assertArrayHasKey('article', $response->json('data.items.0'));
        $this->assertNull($response->json('data.items.0.article'));
    }

    #[Test]
    public function show_returns_the_payment_status(): void
    {
        $user = $this->approvedClient();
        $order = Order::factory()->for($user)->create(['payment_status' => 'paid']);

        Sanctum::actingAs($user);

        $this->getJson('/api/orders/'.$order->id)
            ->assertOk()
            ->assertJsonPath('data.payment_status', 'paid');
    }

    #[Test]
    public function show_query_count_does_not_grow_with_the_number_of_lines(): void
    {
        $user = $this->approvedClient();
        $small = $this->orderWithPhotographedProducts($user, 1);
        $large = $this->orderWithPhotographedProducts($user, 3);

        Sanctum::actingAs($user);

        $countQueries = function (Order $order): int {
            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->getJson('/api/orders/'.$order->id)->assertOk();
            DB::disableQueryLog();

            return count(DB::getQueryLog());
        };

        $countQueries($small); // warm up per-request caches (roles, settings)

        $this->assertSame($countQueries($small), $countQueries($large));
    }

    #[Test]
    public function index_does_not_expose_line_photos(): void
    {
        $user = $this->approvedClient();
        $this->orderWithPhotographedProducts($user, 1);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/orders')->assertOk();

        $this->assertArrayNotHasKey('image', $response->json('data.0.items.0'));
        $this->assertArrayNotHasKey('article', $response->json('data.0.items.0'));
    }
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `$TEST --filter 'show_returns_the_photo|product_is_gone|payment_status|query_count|index_does_not_expose' tests/Feature/Orders/OrderApiTest.php`
Expected: FAIL — нет ключей `article`/`image`/`payment_status`; `index_does_not_expose_line_photos` проходит уже сейчас (это страховка от регрессии, не TDD-красный). Если в `index` у позиций нет `items` — убедиться, что `OrderController::index` грузит `items` (он грузит).

- [ ] **Step 3: Реализация**

`app/Http/Resources/OrderItemResource.php` — в `toArray()` после `'price'`:

```php
            // Presentation only, from the live product: the line's name, quantity
            // and price stay the order's own snapshot. Present only when the
            // caller eager-loaded `product` (with `media`), so the order list
            // does not pay for photos it does not show.
            'image' => $this->whenLoaded('product', fn (): ?string => $this->product
                ?->getFirstMedia(Product::IMAGE_COLLECTION)
                ?->getUrl('thumb')),
            'article' => $this->whenLoaded('product', fn (): ?string => $this->product?->article),
```

и импорт `use App\Models\Product;`.

`app/Http/Resources/OrderResource.php` — после `'status' => $this->status,`:

```php
            'payment_status' => $this->payment_status,
```

`app/Http/Controllers/Api/OrderController.php` — в `show()`:

```php
        return new OrderResource($order->load(['items.product.media', 'store']));
```

Примечание: `whenLoaded('product')` для позиции с `product_id = null` после eager-load возвращает связь как загруженную со значением `null`, поэтому ключи будут `null`, а не отсутствовать. Если тест `a_line_whose_product_is_gone…` покажет отсутствие ключа — проверить `relationLoaded('product')` на такой позиции и не менять тест.

- [ ] **Step 4: Прогнать тесты**

Run: `$TEST tests/Feature/Orders/OrderApiTest.php`
Expected: PASS, все тесты файла (24 старых + 5 новых).

Run: `$TEST tests/Feature/Account` (кабинет витрины тоже отдаёт `OrderResource`)
Expected: PASS.

- [ ] **Step 5: Форматирование и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Resources/OrderItemResource.php app/Http/Resources/OrderResource.php app/Http/Controllers/Api/OrderController.php tests/Feature/Orders/OrderApiTest.php
git commit -m "feat(orders): expose line photo, article and payment status on B2B order detail"
```

---

### Task 2: Портал — подробная страница заказа

**Files:**
- Modify: `b2b-portal/src/lib/types.ts` (`OrderItem`, `Order`)
- Modify: `b2b-portal/src/messages/ru.json`, `b2b-portal/src/messages/kk.json` (блок `account`)
- Modify: `b2b-portal/src/app/(portal)/orders/[id]/page.tsx` (переписать целиком)

**Interfaces:**
- Consumes: JSON из Task 1 — `payment_status`, `items[].image`, `items[].article`.
- Produces: страница `/orders/{id}`; ссылки позиций `/product/{product_id}`.

- [ ] **Step 1: Типы**

В `b2b-portal/src/lib/types.ts`:

```ts
export interface OrderItem {
  id: number;
  product_id: number | null;
  name: string;
  quantity: number;
  price: number;
  image?: string | null;
  article?: string | null;
}
```

В `Order` после `status: string;` добавить:

```ts
  payment_status?: string;
```

- [ ] **Step 2: Переводы**

В `ru.json`, блок `account`, после `"emailLabel": "Email"` (добавив запятую):

```json
    "allOrders": "Все заказы",
    "items": "Товары",
    "article": "Арт.",
    "receiving": "Получение",
    "pickupFrom": "Самовывоз со склада",
    "apartment": "кв.",
    "payment": "Оплата",
    "comment": "Комментарий",
    "summary": "Сумма",
    "itemsCount": "Товары, {count} поз.",
    "deliveryCost": "Доставка",
    "total": "Итого",
    "loadFailed": "Заказ не найден или не удалось его загрузить.",
    "paymentStatus": {
      "unpaid": "Не оплачен",
      "paid": "Оплачен",
      "cancelled": "Оплата отменена",
      "failed": "Ошибка оплаты"
    }
```

В `kk.json`, блок `account`, после `"emailLabel"` (добавив запятую):

```json
    "allOrders": "Барлық тапсырыстар",
    "items": "Тауарлар",
    "article": "Арт.",
    "receiving": "Алу",
    "pickupFrom": "Қоймадан өзі алып кету",
    "apartment": "пәтер",
    "payment": "Төлем",
    "comment": "Түсініктеме",
    "summary": "Сома",
    "itemsCount": "Тауарлар, {count} дана",
    "deliveryCost": "Жеткізу",
    "total": "Барлығы",
    "loadFailed": "Тапсырыс табылмады немесе жүктеу мүмкін болмады.",
    "paymentStatus": {
      "unpaid": "Төленбеген",
      "paid": "Төленді",
      "cancelled": "Төлем жойылды",
      "failed": "Төлем қатесі"
    }
```

Проверка: `node -e "['ru','kk'].forEach(l=>JSON.parse(require('fs').readFileSync('src/messages/'+l+'.json')))"` из `b2b-portal/` — без ошибок.

- [ ] **Step 3: Страница**

`b2b-portal/src/app/(portal)/orders/[id]/page.tsx` целиком:

```tsx
"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiGet } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";
import { useB2bAuth } from "@/stores/useB2bAuth";

function pillClass(highlighted: boolean): string {
  return `rounded-full px-4 py-1.5 text-sm font-medium ${highlighted ? "bg-mint text-mint-ink" : "bg-black/5 text-muted"}`;
}

function ItemThumb({ item }: { item: OrderItem }) {
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-card">
      {item.image ? (
        <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          aria-hidden="true"
          className="absolute inset-0 m-auto h-8 w-8 text-line-strong"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 16 5-5 4 4 3-3 6 6" />
        </svg>
      )}
    </div>
  );
}

function ItemRow({ item, t }: { item: OrderItem; t: ReturnType<typeof useTranslations> }) {
  const body = (
    <>
      <ItemThumb item={item} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink group-hover:underline">{item.name}</p>
        {item.article ? (
          <p className="mt-0.5 text-xs text-muted">
            {t("article")} {item.article}
          </p>
        ) : null}
        <p className="mt-1 text-muted">
          {formatPrice(item.price, "ru")} × {Number(item.quantity)}
        </p>
      </div>
      <span className="whitespace-nowrap font-medium text-ink">{formatPrice(item.price * item.quantity, "ru")}</span>
    </>
  );

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      {item.product_id !== null ? (
        <Link href={`/product/${item.product_id}`} className="group flex items-center gap-4">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-4">{body}</div>
      )}
    </li>
  );
}

export default function B2BOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("account");
  const token = useB2bAuth((state) => state.token);
  const [order, setOrder] = useState<Order | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    setLoadFailed(false);
    void apiGet<{ data: Order }>(`/orders/${id}`, { token, locale: "ru", revalidate: false })
      .then((response) => setOrder(response.data))
      .catch(() => {
        setOrder(null);
        setLoadFailed(true);
      });
  }, [token, id]);

  if (loadFailed) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 py-20 text-center">
        <p className="text-muted">{t("loadFailed")}</p>
        <Link href="/orders" className="text-sm font-medium text-ink underline">
          {t("allOrders")}
        </Link>
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const items = order.items ?? [];
  const itemsSum = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const address = order.delivery_address;
  const addressLine = address
    ? [
        address.city,
        [address.street, address.building].filter(Boolean).join(" "),
        address.apartment ? `${t("apartment")} ${address.apartment}` : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="mx-auto max-w-5xl py-8">
      <div className="mb-6">
        <Link href="/orders" className="text-sm font-medium text-muted hover:text-ink transition inline-flex items-center gap-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {t("allOrders")}
        </Link>
      </div>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">
            {t("order")} {order.number}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {new Date(order.created_at).toLocaleString("ru-KZ", { dateStyle: "long", timeStyle: "short" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={pillClass(order.status === "completed" || order.status === "synced")}>
            {t(`status.${order.status}`)}
          </span>
          {order.payment_status ? (
            <span className={pillClass(order.payment_status === "paid")}>
              {t(`paymentStatus.${order.payment_status}`)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">{t("items")}</h2>
          <ul className="divide-y divide-line text-sm">
            {items.map((item) => (
              <ItemRow key={item.id} item={item} t={t} />
            ))}
          </ul>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-[120px]">
          <section className="rounded-2xl border border-line bg-white p-5 text-sm">
            <h2 className="mb-2 font-semibold text-ink">{t("receiving")}</h2>
            {order.delivery_method === "delivery" ? (
              <>
                <p className="text-ink">{t("receivingDelivery")}</p>
                {addressLine ? <p className="mt-1 text-muted">{addressLine}</p> : null}
                {address?.comment ? <p className="mt-1 text-muted">{address.comment}</p> : null}
              </>
            ) : (
              <>
                <p className="text-ink">{t("pickupFrom")}</p>
                {order.store_name ? <p className="mt-1 text-muted">{order.store_name}</p> : null}
              </>
            )}
          </section>

          {order.payment_status ? (
            <section className="rounded-2xl border border-line bg-white p-5 text-sm">
              <h2 className="mb-2 font-semibold text-ink">{t("payment")}</h2>
              <p className="text-ink">{t(`paymentStatus.${order.payment_status}`)}</p>
            </section>
          ) : null}

          {order.comment || order.contact_email ? (
            <section className="space-y-3 rounded-2xl border border-line bg-white p-5 text-sm">
              {order.comment ? (
                <div>
                  <h2 className="mb-1 font-semibold text-ink">{t("comment")}</h2>
                  <p className="whitespace-pre-line text-muted">{order.comment}</p>
                </div>
              ) : null}
              {order.contact_email ? (
                <div>
                  <h2 className="mb-1 font-semibold text-ink">{t("emailLabel")}</h2>
                  <p className="break-all text-muted">{order.contact_email}</p>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-2xl border border-line bg-white p-5 text-sm">
            <h2 className="mb-3 font-semibold text-ink">{t("summary")}</h2>
            <dl className="space-y-2">
              <div className="flex justify-between gap-4 text-muted">
                <dt>{t("itemsCount", { count: items.length })}</dt>
                <dd className="text-ink">{formatPrice(itemsSum, "ru")}</dd>
              </div>
              {order.delivery_cost > 0 ? (
                <div className="flex justify-between gap-4 text-muted">
                  <dt>{t("deliveryCost")}</dt>
                  <dd className="text-ink">{formatPrice(order.delivery_cost, "ru")}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t border-line pt-3 text-base">
                <dt className="font-semibold text-ink">{t("total")}</dt>
                <dd className="font-semibold text-ink">{formatPrice(order.total, "ru")}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
```

Итог — `order.total` из API, а не `itemsSum + delivery_cost`: итог принадлежит заказу, «Товары» — сумма напечатанных строк.

- [ ] **Step 4: Типы и сборка**

Run: `cd b2b-portal && npx tsc --noEmit && npm run build`
Expected: без ошибок; в выводе `next build` есть маршрут `/orders/[id]`.

- [ ] **Step 5: Коммит**

```bash
git add b2b-portal/src/lib/types.ts b2b-portal/src/messages/ru.json b2b-portal/src/messages/kk.json "b2b-portal/src/app/(portal)/orders/[id]/page.tsx"
git commit -m "feat(b2b-portal): order detail with line photos, product links and order details"
```

---

### Task 3: Проверка страницы в браузере

**Files:** нет изменений в репозитории; скрипт — во временной директории, запускается из `b2b-portal/` (нужен `@playwright/test`).

**Interfaces:**
- Consumes: страница из Task 2, дев-сервер портала из worktree.

- [ ] **Step 1: Поднять дев-сервер портала из worktree на свободном порту**

Run: `cd b2b-portal && npx next dev -p 3011` (в фоне). Дождаться `curl -s -o /dev/null -w "%{http_code}" http://localhost:3011/orders/9` → `200`.

- [ ] **Step 2: Прогнать Playwright-скрипт с подменённым API**

Скрипт кладёт сессию в `localStorage["paradise-b2b-auth"]` (`{state:{token:"t",user:{id:4,is_approved:true}},version:0}`), перехватывает `http://localhost:8000/api/**` и проверяет четыре сцены:

1. Доставка, `payment_status: "paid"`, комментарий, email, `delivery_cost: 5000`, две позиции (одна с `image`, `article`, `product_id: 2`; вторая с `product_id: null`, без фото): текст содержит «Доставка», адрес, «Оплачен», комментарий, email, «Товары, 2 поз.», «Доставка»; первая позиция — `a[href="/product/2"]` с `img`; вторая позиция не внутри `a`.
2. Клик по первой позиции → URL `/product/2`.
3. Самовывоз: «Самовывоз со склада» и название склада.
4. Ответ 404 → «Заказ не найден или не удалось его загрузить.»

Во всех сценах — нет `console.error` (кроме `Failed to load resource` на подменённые 404).

Expected: все проверки true.

- [ ] **Step 3: Остановить дев-сервер на 3011**
