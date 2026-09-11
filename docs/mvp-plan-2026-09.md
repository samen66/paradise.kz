# Paradise.kz — План выхода на MVP (без МойСклада)

> **Дата:** 2026-09-04 · **Ветка:** `main` (есть незакоммиченные изменения)
> **Цель MVP:** каталог и остатки видны на всех витринах; заказы принимаются и отрабатываются в админке.
> **Ключевое решение:** МойСклад убирается полностью. Источником правды по остаткам становится
> локальный FIFO-склад, который уже реализован (`Batch` / `StockMovement` / `ProductStoreStock` / `GoodsReceipt`).
>
> Документ заменяет `docs/mvp-audit-tasks-and-tests.md` (аудит от 2026-07-23) в части каталога,
> остатков и заказов. Формат — под скармливание в Claude Code / Cursor: каждая задача содержит
> файлы, суть правки, приёмочный критерий и тест.

---

## 0. TL;DR — что нужно сделать

| # | Блок | Задач P0 | Суть |
|---|------|----------|------|
| A | Остатки | 5 | Агрегат `products.stock` не пересчитывается локально → «товар есть, а его нет». Главный блокер. |
| B | Каталог | 3 | В `admin/` нельзя создать товар; форма сохранения теряет половину полей. |
| C | Заказы | 6 | `PushOrderJob` роняет каждый заказ в `failed`; отмена заказа не возвращает остаток; одобрение B2B-клиента падало без ERP. |
| D | Отказ от МойСклада | 4 | Провайдер, крон, вебхуки, статусы `synced`/`failed`. |
| E | Инфраструктура | 4 | `admin/` и `b2b-portal/` не собираются в CI и не деплоятся. `b2b-portal/` вообще вне git. |

**Итого 22 задачи P0.** Порядок: **D → A → B → C → E** (сначала убрать ERP, иначе правки по остаткам конфликтуют с sync-джобами).

---

## 1. Что уже работает — не трогаем

Проект гораздо ближе к MVP, чем кажется. Готово и покрыто тестами:

**Backend**
- Локальный складской учёт: `FifoInventoryService` (партии, себестоимость, append-only ledger `stock_movements`), `GoodsReceiptService` (проведение приёмки), проекция `product_store_stock` (кол-во + средняя себестоимость).
- Размещение заказа: `OrderPlacementService` с тремя входами — `place()` (B2B), `placeGuest()` (аноним), `placeRetail()` (B2C с логином). Проверки: видимость → остаток → цена, снимок цен в копейках, списание через FIFO в транзакции.
- Ценообразование: `PricingService` — `b2b` → `retail` price type → legacy-колонки `products.b2b_price` / `retail_price`, плюс персональные `client_product_prices` и `discount_percent`.
- Видимость: `VisibilityService` — каталожные группы, публичный каталог = товары без групп.
- Статусная модель заказа уже расширенная: `pending / confirmed / in_delivery / completed / cancelled` (+ legacy `synced` / `failed`).
- `OrderObserver` → `SendWhatsAppNotificationJob` на смену статуса.
- API: публичный каталог с фильтрами/фасетами/сортировкой, B2B каталог, гостевой checkout, отслеживание заказа по номеру+телефону, личный кабинет, OTP-вход.
- Админ-API: `/api/admin/{products,categories,brands,orders,users}` под `role:admin|manager`.
- ~40 feature-тестов.

**Frontend**
- `storefront/` — B2C, i18n (ru/kk), каталог, карточка, корзина, checkout, кабинет.
- `b2b-portal/` — вынесен из storefront в отдельное Next-приложение: логин/регистрация/pending, каталог, карточка, корзина, checkout + success, заказы, профиль, быстрый заказ по артикулам.
- `admin/` — Next.js SPA: логин, товары (список + редактирование), заказы (список + деталь + смена статуса), клиенты B2B + одобрение, категории, бренды.
- Filament-админка (`/admin` на Laravel) — 16 ресурсов, включая **приёмки (GoodsReceipts), склады (Stores), поставщиков, типы цен**. Этого в `admin/` нет.

**Инфраструктура**
- `docker-compose.dev.yml` / `.prod.yml`, `Dockerfile`, nginx-конфиги для `api.paradise.kz` и `shop.paradise.kz`, GitHub Actions: `ci.yml`, `deploy.yml`, `rollback.yml`, `deploy/scripts/backup.sh`.

---

## 2. Решение по архитектуре: две админки

Сейчас админок две: **Filament** (`/admin` в Laravel) и **`admin/`** (Next.js SPA). Склад, приёмки, склады-warehouse'ы, типы цен, баннеры, CMS-страницы есть **только в Filament**.

**Рекомендация для MVP: оставить обе.**
- `admin/` (Next.js) — операционка менеджера: заказы, статусы, товары, клиенты.
- Filament — «бэк-офис»: приёмки, склады, типы цен, CMS, баннеры, отзывы.

Переписывать приёмки на Next.js до запуска — недели работы ради нулевой пользы для клиента.
Задача **A4** ниже — минимальный мост между ними (ссылка + один экран остатков).

> Если решишь всё-таки уйти от Filament — это отдельный проект после MVP, не блокер.

---

## 3. Блок D — убрать МойСклад (делать первым)

Архитектура уже провайдерная: `ErpServiceProvider` резолвит `config('erp.provider')` в три контракта —
`CatalogSource`, `OrderTarget`, `WebhookHandler`. Поэтому «убрать МойСклад» = добавить пустого провайдера
и выключить точки входа, а не выпиливать код по всему проекту.

### D1 — Провайдер `local` (no-op) вместо `moysklad` — P0 ✅ сделано

**Файлы:**
- `config/erp.php` — `'provider' => env('ERP_PROVIDER', 'local')`, добавить `'local' => LocalErpProvider::class`.
- Новый `app/Services/Local/LocalErpProvider.php` + `LocalCatalogSource.php` + `LocalOrderTarget.php` + `LocalWebhookHandler.php`.

**Суть:**
`LocalCatalogSource::key()` → `'local'`; `products()`, `productFolders()`, `stores()`, `productVariants()` —
пустые генераторы; `stockByStore()` → `[]`; `product()` → `null`; `fetchImageBinary()` → бросает
`RuntimeException`. `LocalOrderTarget::push()` — no-op, возвращает `PushedOrder` с пустым external id
(или бросает `UnsupportedOperationException`, если решишь гейтить на уровне джобы — см. C1).
`LocalWebhookHandler::handle()` — no-op.

**Почему так, а не `rm -rf app/Services/MoySklad`:** контракты используются в 8 джобах, 2 контроллерах,
2 командах и ~10 тестах. Пустой провайдер выключает интеграцию одной строкой в `.env` и оставляет
возможность вернуть ERP позже. Физическое удаление кода МойСклада — задача **D4**, после зелёных тестов.

**Сделано:** `app/Services/Local/{LocalErpProvider,LocalCatalogSource,LocalOrderTarget,LocalWebhookHandler}.php`,
`config/erp.php` (`provider` по умолчанию `local`), `ERP_PROVIDER=local` в `.env`, `.env.example`,
`.env.production.example`.

**Отступление от плана:** ключ `moysklad` остался зарегистрированным в карте провайдеров,
а семь тестов легаси-интеграции получили в `setUp()` строку `config(['erp.provider' => 'moysklad'])`.
Так рантайм полностью на `local`, а тестовый набор остаётся зелёным до D4, когда провайдер,
код и тесты удаляются одним коммитом.

**Приёмка:** `ERP_PROVIDER=local` → `php artisan tinker` → `app(CatalogSource::class)->key() === 'local'`.

### D2 — Выключить крон-синхронизацию — P0 ✅ сделано

**Файл:** `routes/console.php`

Убрать обе записи: `Schedule::command('moysklad:sync')` и `catalog:generate-product-slugs`
(вторая — backfill под bulk-upsert'ы синка, локально созданные товары получают slug сами, см. B1).
После этого `routes/console.php` не содержит расписания вовсе.

**Приёмка:** `php artisan schedule:list` не содержит `moysklad:sync`.

### D3 — Обезвредить вебхук-роут — P0 ✅ сделано

**Файл:** `routes/api.php`

Роут `POST /api/moysklad/webhook` оставлен, но под провайдером `local` его обработчик
(`LocalWebhookHandler::verify()`) возвращает `false` → **401 на любой запрос**. Fail-closed.
Роут `POST /kaspi/webhook` не тронут — он к МойСкладу не относится.

**Почему не удалили сразу:** удаление роута ломает `tests/Feature/MoySklad/WebhookTest.php`,
а он должен дожить до D4 вместе с остальной интеграцией. Полное удаление — в D4.

**Приёмка:** `POST /api/moysklad/webhook` с любым секретом → 401.

### D4 — Зачистка кода и .env — P0 (после зелёных тестов)

Удалить: `app/Services/MoySklad/`, `app/Console/Commands/SyncMoySkladCommand.php`,
`RegisterMoySkladWebhooksCommand.php`, `app/Http/Controllers/Api/MoySkladWebhookController.php`,
`config/moysklad.php`, `docs/moysklad-integration-notes.md`, `tests/Feature/MoySklad/`, `tests/Unit/MoySklad/`.
(`docs/moysklad-api/` в git не хранится — он в `.gitignore`, удалить локально.)
Из `.env` / `.env.example` / `.env.production.example` — все `MOYSKLAD_*`.

**Что НЕ удалять:** `product_external_mappings` (таблица и модель), колонки `stores.source` /
`external_id`, джобы `app/Jobs/Catalog/*` — они написаны на контракт, а не на МойСклад, и понадобятся
при импорте из любого другого источника. Просто перестанут вызываться.

**Приёмка:** `grep -ri moysklad app/ config/ routes/` пусто; `php artisan test` зелёный.

---

## 4. Блок A — остатки (главный блокер MVP)

### Как остатки устроены сейчас

```
Приёмка (GoodsReceipt) ──post()──> FifoInventoryService::receive()
                                        │
Заказ (OrderPlacement)  ──issue()──>    ├─> batches (слои FIFO)
                                        ├─> stock_movements (журнал)
                                        └─> product_store_stock.stock   ← проекция, обновляется
                                                                          refreshProjection()

products.stock (агрегат по всем складам)  ← обновляется ТОЛЬКО в SyncStockJob::recomputeAggregateStock()
```

Чтение на витрине (`PublicProductPresenter::enrich`, `app/Services/Catalog/PublicProductPresenter.php:38`):

```php
$product->resolved_stock = $storeStock > 0 ? $storeStock : (float) $product->stock;
```

### A1 — `products.stock` не пересчитывается после локальных операций — P0 🔴 ✅ сделано

**Это баг №1 всего MVP.** Убираем МойСклад → `SyncStockJob` больше не запускается → `products.stock`
навсегда застывает в том значении, в котором был последний синк (или `0` для товаров, созданных в админке).

Последствия:
- товар приняли на склад → `product_store_stock` = 10, `products.stock` = 0;
- товар распродали → `product_store_stock` = 0, `products.stock` = 5 → **витрина показывает «в наличии», заказ падает на 422**;
- фильтр `filter[in_stock]=1` врёт в обе стороны (`app/Http/Controllers/Api/Public/ProductController.php:74`, `app/Http/Controllers/Api/ProductController.php:59`).

**Файл:** `app/Services/Inventory/FifoInventoryService.php`, метод `refreshProjection()`

**Суть правки:** после `ProductStoreStock::updateOrCreate(...)` пересчитать агрегат:

```php
DB::table('products')->where('id', $product->id)->update([
    'stock' => DB::raw('(SELECT COALESCE(SUM(stock), 0) FROM product_store_stock WHERE product_store_stock.product_id = products.id)'),
]);
```

(SQL уже написан в `SyncStockJob::recomputeAggregateStock()` — переиспользовать один-в-один.)

**Приёмка:**
- принять 10 шт на склад → `products.stock === 10.000`;
- продать 3 → `products.stock === 7.000`;
- продать остаток → `products.stock === 0.000`.

**Сделано:** `FifoInventoryService::recomputeAggregateStock()` (публичный статический метод) вызывается
из `refreshProjection()`; `SyncStockJob` теперь делегирует туда же, чтобы SQL был в одном месте.
Добавлена команда `php artisan stock:recompute` — разовый пересчёт всей базы (нужен на проде, где
агрегат уже разошёлся).

**Тест:** `tests/Feature/Inventory/AggregateStockTest.php` — 5 кейсов: приход, расход, распродажа
в ноль, сумма по двум складам, ремонт разошедшегося агрегата командой.

### A2 — убрать fallback на `products.stock` при известном складе — P0 🔴 ✅ сделано

**Файлы:**
- `app/Services/Catalog/PublicProductPresenter.php:38`
- `app/Services/Orders/OrderPlacementService.php` — `buildLines()` и `buildGuestLines()`, строки вида
  `$availableStock = $storeStock > 0 ? $storeStock : (float) $product->stock;`

**Суть:** `$storeStock > 0 ? $storeStock : $product->stock` означает «если на складе ноль — покажи агрегат».
То есть **ноль всегда маскируется**. Правильно:

```php
$resolved = $store !== null
    ? (float) ($stocks[$product->id] ?? 0)   // склад выбран → его остаток, включая 0
    : (float) $product->stock;               // склада нет → агрегат по всем складам
```

**Приёмка:** товар с `product_store_stock.stock = 0` на выбранном складе и `products.stock = 5`
→ `in_stock: false`, кнопка «В корзину» неактивна, `POST /public/checkout` → 422.

**Сделано:** правка в трёх местах, не в двух — тот же fallback нашёлся ещё и в
`app/Http/Controllers/Api/Public/CartController.php` (корзина обещала товар, которого нет,
а checkout потом отдавал 422). B2B-контроллер (`Api/ProductController`) оказался уже корректным.

**Тест:** `tests/Feature/Public/StockVisibilityTest.php` — 5 кейсов: каталог, приход, фильтр
`in_stock`, корзина, checkout.

### A3 — приёмка не создаёт остаток без склада по умолчанию — P0 ✅ сделано (частично)

**Файлы:** `database/seeders/DatabaseSeeder.php`, новый `database/seeders/DefaultStoreSeeder.php`

`StoreResolver::resolve()` при отсутствии активных складов возвращает `null` → `PublicProductPresenter`
падает на агрегат, `OrderPlacementService::place()` делает `Store::findOrFail($storeId)` → 404 на checkout.

**Суть:** сидер создаёт один склад `is_default = true, is_active = true, type = 'warehouse'`
(`source` и `external_id` — `null`, миграция это уже разрешает).
Плюс в `admin/` на дашборде — предупреждение, если активных складов нет.

**Сделано:** `database/seeders/DefaultStoreSeeder.php` (идемпотентный, не трогает существующие склады),
подключён в `DatabaseSeeder`. **Осталось:** предупреждение в `admin/`, если активных складов нет.

**Приёмка:** на чистой БД после `migrate --seed` гостевой checkout проходит без ручной настройки.

### A4 — управление остатками недоступно в `admin/` — P0

Сейчас единственный способ завести остаток — Filament: **Приёмки → создать → провести**.
В `admin/` (`admin/src/components/Sidebar.tsx`) пунктов «Склад» и «Приёмки» нет вообще.

**Минимальный вариант для MVP (рекомендую):**
1. В `Sidebar.tsx` добавить внешнюю ссылку «Склад и приёмки» → `${NEXT_PUBLIC_API_URL}/admin/goods-receipts` (Filament).
2. Новый read-only экран `admin/src/app/stock/page.tsx`: таблица «товар / склад / остаток / средняя себестоимость»
   c поиском — чтобы менеджер видел остатки, не уходя из админки.
3. Новый эндпоинт `GET /api/admin/stock` (`app/Http/Controllers/Api/Admin/StockController.php`):
   `ProductStoreStock` + `with('product', 'store')`, фильтры `filter[search]`, `filter[store_id]`,
   `filter[low]` (остаток ≤ N), пагинация 50.

**Полный вариант (после MVP):** страницы приёмок и корректировок на Next.js.

**Приёмка:** менеджер видит актуальные остатки в `admin/` и может провести приёмку в 2 клика.

### A5 — поле `stock` редактируется вручную в Filament, минуя журнал — P0 ✅ сделано

**Файлы:** `app/Filament/Resources/Products/Schemas/ProductForm.php:74`,
`app/Filament/Resources/CatalogGroups/RelationManagers/ProductsRelationManager.php:48`

`TextInput::make('stock')` пишет в `products.stock` напрямую. С задачей A1 это значение будет затираться
при первом же движении товара, а до тех пор — расходиться с `product_store_stock`. Классический
«остаток в двух местах».

**Сделано:** в `ProductForm` поле уже было `->disabled()`, но с подсказкой «синхронизируется из
МойСклад» — добавлен явный `->dehydrated(false)` и новая строка перевода `admin.helpers.stock_readonly`
(ru + kk). В `CatalogGroups/ProductsRelationManager` поле было **полностью редактируемым** — закрыто.

**Попутно найдено и исправлено:** три места в Filament ссылались на `products.synced_at` — колонку,
удалённую миграцией `2026_08_20_000001` (она переехала в `product_external_mappings`):
`ProductsTable`, `ProductForm`, `CatalogGroups/ProductsRelationManager`. Удалены вместе с
неиспользуемыми импортами. Вариантный `synced_at` оставлен — у `product_variants` колонка есть.

**Приёмка:** сохранение товара в Filament не меняет `products.stock`.

---

## 5. Блок B — каталог

### B1 — убрать крон-backfill слагов — P2 (не блокер)

**Файлы:** `app/Console/Commands/GenerateProductSlugsCommand.php`, `routes/console.php`

**Проверено по коду — здесь всё в порядке:** `Product::booted()` (`app/Models/Product.php:82-88`) вешает
хук `static::created()`, который генерирует slug из `name.ru` + id и сохраняет через `saveQuietly()`.
Товар, созданный в `admin/` или в Filament, получает slug **сразу**. Команда
`catalog:generate-product-slugs` — только backfill под bulk-upsert'ы ERP-синка, которые обходили
события модели. После D1–D3 таких upsert'ов не остаётся.

**Суть:** удалить команду и её запись в `routes/console.php` (вместе с `moysklad:sync` — задача D2).

**Мелкий побочный дефект (P2):** `ProductObserver::saved()` срабатывает **до** присвоения slug,
поэтому при создании товара тег ревалидации `product-{slug}` не отправляется — карточка нового товара
в кэше Next.js появится только по следующему `saved`. Лечится генерацией slug в `creating()` через
временный уникальный суффикс либо повторным `ProductUpdated::dispatch()` в хуке `created`.

**Приёмка:** `php artisan schedule:list` пуст; новый товар открывается по `/product/{slug}` сразу.

### B2 — создание товара в `admin/` — ✅ уже сделано (было в WIP)

**Уточнение к первой редакции плана.** Я написал, что страницы создания нет. Это неверно:
`admin/src/app/products/[id]/page.tsx` работает в двух режимах — `id === 'create'` включает создание,
а кнопка «Создать товар» на `admin/src/app/products/page.tsx` (строка 60) ведёт на `/products/create`.
Отдельная страница `new/` не нужна.

Остаётся только то, что реально не хватает форме — см. B3.

### B3 — `ProductSaveRequest` не покрывает поля, нужные витрине — P0

**Файл:** `app/Http/Requests/Admin/ProductSaveRequest.php`

Сейчас валидируются только: `name`, `description`, `category_id`, `brand_id`, `retail_price`,
`b2b_price`, `is_active`, `is_new_arrival`, `images`.

**Добавить:** `code`, `article`, `slug` (nullable, unique), `compare_at_price`, `uom`, `country`,
`supplier`, `weight`, `volume`, `min_price`, `purchase_price`, `b2b_min_order_qty`, `seo_title`, `seo_description`.
**Не добавлять:** `stock` — см. A5.

**Приёмка:** редактирование товара в `admin/` не теряет поля, заполненные в Filament.

### B4 — товар без цены молча исчезает из каталога — P0

`PricingService::RETAIL_PRICE_SQL` и `OrderPlacementService` возвращают `null` при отсутствии цены;
`VisibilityService` такой товар из публичного каталога исключает. Менеджер не понимает, почему товар «пропал».

**Файлы:** `admin/src/app/products/page.tsx`, `app/Http/Controllers/Api/Admin/ProductController.php`

**Суть:** в списке товаров админки — бейдж-предупреждение «Нет цены» / «Нет остатка» / «Скрыт группой»
(вычисляется на бэке, отдаётся полем `issues: string[]`), плюс фильтр `filter[issues]=1`.

**Приёмка:** менеджер за один взгляд видит, какие товары не доедут до витрины.

---

## 6. Блок C — заказы

### C1 — каждый заказ немедленно уходит в статус `failed` — P0 🔴 ✅ сделано

**Файлы:** `app/Http/Controllers/Api/Public/CheckoutController.php:61`,
`app/Http/Controllers/Api/OrderController.php:58`,
`app/Filament/Resources/Orders/Tables/OrdersTable.php:122`

После размещения заказа диспатчится `PushOrderJob`. В нём (`app/Jobs/Erp/PushOrderJob.php:57-66`):

```php
$counterpartyId = $order->user->external_counterparty_id;
if (blank($counterpartyId)) {
    $order->update(['status' => Order::STATUS_FAILED, 'error' => 'client is not linked to an ERP counterparty']);
    return;
}
```

У гостя `external_counterparty_id` пустой **всегда**. Значит **любой заказ с B2C-витрины уже сейчас
через секунду после оформления становится `failed`** — менеджер видит «Ошибка», клиент получает
статус, которого не понимает. Это происходит и без удаления МойСклада; с удалением — станет так и для B2B.

**Суть правки:**
1. Убрать `PushOrderJob::dispatch($order)` из `CheckoutController` и `Api\OrderController`.
2. Убрать action «Отправить в ERP» из `OrdersTable.php`.
3. Файл `app/Jobs/Erp/PushOrderJob.php` — оставить (он написан на контракт `OrderTarget`), но не вызывать.
   Либо удалить вместе с `SyncOrderStatusJob` и их тестами в рамках D4.

**Приёмка:** гостевой checkout → заказ создан со статусом `pending` и остаётся `pending`.

**Сделано:** dispatch убран из `CheckoutController` и `Api\OrderController`, action «Повторить отправку»
удалён из Filament `OrdersTable`. Сам `PushOrderJob` оставлен на месте до D4.

**Тест:** `GuestCheckoutTest` — `Bus::assertNotDispatched(PushOrderJob::class)` + статус `pending`;
`OrderApiTest` — то же для B2B, тест переименован в `it_places_an_order_with_snapshotted_per_client_prices`.

### C2 — отмена заказа не возвращает товар на склад — P0 🔴

**Файл:** `app/Http/Controllers/Api/Account/OrderController.php:43-58`

```php
$order->update(['status' => Order::STATUS_CANCELLED]);
```

Списание при размещении было (`FifoInventoryService::issue`), возврата при отмене — нет. Каждая отмена
безвозвратно съедает остаток. То же в админке: `Api\Admin\OrderController::update()` меняет статус
на `cancelled`, ничего не возвращая.

**Суть правки:** новый `app/Services/Orders/OrderCancellationService.php`:

```php
public function cancel(Order $order, ?User $actor = null): Order
{
    // guard: уже отменён / завершён — 422
    return DB::transaction(function () use ($order, $actor) {
        foreach ($order->items as $item) {
            $this->inventory->receive(
                product: $item->product,
                store: $order->store,
                quantity: (float) $item->quantity,
                unitCost: $this->originalUnitCost($order, $item),  // из stock_movements этого заказа
                document: $order,
                user: $actor,
            );
        }
        return tap($order)->update(['status' => Order::STATUS_CANCELLED]);
    });
}
```

Себестоимость возврата брать из `stock_movements`, где `documentable_type = Order::class`
и `documentable_id = $order->id` — так возврат ложится обратно теми же слоями, а не по нулевой цене.
Тип движения — `StockMovement::TYPE_RETURN` (константа уже есть); значит `FifoInventoryService::receive()`
нужно расширить необязательным параметром `string $type = StockMovement::TYPE_RECEIPT`.

Вызывать из: `Api\Account\OrderController::cancel()`, `Api\Admin\OrderController::update()` (при переходе
в `cancelled`), Filament OrdersTable.

**Приёмка:** заказ на 3 шт → отмена → `product_store_stock.stock` вырос на 3, `products.stock` вырос на 3,
в `stock_movements` появилась строка `type = return`. Повторная отмена → 422.

**Тест:** `tests/Feature/Orders/OrderCancelTest.php` — файл уже есть, но в нём только 2 кейса
(`customer_can_cancel_pending_order`, `customer_cannot_cancel_confirmed_order`) и **возврат остатка не проверяется**.
Дополнить: остаток вернулся на склад, `products.stock` вырос, движение `type = return` создано,
повторная отмена → 422, отмена чужого заказа → 404.

### C3 — статусы `synced` / `failed` больше не имеют смысла — P0

**Файлы:** `app/Models/Order.php` (`ALL_STATUSES`), `admin/src/app/orders/page.tsx` (`ALL_STATUSES`,
`STATUS_LABELS`, `STATUS_STYLES`), `admin/src/app/orders/[id]/page.tsx`, Filament OrdersTable/Infolist.

**Суть:** убрать `synced` и `failed` из выпадающих списков и легенды. В `Order::ALL_STATUSES` оставить
их временно (в БД есть исторические строки), но добавить `Order::CLIENT_STATUSES` — набор, который
показывается и назначается в UI: `pending, confirmed, in_delivery, completed, cancelled`.
Валидацию в `Api\Admin\OrderController::update()` перевести на `CLIENT_STATUSES`.

**Приёмка:** менеджер не может выставить `synced`/`failed`; старые заказы с этими статусами открываются без ошибок.

### C4 — WhatsApp-уведомления не настроены — P0

**Файлы:** `app/Services/WhatsApp/WhatsAppService.php`, Filament `CatalogSettings`, `.env.production.example`

Сервис написан под GreenAPI-подобный провайдер и при пустых настройках просто пишет warning в лог.
Поля `whatsapp_api_url` / `whatsapp_api_key` / `whatsapp_instance_id` в `catalog_settings` есть.

**Суть:** завести аккаунт у провайдера, заполнить настройки, проверить отправку. Плюс два улучшения:
- в `OrderObserver` добавить сообщение для `cancelled`;
- добавить уведомление менеджеру о **новом** заказе (сейчас уведомления только клиенту) — иначе
  «заказы отрабатываются» держится на том, что менеджер сам обновляет страницу.

**Приёмка:** оформление заказа → менеджеру приходит WhatsApp; смена статуса → клиенту приходит WhatsApp.

**Тест:** `tests/Feature/Orders/WhatsAppNotificationTest.php` — `Http::fake()` + проверка payload.

---

## 7. Блок E — инфраструктура

### E1 — `b2b-portal/` вне git — P0 🔴

`git status` показывает `?? b2b-portal/` — целое приложение не закоммичено, при этом соответствующие
страницы из `storefront/src/app/b2b/` **удалены**. Любой деплой или `git clean` уничтожит портал.

**Действие:** `git add b2b-portal config/cors.php && git commit`. Свой `b2b-portal/.gitignore` уже на месте
(`node_modules` / `.next` не попадут), корневой `.gitignore` менять не нужно. Заодно разобрать текущий WIP:
33 изменённых файла, включая удаление `storefront/src/app/b2b/**` — эти удаления должны попасть в тот же коммит,
иначе на проде останутся две B2B-витрины.

**Приёмка:** `git status` чистый; `git archive HEAD | tar t | grep b2b-portal` не пусто.

### E2 — `admin/` не деплоится — P0

**Файлы:** `docker-compose.prod.yml`, `deploy/nginx/` (новый `admin.paradise.kz.conf`),
`.github/workflows/deploy.yml`, `admin/Dockerfile` (нет — создать по образцу `b2b-portal/Dockerfile`).

В prod-компоузе есть `storefront` и `b2b-portal`, `admin` — нет. Nginx-конфига для админки тоже нет.

**Суть:** три поддомена — `shop.paradise.kz` (B2C), `b2b.paradise.kz` (портал), `admin.paradise.kz` (админка),
`api.paradise.kz` (Laravel + Filament на `/admin`). Не забыть `SANCTUM_STATEFUL_DOMAINS` и
`config/cors.php` для новых origin'ов.

**Приёмка:** `docker compose -f docker-compose.prod.yml config` содержит сервис `admin`;
админка открывается по HTTPS и логинится.

### E3 — CI не проверяет `admin/` и `b2b-portal/` — P0

**Файл:** `.github/workflows/ci.yml`

Сейчас typecheck только для `storefront`. Добавить матрицу:

```yaml
strategy:
  matrix:
    app: [storefront, b2b-portal, admin]
```

и `npx tsc --noEmit` + `npm run build` в каждом.

**Приёмка:** PR со сломанным типом в `admin/` красит CI.

### E4 — прод-конфиг после удаления МойСклада — P0

**Файлы:** `.env.production.example`, `deploy/README.md`, `CLAUDE.md`, `AGENTS.md`

`.env.production.example` содержит `MOYSKLAD_*`; `CLAUDE.md` описывает проект как «Laravel + Filament»
и не знает про три Next-приложения; `AGENTS.md` пункт №1 гласит «ERP — источник правды», что после
этого плана прямо противоположно реальности.

**Суть:** привести документацию в соответствие. `AGENTS.md` #1 переписать на:
«**Источник правды по остаткам — локальный FIFO-журнал (`stock_movements`). Ни один код не пишет
в `products.stock` и `product_store_stock` напрямую — только через `FifoInventoryService`.**»

**Приёмка:** новый разработчик (или Claude Code) по `CLAUDE.md` понимает актуальную архитектуру.

---

## 8. Порядок работ

```
Спринт 1 (убрать ERP + починить остатки)   D1 → D2 → D3 → A1 → A2 → A3 → A5 → C1
Спринт 2 (заказы отрабатываются)           C2 → C3 → C4 → A4
Спринт 3 (каталог управляем из админки)    B2 → B3 → B4 → B1
Спринт 4 (деплой)                          E1 → E2 → E3 → E4 → D4
```

Зависимости, которые нельзя нарушить:
- **D1–D3 строго перед A1**, иначе `SyncStockJob` будет затирать локальные остатки во время правок.
- **A1 перед A2** — иначе, убрав fallback, получишь нули по всему каталогу.
- **C2 после A1** — возврат остатка проверяется через агрегат.
- **D4 последним** — удалять код МойСклада только когда всё зелёное.

---

## 9. Приёмочные сценарии MVP (ручная проверка перед запуском)

Прогнать на чистой БД (`migrate:fresh --seed`) целиком, в этом порядке.

### Сценарий 1 — товар доезжает до витрины
1. Filament → Склады → есть склад по умолчанию.
2. `admin/` → Товары → Создать: название, категория, розничная цена, фото. Сохранить.
3. Filament → Приёмки → создать на этот товар 10 шт по себестоимости X → **Провести**.
4. `admin/` → Склад → остаток 10.
5. `shop.paradise.kz` → товар в каталоге, «в наличии», остаток 10, карточка открывается по slug.
6. `b2b.paradise.kz` (под одобренным B2B-клиентом) → тот же товар, **оптовая** цена.

### Сценарий 2 — B2C-заказ принимается и отрабатывается
1. Гость: добавить 3 шт в корзину → checkout (самовывоз) → успех, номер `P-XXXXXX`.
2. Остаток на витрине стал 7. `products.stock` = 7, `product_store_stock.stock` = 7.
3. `admin/` → Заказы → заказ в статусе **«Новый»** (не «Ошибка»).
4. Менеджеру пришёл WhatsApp о новом заказе.
5. Смена статуса «Подтверждён» → «В доставке» → «Завершён»; на каждом шаге клиенту уходит WhatsApp.
6. Гость: `/order-tracking` по номеру + телефону → видит актуальный статус.

### Сценарий 3 — B2B-заказ
1. Регистрация B2B → статус pending → `admin/` → Клиенты → **Одобрить**.
2. Логин в портал → каталог с оптовыми ценами → быстрый заказ по артикулам → checkout.
3. Заказ виден в `admin/` и в `/orders` портала, остаток списался.

### Сценарий 4 — отмена возвращает остаток
1. Заказ на 3 шт → остаток 7.
2. Клиент отменяет в кабинете (или менеджер в админке) → остаток снова 10.
3. `stock_movements` содержит `sale -3` и `return +3` по этому заказу.

### Сценарий 5 — распроданный товар не заказать
1. Выкупить весь остаток.
2. Витрина: «Нет в наличии», кнопка неактивна, фильтр «только в наличии» товар не показывает.
3. Прямой `POST /api/public/checkout` этим товаром → 422 с русским сообщением.

---

## 10. Тесты, которые надо написать

| Файл | Кейсов | Блок |
|------|--------|------|
| `tests/Feature/Inventory/AggregateStockTest.php` | 3 | A1 |
| `tests/Feature/Public/StockVisibilityTest.php` | 3 | A2 |
| `tests/Feature/Orders/OrderCancelTest.php` (дополнить) | +3 | C2 |
| `tests/Feature/Orders/WhatsAppNotificationTest.php` | 2 | C4 |
| `tests/Feature/Admin/StockApiTest.php` | 2 | A4 |
| `tests/Feature/Admin/ProductCrudTest.php` | 3 | B2, B3 |
| `tests/Feature/Public/GuestCheckoutTest.php` (дополнить) | +2 | C1 |

**Существующие тесты, которые сломаются от D1–D3** — их надо не «чинить», а удалить вместе с интеграцией
(задача D4): `tests/Feature/MoySklad/*` (6 файлов, включая `SyncOrderStatusJobTest.php`),
`tests/Unit/MoySklad/*` (3 файла), `tests/Feature/Orders/PushOrderJobTest.php`.

E2E (Playwright, `storefront/e2e/`) — из аудита от 2026-07-23 остаётся актуальным пункт 11.1;
для MVP достаточно двух smoke-сценариев: гостевой checkout и B2B-заказ.

---

## 11. Что осознанно выносим ЗА пределы MVP

Чтобы не размывать скоуп — эти пункты из аудита 2026-07-23 **не блокируют** запуск:

- Kaspi Pay (задачи 4.1–4.3 старого аудита) — на MVP оплата при получении / переводом. `KaspiWebhookController` остаётся заглушкой.
- Shorts-видео, AI-ассистент, AI-подбор интерьера, страница шоурумов.
- Казахская локализация интерфейса (`kk`) — API уже переводит, интерфейс можно доперевести после.
- Переписывание Filament-бэкофиса на Next.js.
- Order timeline, JSON-LD, accessibility audit, dashboard-статистика.
- Возврат `synced`/интеграции с любым ERP.

---

## 12. Риски

| Риск | Вероятность | Что делать |
|------|-------------|------------|
| В проде уже есть заказы в статусе `failed` из-за C1 | Высокая | Миграция данных: `UPDATE orders SET status='pending' WHERE status='failed'` — но **сверить вручную**, не списан ли остаток дважды. |
| `products.stock` в проде разошёлся с `product_store_stock` | Высокая | Одноразовая команда `php artisan stock:recompute` — пересчёт агрегата по всем товарам. Написать в рамках A1. |
| Товары без цены после отказа от синка невидимы в каталоге | Средняя | Задача B4 (бейджи) + разовый отчёт перед запуском. |
| Незакоммиченные правки в `main` (33 файла) конфликтуют с планом | Средняя | Сначала разобрать и закоммитить текущий WIP (auth SPA, sanctum, cors), потом начинать спринт 1. |
| Два источника правды по остаткам (Filament-поле `stock` и журнал) | Высокая | Задача A5 — закрыть поле. |

---

## 13. Чеклист (копировать в трекер)

```
СПРИНТ 1 — убрать ERP + остатки          ✅ ЗАКРЫТ (кроме одного хвоста)
[x] D1  LocalErpProvider + config/erp.php (ERP_PROVIDER=local)
[x] D2  убрать расписание из routes/console.php
[x] D3  вебхук-роут обезврежен (401 под провайдером local)
[x] A1  FifoInventoryService::refreshProjection → пересчёт products.stock  🔴
[x] A1b команда artisan stock:recompute (разовый пересчёт прода)
[x] A2  убрать fallback storeStock>0?:products.stock (presenter + cart + OrderPlacementService)  🔴
[x] A3  DefaultStoreSeeder
[ ] A3b предупреждение в admin/, если нет активных складов
[x] A5  поле stock read-only в обеих Filament-формах + удалены мёртвые ссылки на products.synced_at
[x] C1  убрать PushOrderJob::dispatch (checkout, orders, Filament action)  🔴
[x] C5  ApproveClient: не дёргать createCounterparty без ERP (найдено прогоном тестов)  🔴

СПРИНТ 2 — заказы отрабатываются         ✅ ЗАКРЫТ (кроме настройки WhatsApp)
[x] C2  OrderCancellationService + возврат остатка (TYPE_RETURN)  🔴
[x] C3  Order::CLIENT_STATUSES, synced/failed больше не назначаются (API, admin/, Filament)
[x] C4  уведомление менеджеру о новом заказе + текст для отменённого заказа
[ ] C4b завести аккаунт у WhatsApp-провайдера и заполнить настройки в CatalogSettings
[x] A4  GET /api/admin/stock + экран «Склад» в admin/ + ссылка на приёмки
[x] C6  order_items.external_product_id → nullable (checkout падал с 500)  🔴

СПРИНТ 3 — каталог из админки            ✅ ЗАКРЫТ
[x] B2  создание товара — уже работало через /products/create
[x] B3  ProductSaveRequest + форма: все поля товара, селект брендов, SEO
[x] B4  бейджи «почему товар не на витрине» + фильтр «только проблемные»
[ ] B1  удалить catalog:generate-product-slugs (P2, не блокер)

СПРИНТ 4 — деплой                        ✅ ЗАКРЫТ
[x] E1  b2b-portal и config/cors.php закоммичены
[x] E2  admin/Dockerfile + сервис в prod-compose + nginx admin.paradise.kz
[x] E3  CI-матрица: tsc --noEmit + npm run build для трёх фронтов
[x] E4  CLAUDE.md / AGENTS.md / .env.production.example приведены к реальности
[x] D4  код МойСклада и его тесты удалены

ОСТАЛОСЬ
[x] A3b предупреждение «нет активного склада» — закоммичено
[x] Ветка mvp/local-inventory слита в main (слилась автоматически, без конфликтов)
[x] Убраны хвосты ERP: catalog:populate, IDE-файл, пустой scheduler
[ ] C4b завести аккаунт у WhatsApp-провайдера и заполнить настройки в CatalogSettings
[ ] Прогнать приёмочные сценарии 1–5 на чистой БД   ← главное, что осталось
[ ] Backup БД настроен (deploy/scripts/backup.sh в кроне)
[ ] Выпустить первый деплой и проверить четыре домена
[ ] B1 удалить catalog:generate-product-slugs — решено НЕ удалять, команда осталась
      как ремонтный инструмент для массовых вставок (сидеры, будущий импорт)
```

### Состояние на 2026-09-11

Тесты на слитом `main`: **274 / 268 зелёных / 6 skipped / 0 красных**.
`npx tsc --noEmit` в `admin/` чистый. Всё, что было в ветке и в `main`, сведено воедино.

`grep -ri moysklad app/ config/ routes/ tests/ database/` — пусто. Интеграции больше нет.

Все три фронта в `docker-compose.prod.yml`, все четыре домена в `deploy/nginx/`.

**Мелочи, всплывшие при проверке — все закрыты** (коммит `714580e`):

- `paradise.kz.code-workspace` — файл настроек IDE, случайно закоммиченный в каталог
  artisan-команд в июле. Удалён, расширение добавлено в `.gitignore`.
- `SyncAndPopulateCatalogCommand` → `catalog:populate`. Половина команды тянула каталог из
  `CatalogSource`, который стал no-op, — эта половина удалена. Вторая половина осталась:
  500 строк мебельного справочника (дерево категорий, бренды, пулы характеристик), который
  превращает голый импорт в просматриваемый каталог.
- Сервис `scheduler` убран из прод-компоуза — расписание пустое, контейнер крутился впустую.
- Пустой каталог `app/Services/MoySklad/` удалён из рабочей копии.

### Результаты прогонов

Набор гоняется на PHP 8.4 + sqlite (`:memory:`).

| Этап | Итог |
|------|------|
| До работ (чистый `HEAD`) | зелёный |
| После спринта 1 | 299 тестов, 285 зелёных |
| После спринта 2 | **309 тестов, 302 зелёных, 6 skipped, 1 красный** |

Единственный красный — `AuthTest::login_fails_with_wrong_password`: ждёт ключ ошибки `phone`,
приходит `email`. Это из незакоммиченного WIP по `LoginRequest` / `AuthController`, не из плана.

> **Поправка.** В первой редакции этого раздела было сказано, что 7 ошибок Filament + Livewire
> (`getDefaultTestingSchemaName() on null`) воспроизводятся на `HEAD` и потому были до работ.
> Это оказалось неверно: «эталонное» дерево, на котором я это проверял, было собрано вручную и
> содержало несовместимую пару файлов (`SyncStockJob` вызывал метод, которого нет в старой версии
> `FifoInventoryService`). На честно выгруженном `git archive HEAD` эти тесты **проходят**, и в
> текущем дереве они тоже проходят. Ошибок Filament нет ни до, ни после.

Что всё равно нужно прогнать у себя (тут этого сделать нельзя — нет docker и mysql):

```bash
vendor/bin/pint --dirty          # форматирование по стилю проекта
php artisan migrate              # новая миграция: order_items.external_product_id → nullable
php artisan stock:recompute      # разовый ремонт агрегата: сначала dev, потом прод
php artisan migrate:fresh --seed # склад по умолчанию создаётся
cd admin && npm run build        # проверено только tsc --noEmit
```

### C5 — одобрение B2B-клиента ломалось без ERP — P0 🔴 ✅ найдено прогоном и исправлено

**Файлы:** `app/Actions/ApproveClient.php`, `app/Contracts/Erp/OrderTarget.php`,
`app/Services/{Local,MoySklad}/*OrderTarget.php`, `tests/Feature/Admin/ApproveClientTest.php`

`ApproveClient::handle()` безусловно дёргал `OrderTarget::createCounterparty()`. Под провайдером
`local` это исключение → **ни один B2B-клиент не мог быть одобрен**, то есть B2B-портал не работал бы
вообще. Статический разбор это не ловит: падение только в рантайме.

**Суть:** в контракт добавлен `supportsCounterparties(): bool` (`local` → false, `moysklad` → true);
`ApproveClient` создаёт контрагента только когда ERP реально подключён. Одобрение — локальное решение
(открывает клиенту оптовый каталог и цены) и не должно зависеть от интеграции, которой нет.

**Тест:** `ApproveClientTest` — три ERP-кейса пиннят `erp.provider = moysklad`, добавлен четвёртый
`approval_works_with_no_erp_connected`.

### C6 — checkout падал с 500 на любом локально созданном товаре — P0 🔴 ✅ найдено прогоном и исправлено

**Файл:** новая миграция `2026_09_04_100000_make_order_items_external_product_id_nullable.php`

`order_items.external_product_id` был `NOT NULL` — колонка существовала, чтобы сослаться на товар
при отправке заказа в ERP. `OrderPlacementService` пишет в неё `$product->externalMapping?->external_id`,
то есть **null для любого товара, созданного не синком**. Итог: оформление заказа на такой товар —
`SQLSTATE[23000] NOT NULL constraint failed`, ответ 500.

Существующие тесты этого не ловили: все они создавали товары через `Product::factory()->erpSynced()`.
Всплыло на первом же тесте, где товар создан как в реальной жизни — через обычную фабрику.

**Приёмка:** гостевой checkout на товаре без ERP-маппинга → 201.


---

> Документ создан 2026-09-04. Связанные: `AGENTS.md`, `docs/mvp-b2b-plan.md`,
> `docs/mvp-audit-tasks-and-tests.md` (устарел в части ERP/остатков — этот план имеет приоритет).
