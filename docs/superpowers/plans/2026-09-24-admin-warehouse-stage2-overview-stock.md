# Раздел «Склад», этап 2: «Обзор» и «Остатки» по товару — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Менеджер открывает «Склад» и сразу видит стоимость запаса, что заканчивается, что кончилось и сколько черновиков; во вкладке «Остатки» — одна строка на товар с итогом, стоимостью, статусом и раскрываемой разбивкой по местам хранения; у товара есть «Мин. остаток».

**Architecture:** Бэкенд: колонка `products.min_stock` + `config/inventory.php`; сервис `App\Services\Inventory\StockByProduct` строит выборку «товар → остаток» одним SQL-запросом (агрегат `product_store_stock` через `leftJoinSub`, статус — `CASE` в SQL, фильтр/сортировка/счётчики — по производной таблице), два новых эндпоинта `GET /api/admin/stock/products` и `GET /api/admin/stock/summary`; сериализация движений выносится в `StockMovementPresenter`. Фронтенд: вкладка «Обзор» (`/warehouse`, плитки `StatTile`, последние движения), сводка грузится один раз в `warehouse/layout.tsx` и раздаётся через контекст; вкладка «Остатки» переписана на `DataTable` с новой возможностью раскрытия строки; поле «Мин. остаток» в форме товара. Старый `GET /api/admin/stock` удаляется в конце.

**Tech Stack:** Laravel 13 / PHP 8.5, PHPUnit 12 (SQLite in-memory в тестах, MySQL 8 в dev/prod), spatie/laravel-medialibrary; Next.js 16, React 19, Tailwind 4, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-24-admin-warehouse-redesign-design.md` — разделы «Обзор и Остатки», «Этапы» п. 2.

## Global Constraints

- Остатки только читаются: ничто кроме `FifoInventoryService` не пишет `products.stock` и `product_store_stock`. Новые эндпоинты — только `GET`.
- Действующий минимум товара: `min_stock ?? config('inventory.low_stock_threshold')`, по умолчанию 2.
- Статус от **показанного** количества (итог по всем складам или по выбранному складу): `out` — ≤ 0; `low` — 0 < количество ≤ действующего минимума; `ok` — иначе.
- В выборку остатков попадают все товары, кроме составных (`is_composite = true`); товар без записей остатка — с нулём.
- Деньги в API — целые тиыны; количество — число с плавающей точкой (`decimal:3`).
- `meta.counts` считаются по текущим `search`/`store_id`/`product_id` **без** учёта `status`.
- `/api/admin/*` — только `admin|manager` (`auth:sanctum` + `role:admin|manager`, уже на группе маршрутов).
- Телефон 360–412 px: без горизонтальной прокрутки, элементы ≥ 44 px (`min-h-11`), поля 16 px до `md`. ПК ≥ 1024 px.
- Интерфейс — на русском.
- PHP: после правок — `vendor/bin/pint --dirty --format agent`; фигурные скобки всегда; явные типы возврата; PHPDoc вместо инлайн-комментариев.
- PHP-тесты — с хоста: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact <файл>` (без этих переопределений часть тестов падает из-за `.env`, см. память `test-env-gotchas`). Если правка маршрутов «не видна» — `php artisan route:clear`.
- Миграции для dev-базы (нужны e2e): `docker exec paradisekz-app-1 php artisan migrate --no-interaction`. Никогда `migrate:fresh` и `mvp:acceptance --fresh` — они стирают dev-базу.
- Фронтенд-команды — из `admin/`; dev-сервер на :3002 уже запущен из этого checkout, не останавливать; `next dev` сам перезапускается при правке `next.config.ts`.
- `admin/AGENTS.md`: у этой версии Next ломающие изменения — сверяться с `admin/node_modules/next/dist/docs/`.
- Известный красный e2e до начала: `stock.spec.ts` «товар в наличии… 7 шт» (дрейф фикстур). Тест сохраняется в переписанном файле и может остаться красным по той же причине.
- Коммиты — без `Co-Authored-By` и без «Generated with Claude Code».
- Ветка `feat/warehouse-overview` в основном checkout (не worktree — e2e должны видеть dev-сервер :3002).

### Решения плана, уточняющие спеку

- **Меню «⋯» в строке остатков с «Принять товар» / «Списать» переезжает в этап 3** — там появляется создание черновика без модалки (`createDraft`), без которого эти пункты делать нечем. В этапе 2 в строке остатков — две ссылки «Движения» и «Открыть товар» (на телефоне — в нижней части карточки).
- **Поле «Мин. остаток» — в карточке «Учёт» (`AccountingCard`), а не в `StockCard`.** `StockCard` показывается только у сохранённого товара и не является частью формы; «Учёт» есть и у нового товара. `StockCard` показывает действующий минимум текстом.
- **Счётчик 0 на вкладке «Документы» не рисуется** (`LinkTabs` уже скрывает нулевой `count`): «0 черновиков» — не повод для значка.
- **Пустые записи склада (остаток 0) в разбивку по местам хранения не попадают** — строка «Шоурум 0 · Рыскулова 8» только мешает.

## Review Focus

1. **Товар, который ни разу не принимали** (записей `product_store_stock` нет) — должен быть в «Остатках» с нулём и статусом «нет», а не пропасть. Тесты: Task 2 `a_product_never_received_is_listed_as_out`, Task 5 e2e «новый товар — в „Нет в наличии“».
2. **Мусор в адресе** (`/warehouse/stock?status=foo`, `?sort=zzz`) — экран показывает все товары с сортировкой по умолчанию, а не ошибку 422 или пустой список. Тест: Task 5 e2e «неизвестные параметры адреса не ломают экран».
3. **Выбран один склад** — статус и счётчики считаются по остатку на этом складе, а не по итогу: товар с 8 шт на одном складе и 0 на другом при выборе второго — «нет». Тест: Task 2 `status_follows_the_selected_store`.
4. **Склад с нулевым остатком** не показывается в разбивке. Тест: Task 2 `the_store_breakdown_skips_empty_records`.
5. **Составной товар** (`is_composite`) не попадает ни в список, ни в счётчики, ни в стоимость запаса. Тест: Task 2 `composite_products_are_left_out`.

---

## Карта файлов

**Бэкенд — создаются:**
- `database/migrations/2026_09_24_000001_add_min_stock_to_products_table.php`
- `config/inventory.php`
- `app/Services/Inventory/StockByProduct.php` — выборка «товар → остаток», статусы, итоги.
- `app/Services/Inventory/StockMovementPresenter.php` — движение в массив для API (вынесено из контроллера).
- `tests/Feature/Admin/ProductMinStockTest.php`, `tests/Feature/Admin/StockByProductApiTest.php`, `tests/Feature/Admin/StockSummaryApiTest.php`

**Бэкенд — меняются:** `app/Models/Product.php`, `app/Http/Requests/Admin/ProductSaveRequest.php`, `app/Http/Controllers/Api/Admin/ProductController.php` (`show`), `app/Http/Controllers/Api/Admin/StockController.php`, `app/Http/Controllers/Api/Admin/StockMovementController.php`, `routes/api.php`; удаляется `tests/Feature/Admin/StockApiTest.php` (его проверки переезжают в новые тесты) — в Task 6.

**Фронтенд — создаются:**
- `admin/src/components/ui/StatTile.tsx`, `admin/src/components/ui/FilterChips.tsx`
- `admin/src/components/warehouse/WarehouseSummary.tsx` — контекст сводки склада.
- `admin/src/app/warehouse/page.tsx` — «Обзор».
- `admin/src/components/warehouse/StockStores.tsx` — разбивка остатка по местам хранения (строка на телефоне, мини-таблица в раскрытой строке).
- `admin/e2e/warehouseApi.ts` — помощники e2e для товаров, складов, приёмок.
- `admin/e2e/warehouse-overview.spec.ts`

**Фронтенд — меняются:** `admin/src/lib/warehouse.ts`, `admin/src/components/ui/DataTable.tsx`, `admin/src/components/ui/DataTableCards.tsx`, `admin/src/components/warehouse/WarehouseHeader.tsx`, `admin/src/app/warehouse/layout.tsx`, `admin/src/app/warehouse/stock/page.tsx` (переписывается), `admin/src/app/page.tsx`, `admin/next.config.ts`, `admin/src/components/products/form/{formModel.ts,AccountingCard.tsx,StockCard.tsx,ProductForm.tsx}`; e2e `stock.spec.ts` (переписывается), `warehouse.spec.ts`, `warehouse-shell.spec.ts`, `product-form.spec.ts`, `mobile/warehouse.spec.ts`, `mobile/no-horizontal-scroll.spec.ts`.

---

### Task 1: «Мин. остаток» у товара (бэкенд)

**Files:**
- Create: `database/migrations/2026_09_24_000001_add_min_stock_to_products_table.php`
- Create: `config/inventory.php`
- Modify: `app/Models/Product.php` (`$fillable`, `casts()`)
- Modify: `app/Http/Requests/Admin/ProductSaveRequest.php` (`BLANK_MEANS_UNSET`, `rules()`)
- Modify: `app/Http/Controllers/Api/Admin/ProductController.php` (`show`)
- Test: `tests/Feature/Admin/ProductMinStockTest.php`

**Interfaces:**
- Produces: колонка `products.min_stock` (`decimal(12,3)`, nullable); `config('inventory.low_stock_threshold')` (float, по умолчанию 2); `Product::$min_stock` каст `decimal:3` (строка `"5.000"` или null); `GET /api/admin/products/{id}` отдаёт `min_stock` и `min_stock_default` (float).

- [ ] **Step 1: Создать ветку**

```bash
git switch -c feat/warehouse-overview
```

- [ ] **Step 2: Написать падающий тест**

`tests/Feature/Admin/ProductMinStockTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

/**
 * «Мин. остаток» товара — порог, ниже которого товар попадает в
 * «Заканчивается». Пусто — действует общий порог из config/inventory.php.
 */
class ProductMinStockTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        $this->actingAsManager();
    }

    #[Test]
    public function it_saves_the_minimum_on_create_and_update(): void
    {
        $id = $this->postJson('/api/admin/products', [
            'name' => ['ru' => 'Стул Вена'],
            'min_stock' => '10',
        ])->assertCreated()->json('data.id');

        $this->assertSame('10.000', Product::find($id)->min_stock);

        $this->putJson("/api/admin/products/{$id}", [
            'name' => ['ru' => 'Стул Вена'],
            'min_stock' => '2.5',
        ])->assertOk();

        $this->assertSame('2.500', Product::find($id)->min_stock);
    }

    #[Test]
    public function a_blank_minimum_falls_back_to_the_default(): void
    {
        $product = Product::factory()->create(['min_stock' => 4]);

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Стул Вена'],
            'min_stock' => '',
        ])->assertOk();

        $this->assertNull($product->fresh()->min_stock);
    }

    #[Test]
    public function a_negative_minimum_is_rejected(): void
    {
        $product = Product::factory()->create();

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Стул Вена'],
            'min_stock' => '-1',
        ])->assertUnprocessable()->assertJsonValidationErrors('min_stock');
    }

    #[Test]
    public function the_product_card_carries_its_minimum_and_the_default(): void
    {
        config(['inventory.low_stock_threshold' => 3]);
        $product = Product::factory()->create(['min_stock' => 7]);

        $this->getJson("/api/admin/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.min_stock', '7.000')
            ->assertJsonPath('data.min_stock_default', 3.0);
    }
}
```

- [ ] **Step 3: Запустить — должен упасть**

```bash
STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/ProductMinStockTest.php
```

Expected: FAIL — нет колонки `min_stock`.

- [ ] **Step 4: Миграция**

```bash
php artisan make:migration add_min_stock_to_products_table --table=products --no-interaction
```

Переименовать созданный файл в `database/migrations/2026_09_24_000001_add_min_stock_to_products_table.php` (чтобы порядок был предсказуем) и заменить содержимое:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Порог «заканчивается» для товара. null — общий порог
     * config('inventory.low_stock_threshold').
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('min_stock', 12, 3)->nullable()->after('stock');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('min_stock');
        });
    }
};
```

- [ ] **Step 5: Конфиг `config/inventory.php`**

```php
<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Порог «заканчивается»
    |--------------------------------------------------------------------------
    |
    | Товар без своего `products.min_stock` считается заканчивающимся, когда
    | его остаток больше нуля, но не больше этого числа.
    |
    */

    'low_stock_threshold' => (float) env('INVENTORY_LOW_STOCK_THRESHOLD', 2),

];
```

- [ ] **Step 6: Модель, запрос, карточка товара**

`app/Models/Product.php`: в `$fillable` после `'stock',` добавить `'min_stock',`; в `casts()` после `'stock' => 'decimal:3',` добавить `'min_stock' => 'decimal:3',`.

`app/Http/Requests/Admin/ProductSaveRequest.php`: в `BLANK_MEANS_UNSET` после `'volume',` добавить `'min_stock',`; в `rules()` рядом с `weight`/`volume`:

```php
            'min_stock' => 'nullable|numeric|decimal:0,3|min:0|max:9999999.999',
```

`app/Http/Controllers/Api/Admin/ProductController.php`, `show()`:

```php
        return response()->json(['data' => [
            ...$product->toArray(),
            'images' => ProductMediaController::presentAll($product),
            'min_stock_default' => (float) config('inventory.low_stock_threshold'),
        ]]);
```

- [ ] **Step 7: Запустить — должен пройти; соседние тесты товара зелёные**

```bash
STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/ProductMinStockTest.php tests/Feature/Admin/ProductCrudTest.php
vendor/bin/pint --dirty --format agent
```

Expected: PASS.

- [ ] **Step 8: Применить миграцию к dev-базе (для e2e следующих задач)**

```bash
docker exec paradisekz-app-1 php artisan migrate --no-interaction
```

Expected: `2026_09_24_000001_add_min_stock_to_products_table ... DONE`.

- [ ] **Step 9: Commit**

```bash
git add database/migrations config/inventory.php app/Models/Product.php app/Http/Requests/Admin/ProductSaveRequest.php app/Http/Controllers/Api/Admin/ProductController.php tests/Feature/Admin/ProductMinStockTest.php
git commit -m "feat(api): per-product minimum stock with a configurable default"
```

---

### Task 2: `GET /api/admin/stock/products` — остатки по товару

**Files:**
- Create: `app/Services/Inventory/StockByProduct.php`
- Modify: `app/Http/Controllers/Api/Admin/StockController.php` (метод `products`)
- Modify: `routes/api.php` (маршрут рядом с `Route::get('stock', …)`)
- Test: `tests/Feature/Admin/StockByProductApiTest.php`

**Interfaces:**
- Consumes: `products.min_stock`, `config('inventory.low_stock_threshold')` (Task 1); `FifoInventoryService::receive(Product, Store, float $qty, int $unitCostTiyn)` / `issue(Product, Store, float $qty)` в тестах; `ProductMediaController::present(Media): array{thumb_url: string, …}`.
- Produces:
  - `StockByProduct::list(array $filters, int $perPage = 50): array{page: LengthAwarePaginator, counts: array{all: int, low: int, out: int}, total_value: int}`
  - `StockByProduct::totals(array $filters): array{counts: array{all: int, low: int, out: int}, total_value: int}`
  - `$filters`: `array{search?: ?string, store_id?: ?int, product_id?: ?int, status?: ?string, sort?: ?string}`
  - Ответ эндпоинта: пагинатор Laravel (`data`, `current_page`, `last_page`, `total`, …) + `meta: { counts: {all, low, out}, total_value: int, low_stock_threshold: float }`. Строка `data[]`: `{ id, product: { id, name: {ru, kk}, code, article, uom, thumb_url }, stock: float, min_stock: float, avg_cost: int|null, stock_value: int, status: 'ok'|'low'|'out', stores: [{ id, name, stock: float, avg_cost: int|null, stock_value: int }] }`.

- [ ] **Step 1: Написать падающие тесты**

`tests/Feature/Admin/StockByProductApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Models\Store;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

/**
 * Остатки по товару: строка — товар, итог по всем местам хранения (или по
 * выбранному), стоимость, статус «заканчивается / нет в наличии».
 */
class StockByProductApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    private const URL = '/api/admin/stock/products';

    private Store $showroom;

    private Store $warehouse;

    private FifoInventoryService $inventory;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        $this->actingAsManager();
        config(['inventory.low_stock_threshold' => 2]);

        $this->showroom = Store::factory()->create(['name' => 'Шоурум']);
        $this->warehouse = Store::factory()->create(['name' => 'Рыскулова']);
        $this->inventory = app(FifoInventoryService::class);
    }

    private function product(string $name, ?float $minStock = null): Product
    {
        return Product::factory()->create(['name' => ['ru' => $name], 'stock' => 0, 'min_stock' => $minStock]);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function row(array $rows, Product $product): ?array
    {
        return collect($rows)->firstWhere('id', $product->id);
    }

    #[Test]
    public function one_row_per_product_with_totals_and_a_store_breakdown(): void
    {
        $sofa = $this->product('Диван Осло');
        $this->inventory->receive($sofa, $this->showroom, 4, 178_000_00);
        $this->inventory->receive($sofa, $this->warehouse, 8, 181_000_00);

        $response = $this->getJson(self::URL)->assertOk();
        $row = $this->row($response->json('data'), $sofa);

        $this->assertNotNull($row);
        $this->assertCount(1, collect($response->json('data'))->where('id', $sofa->id));
        $this->assertEqualsWithDelta(12.0, $row['stock'], 0.001);
        $this->assertSame(4 * 178_000_00 + 8 * 181_000_00, $row['stock_value']);
        $this->assertSame((int) round((4 * 178_000_00 + 8 * 181_000_00) / 12), $row['avg_cost']);
        $this->assertSame('ok', $row['status']);
        $this->assertSame('Диван Осло', $row['product']['name']['ru']);
        $this->assertSame(['Шоурум', 'Рыскулова'], array_column($row['stores'], 'name'));
        $this->assertEqualsWithDelta(4.0, $row['stores'][0]['stock'], 0.001);
        $this->assertSame(4 * 178_000_00, $row['stores'][0]['stock_value']);
    }

    #[Test]
    public function a_product_never_received_is_listed_as_out(): void
    {
        $table = $this->product('Стол Лофт');

        $row = $this->row($this->getJson(self::URL)->assertOk()->json('data'), $table);

        $this->assertNotNull($row);
        $this->assertEqualsWithDelta(0.0, $row['stock'], 0.001);
        $this->assertSame('out', $row['status']);
        $this->assertNull($row['avg_cost']);
        $this->assertSame(0, $row['stock_value']);
        $this->assertSame([], $row['stores']);
    }

    #[Test]
    public function low_uses_the_product_minimum_or_the_default(): void
    {
        $chair = $this->product('Стул Вена', minStock: 10);
        $armchair = $this->product('Кресло Берн');
        $bed = $this->product('Кровать Аврора');
        $this->inventory->receive($chair, $this->showroom, 6, 10_000_00);
        $this->inventory->receive($armchair, $this->showroom, 2, 10_000_00);
        $this->inventory->receive($bed, $this->showroom, 3, 10_000_00);

        $rows = $this->getJson(self::URL)->assertOk()->json('data');

        $this->assertSame('low', $this->row($rows, $chair)['status']);
        $this->assertEqualsWithDelta(10.0, $this->row($rows, $chair)['min_stock'], 0.001);
        $this->assertSame('low', $this->row($rows, $armchair)['status']);
        $this->assertEqualsWithDelta(2.0, $this->row($rows, $armchair)['min_stock'], 0.001);
        $this->assertSame('ok', $this->row($rows, $bed)['status']);
    }

    #[Test]
    public function status_follows_the_selected_store(): void
    {
        $sofa = $this->product('Диван Осло');
        $this->inventory->receive($sofa, $this->warehouse, 8, 10_000_00);

        $all = $this->row($this->getJson(self::URL)->json('data'), $sofa);
        $showroomOnly = $this->row(
            $this->getJson(self::URL.'?filter[store_id]='.$this->showroom->id)->json('data'),
            $sofa,
        );

        $this->assertSame('ok', $all['status']);
        $this->assertSame('out', $showroomOnly['status']);
        $this->assertEqualsWithDelta(0.0, $showroomOnly['stock'], 0.001);
    }

    #[Test]
    public function the_store_breakdown_skips_empty_records(): void
    {
        $sofa = $this->product('Диван Осло');
        $this->inventory->receive($sofa, $this->showroom, 1, 10_000_00);
        $this->inventory->issue($sofa, $this->showroom, 1);
        $this->inventory->receive($sofa, $this->warehouse, 3, 10_000_00);

        $row = $this->row($this->getJson(self::URL)->json('data'), $sofa);

        $this->assertSame(['Рыскулова'], array_column($row['stores'], 'name'));
    }

    #[Test]
    public function composite_products_are_left_out(): void
    {
        $kit = $this->product('Комплект Гостиная');
        $this->inventory->receive($kit, $this->showroom, 5, 10_000_00);
        DB::table('products')->where('id', $kit->id)->update(['is_composite' => true]);

        $response = $this->getJson(self::URL)->assertOk();

        $this->assertNull($this->row($response->json('data'), $kit));
        $this->assertSame(0, $response->json('meta.counts.all'));
        $this->assertSame(0, $response->json('meta.total_value'));
    }

    #[Test]
    public function filters_by_status_search_and_product(): void
    {
        $sofa = $this->product('Диван Осло');
        $chair = $this->product('Стул Вена');
        $table = $this->product('Стол Лофт');
        $this->inventory->receive($sofa, $this->showroom, 9, 10_000_00);
        $this->inventory->receive($chair, $this->showroom, 1, 10_000_00);

        $ids = fn (string $query): array => array_column($this->getJson(self::URL.$query)->assertOk()->json('data'), 'id');

        $this->assertSame([$chair->id], $ids('?filter[status]=low'));
        $this->assertSame([$table->id], $ids('?filter[status]=out'));
        $this->assertSame([$sofa->id], $ids('?filter[search]=Осло'));
        $this->assertSame([$chair->id], $ids('?filter[product_id]='.$chair->id));
    }

    #[Test]
    public function counts_and_total_value_ignore_the_status_filter(): void
    {
        $sofa = $this->product('Диван Осло');
        $chair = $this->product('Стул Вена');
        $this->product('Стол Лофт');
        $this->inventory->receive($sofa, $this->showroom, 9, 10_000_00);
        $this->inventory->receive($chair, $this->showroom, 1, 5_000_00);

        $this->getJson(self::URL.'?filter[status]=out')
            ->assertOk()
            ->assertJsonPath('meta.counts', ['all' => 3, 'low' => 1, 'out' => 1])
            ->assertJsonPath('meta.total_value', 9 * 10_000_00 + 1 * 5_000_00)
            ->assertJsonCount(1, 'data');
    }

    #[Test]
    public function sorts_by_name_by_default_and_by_stock_on_request(): void
    {
        $b = $this->product('Бра Луна');
        $a = $this->product('Абажур Лён');
        $this->inventory->receive($b, $this->showroom, 5, 1_000_00);
        $this->inventory->receive($a, $this->showroom, 1, 1_000_00);

        $this->assertSame([$a->id, $b->id], array_column($this->getJson(self::URL)->json('data'), 'id'));
        $this->assertSame([$b->id, $a->id], array_column($this->getJson(self::URL.'?sort=-stock')->json('data'), 'id'));
        $this->assertSame([$a->id, $b->id], array_column($this->getJson(self::URL.'?sort=nonsense')->json('data'), 'id'));
    }

    #[Test]
    public function an_unknown_status_is_rejected(): void
    {
        $this->getJson(self::URL.'?filter[status]=foo')->assertUnprocessable();
    }

    #[Test]
    public function it_is_closed_to_everyone_but_staff(): void
    {
        $this->assertStaffOnly('GET', self::URL);
    }
}
```

Проверить, что в `ActsAsStaff` есть `assertStaffOnly(string $method, string $uri, array $payload = [])` (есть — `tests/Feature/Admin/Concerns/ActsAsStaff.php`).

- [ ] **Step 2: Запустить — должны упасть**

```bash
STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/StockByProductApiTest.php
```

Expected: FAIL — 404 на `/api/admin/stock/products`.

- [ ] **Step 3: Сервис `app/Services/Inventory/StockByProduct.php`**

```bash
php artisan make:class Services/Inventory/StockByProduct --no-interaction
```

Содержимое:

```php
<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Http\Controllers\Api\Admin\ProductMediaController;
use App\Models\Product;
use App\Models\ProductStoreStock;
use Illuminate\Database\Query\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Остатки по товару: одна строка на товар — итог по всем местам хранения или
 * по выбранному, стоимость запаса, статус «ok / low / out».
 *
 * Всё считается одним запросом: агрегат `product_store_stock` присоединяется
 * к товарам, статус — выражение CASE в SQL. Поэтому фильтр по статусу,
 * сортировка и счётчики чипов работают по всей выборке, а не по странице.
 * Составные товары своего остатка не имеют и в выборку не попадают; товар без
 * единой записи остатка — с нулём.
 *
 * Только чтение: остатки пишет FifoInventoryService.
 */
final class StockByProduct
{
    /** @var list<string> */
    public const STATUSES = ['low', 'out'];

    /** @var array<string, array{0: string, 1: string}> */
    private const SORTS = [
        'name' => ['name_ru', 'asc'],
        '-name' => ['name_ru', 'desc'],
        'stock' => ['on_hand', 'asc'],
        '-stock' => ['on_hand', 'desc'],
        'stock_value' => ['stock_value', 'asc'],
        '-stock_value' => ['stock_value', 'desc'],
    ];

    /**
     * @param  array{search?: ?string, store_id?: ?int, product_id?: ?int, status?: ?string, sort?: ?string}  $filters
     * @return array{page: LengthAwarePaginator, counts: array{all: int, low: int, out: int}, total_value: int}
     */
    public function list(array $filters, int $perPage = 50): array
    {
        $rows = $this->rows($filters);
        $status = $filters['status'] ?? null;

        if (in_array($status, self::STATUSES, true)) {
            $rows->where('stock_status', $status);
        }

        [$column, $direction] = self::SORTS[$filters['sort'] ?? ''] ?? self::SORTS['name'];

        $page = $rows->orderBy($column, $direction)->orderBy('id')->paginate($perPage);
        $this->present($page, $filters['store_id'] ?? null);

        return ['page' => $page, ...$this->totals($filters)];
    }

    /**
     * Счётчики статусов и стоимость запаса по фильтрам — без учёта статуса.
     *
     * @param  array{search?: ?string, store_id?: ?int, product_id?: ?int}  $filters
     * @return array{counts: array{all: int, low: int, out: int}, total_value: int}
     */
    public function totals(array $filters): array
    {
        $totals = $this->rows($filters)
            ->selectRaw('COUNT(*) as all_count')
            ->selectRaw("COALESCE(SUM(CASE WHEN stock_status = 'low' THEN 1 ELSE 0 END), 0) as low_count")
            ->selectRaw("COALESCE(SUM(CASE WHEN stock_status = 'out' THEN 1 ELSE 0 END), 0) as out_count")
            ->selectRaw('COALESCE(SUM(stock_value), 0) as total_value')
            ->first();

        return [
            'counts' => [
                'all' => (int) $totals->all_count,
                'low' => (int) $totals->low_count,
                'out' => (int) $totals->out_count,
            ],
            'total_value' => (int) round((float) $totals->total_value),
        ];
    }

    public function threshold(): float
    {
        return (float) config('inventory.low_stock_threshold');
    }

    /**
     * Производная таблица `stock_rows` (не `rows` — в MySQL 8 это зарезервированное слово):
     * id, name_ru, on_hand, stock_value, stock_status.
     *
     * @param  array{search?: ?string, store_id?: ?int, product_id?: ?int}  $filters
     */
    private function rows(array $filters): Builder
    {
        $storeId = $filters['store_id'] ?? null;

        $stock = DB::table('product_store_stock')
            ->select('product_id')
            ->selectRaw('SUM(stock) as qty')
            ->selectRaw('SUM(stock * COALESCE(avg_cost, 0)) as value')
            ->when($storeId, fn (Builder $query) => $query->where('store_id', $storeId))
            ->groupBy('product_id');

        $qty = 'COALESCE(stock_totals.qty, 0)';

        $products = DB::table('products')
            ->leftJoinSub($stock, 'stock_totals', 'stock_totals.product_id', '=', 'products.id')
            ->where('products.is_composite', false)
            ->select('products.id', 'products.name->ru as name_ru')
            ->selectRaw("{$qty} as on_hand")
            ->selectRaw('COALESCE(stock_totals.value, 0) as stock_value')
            ->selectRaw(
                "CASE WHEN {$qty} <= 0 THEN 'out' WHEN {$qty} <= COALESCE(products.min_stock, ?) THEN 'low' ELSE 'ok' END as stock_status",
                [$this->threshold()],
            )
            ->when($filters['product_id'] ?? null, fn (Builder $query, int $id) => $query->where('products.id', $id))
            ->when($filters['search'] ?? null, function (Builder $query, string $search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query->where('products.name->ru', 'like', "%{$search}%")
                        ->orWhere('products.name->kk', 'like', "%{$search}%")
                        ->orWhere('products.code', 'like', "%{$search}%")
                        ->orWhere('products.article', 'like', "%{$search}%");
                });
            });

        return DB::query()->fromSub($products, 'stock_rows');
    }

    /**
     * Заменяет строки страницы на ответ API: товар, фото, разбивка по складам.
     */
    private function present(LengthAwarePaginator $page, ?int $storeId): void
    {
        $ids = collect($page->items())->pluck('id')->all();

        $products = Product::query()->with('media')->whereIn('id', $ids)->get()->keyBy('id');

        $stores = ProductStoreStock::query()
            ->with('store:id,name')
            ->whereIn('product_id', $ids)
            ->where('stock', '!=', 0)
            ->when($storeId, fn ($query) => $query->where('store_id', $storeId))
            ->orderBy('store_id')
            ->get()
            ->groupBy('product_id');

        $page->through(fn (object $row): array => $this->row(
            $row,
            $products[$row->id],
            $stores[$row->id] ?? collect(),
        ));
    }

    /**
     * @param  Collection<int, ProductStoreStock>  $stores
     * @return array<string, mixed>
     */
    private function row(object $row, Product $product, Collection $stores): array
    {
        $qty = (float) $row->on_hand;
        $value = (int) round((float) $row->stock_value);
        $photo = $product->getFirstMedia(Product::IMAGE_COLLECTION);

        return [
            'id' => $product->id,
            'product' => [
                'id' => $product->id,
                'name' => $product->getTranslations('name'),
                'code' => $product->code,
                'article' => $product->article,
                'uom' => $product->uom,
                'thumb_url' => $photo === null ? null : ProductMediaController::present($photo)['thumb_url'],
            ],
            'stock' => $qty,
            'min_stock' => $product->min_stock === null ? $this->threshold() : (float) $product->min_stock,
            'avg_cost' => $qty > 0 ? (int) round($value / $qty) : null,
            'stock_value' => $value,
            'status' => $row->stock_status,
            'stores' => $stores->map(fn (ProductStoreStock $stock): array => [
                'id' => $stock->store_id,
                'name' => $stock->store?->name,
                'stock' => (float) $stock->stock,
                'avg_cost' => $stock->avg_cost === null ? null : (int) $stock->avg_cost,
                'stock_value' => (int) round((float) $stock->stock * (int) ($stock->avg_cost ?? 0)),
            ])->values()->all(),
        ];
    }
}
```

Если `products.name->ru as name_ru` не компилируется в SQLite (ошибка про колонку `name->ru`), заменить на явное выражение для обеих СУБД через грамматику: `->selectRaw($this->jsonRu())`, где `jsonRu()` возвращает `DB::connection()->getDriverName() === 'sqlite' ? "json_extract(products.name, '$.ru') as name_ru" : "json_unquote(json_extract(products.name, '$.ru')) as name_ru"` — и описать это в отчёте.

- [ ] **Step 4: Контроллер и маршрут**

`app/Http/Controllers/Api/Admin/StockController.php` — импорты `App\Services\Inventory\StockByProduct`, `Illuminate\Validation\Rule`; новый метод (докблок класса дополнить абзацем: «`products` — остатки по товару для вкладки „Остатки“, см. StockByProduct»):

```php
    /**
     * Остатки по товару (вкладка «Остатки»).
     *
     * Filters: filter[search], filter[store_id], filter[product_id],
     *          filter[status]=low|out. Sort: name, stock, stock_value (и `-`);
     *          неизвестная сортировка — по названию.
     */
    public function products(Request $request, StockByProduct $stock): JsonResponse
    {
        $validated = $request->validate([
            'filter.search' => ['nullable', 'string', 'max:255'],
            'filter.store_id' => ['nullable', 'integer'],
            'filter.product_id' => ['nullable', 'integer'],
            'filter.status' => ['nullable', Rule::in(StockByProduct::STATUSES)],
            'sort' => ['nullable', 'string', 'max:32'],
        ]);

        $filter = $validated['filter'] ?? [];

        $result = $stock->list([
            'search' => $filter['search'] ?? null,
            'store_id' => isset($filter['store_id']) ? (int) $filter['store_id'] : null,
            'product_id' => isset($filter['product_id']) ? (int) $filter['product_id'] : null,
            'status' => $filter['status'] ?? null,
            'sort' => $validated['sort'] ?? null,
        ]);

        $payload = $result['page']->appends($request->query())->toArray();
        $payload['meta'] = [
            'counts' => $result['counts'],
            'total_value' => $result['total_value'],
            'low_stock_threshold' => $stock->threshold(),
        ];

        return response()->json($payload);
    }
```

`routes/api.php`, после `Route::get('stock', [StockController::class, 'index']);`:

```php
        Route::get('stock/products', [StockController::class, 'products']);
```

- [ ] **Step 5: Запустить — должны пройти**

```bash
php artisan route:clear
STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/StockByProductApiTest.php tests/Feature/Admin/StockApiTest.php
vendor/bin/pint --dirty --format agent
```

Expected: PASS.

- [ ] **Step 6: Проверить на MySQL (dev-база)**

Тесты идут на SQLite; выражения JSON и `fromSub` надо один раз увидеть на MySQL — запрос через tinker внутри контейнера:

```bash
docker exec paradisekz-app-1 php artisan tinker --execute 'dump(app(App\Services\Inventory\StockByProduct::class)->list(["sort" => "-stock_value"], 3)["counts"]);'
```

Expected: без SQL-ошибок, счётчики — числа.

- [ ] **Step 7: Commit**

```bash
git add app/Services/Inventory/StockByProduct.php app/Http/Controllers/Api/Admin/StockController.php routes/api.php tests/Feature/Admin/StockByProductApiTest.php
git commit -m "feat(api): stock by product with statuses, store breakdown and totals"
```

---

### Task 3: `GET /api/admin/stock/summary` и `StockMovementPresenter`

**Files:**
- Create: `app/Services/Inventory/StockMovementPresenter.php`
- Modify: `app/Http/Controllers/Api/Admin/StockMovementController.php` (использует презентер)
- Modify: `app/Http/Controllers/Api/Admin/StockController.php` (метод `summary`)
- Modify: `routes/api.php`
- Test: `tests/Feature/Admin/StockSummaryApiTest.php`; регрессия — `tests/Feature/Admin/StockMovementApiTest.php` (существующий, не меняется)

**Interfaces:**
- Consumes: `StockByProduct::totals(array $filters)` (Task 2).
- Produces:
  - `StockMovementPresenter::RELATIONS: list<string>` и `StockMovementPresenter::present(StockMovement): array` — тот же формат, что сейчас у `/api/admin/stock-movements`.
  - `GET /api/admin/stock/summary` → `{ data: { total_value: int, low: int, out: int, drafts: { receipts: int, write_offs: int }, recent_movements: StockMovement[] (≤ 5, новые первые), has_active_store: bool } }`.

- [ ] **Step 1: Написать падающий тест**

`tests/Feature/Admin/StockSummaryApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\Product;
use App\Models\Store;
use App\Models\WriteOff;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

/**
 * Сводка для вкладки «Обзор»: стоимость запаса, что заканчивается и
 * кончилось, черновики, последние движения, есть ли активный склад.
 */
class StockSummaryApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    private const URL = '/api/admin/stock/summary';

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        $this->actingAsManager();
        config(['inventory.low_stock_threshold' => 2]);
    }

    #[Test]
    public function an_empty_warehouse_reports_zeros(): void
    {
        $this->getJson(self::URL)->assertOk()
            ->assertJsonPath('data.total_value', 0)
            ->assertJsonPath('data.low', 0)
            ->assertJsonPath('data.out', 0)
            ->assertJsonPath('data.drafts', ['receipts' => 0, 'write_offs' => 0])
            ->assertJsonPath('data.recent_movements', [])
            ->assertJsonPath('data.has_active_store', false);
    }

    #[Test]
    public function it_sums_the_whole_warehouse(): void
    {
        $store = Store::factory()->create(['is_active' => true]);
        $inventory = app(FifoInventoryService::class);
        $sofa = Product::factory()->create(['stock' => 0]);
        $chair = Product::factory()->create(['stock' => 0]);
        Product::factory()->create(['stock' => 0]);
        $inventory->receive($sofa, $store, 5, 100_00);
        $inventory->receive($chair, $store, 1, 50_00);

        $this->getJson(self::URL)->assertOk()
            ->assertJsonPath('data.total_value', 5 * 100_00 + 50_00)
            ->assertJsonPath('data.low', 1)
            ->assertJsonPath('data.out', 1)
            ->assertJsonPath('data.has_active_store', true);
    }

    #[Test]
    public function it_counts_drafts_only(): void
    {
        GoodsReceipt::factory()->count(2)->create();
        GoodsReceipt::factory()->posted()->create();
        WriteOff::factory()->create();
        WriteOff::factory()->posted()->create();

        $this->getJson(self::URL)->assertOk()
            ->assertJsonPath('data.drafts', ['receipts' => 2, 'write_offs' => 1]);
    }

    #[Test]
    public function recent_movements_are_the_last_five_in_the_ledger_format(): void
    {
        $store = Store::factory()->create();
        $inventory = app(FifoInventoryService::class);
        $products = Product::factory()->count(6)->create(['stock' => 0]);

        foreach ($products as $product) {
            $inventory->receive($product, $store, 1, 100_00);
        }

        $movements = $this->getJson(self::URL)->assertOk()->json('data.recent_movements');

        $this->assertCount(5, $movements);
        $this->assertSame($products->last()->id, $movements[0]['product']['id']);
        $this->assertSame('receipt', $movements[0]['type']);
        $this->assertEqualsWithDelta(1.0, $movements[0]['qty_delta'], 0.001);
        $this->assertArrayHasKey('document', $movements[0]);
        $this->assertSame($store->name, $movements[0]['store']['name']);
    }

    #[Test]
    public function it_is_closed_to_everyone_but_staff(): void
    {
        $this->assertStaffOnly('GET', self::URL);
    }
}
```

- [ ] **Step 2: Запустить — должен упасть**

```bash
STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/StockSummaryApiTest.php
```

Expected: FAIL — 404.

- [ ] **Step 3: Вынести сериализацию движения в `StockMovementPresenter`**

```bash
php artisan make:class Services/Inventory/StockMovementPresenter --no-interaction
```

Содержимое — методы `present()` и `document()` из `StockMovementController` дословно, плюс константа отношений:

```php
<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Models\GoodsReceipt;
use App\Models\Order;
use App\Models\StockMovement;
use App\Models\WriteOff;

/**
 * Движение складского журнала в виде для API: журнал движений и
 * «последние движения» на обзоре склада отдают одно и то же.
 */
final class StockMovementPresenter
{
    /**
     * Отношения, которые нужно загрузить заранее, чтобы present() не делал N+1.
     *
     * @var list<string>
     */
    public const RELATIONS = ['store:id,name', 'product:id,name,code', 'user:id,name', 'documentable'];

    /**
     * @return array<string, mixed>
     */
    public function present(StockMovement $movement): array
    {
        // тело — дословно из StockMovementController::present()
    }

    /**
     * @return array{type: string, id: int, label: string}|null
     */
    private function document(StockMovement $movement): ?array
    {
        // тело — дословно из StockMovementController::document()
    }
}
```

(Тела методов перенести без изменений — строки `return [ 'id' => $movement->id, … 'document' => $this->document($movement), ];` и `return match (true) { … };` из текущего контроллера.)

В `StockMovementController`: удалить `present()`, `document()` и импорты `GoodsReceipt`, `Order`, `WriteOff`, если они больше не нужны (константа `DOCUMENTS` их использует — тогда оставить); `index` получает презентер параметром:

```php
    public function index(Request $request, StockMovementPresenter $presenter): JsonResponse
```

`->with([...])` → `->with(StockMovementPresenter::RELATIONS)`, `->through(fn (StockMovement $movement): array => $this->present($movement))` → `->through(fn (StockMovement $movement): array => $presenter->present($movement))`.

- [ ] **Step 4: Метод `summary` и маршрут**

`StockController` — импорты `App\Models\GoodsReceipt`, `App\Models\StockMovement`, `App\Models\WriteOff`, `App\Services\Inventory\StockMovementPresenter`:

```php
    /**
     * Сводка для вкладки «Обзор»: стоимость запаса, заканчивается / нет в
     * наличии (по всем местам хранения), черновики документов, пять последних
     * движений, есть ли активный склад.
     */
    public function summary(StockByProduct $stock, StockMovementPresenter $presenter): JsonResponse
    {
        $totals = $stock->totals([]);

        $recent = StockMovement::query()
            ->with(StockMovementPresenter::RELATIONS)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(5)
            ->get()
            ->map(fn (StockMovement $movement): array => $presenter->present($movement))
            ->all();

        return response()->json(['data' => [
            'total_value' => $totals['total_value'],
            'low' => $totals['counts']['low'],
            'out' => $totals['counts']['out'],
            'drafts' => [
                'receipts' => GoodsReceipt::query()->where('status', GoodsReceipt::STATUS_DRAFT)->count(),
                'write_offs' => WriteOff::query()->where('status', WriteOff::STATUS_DRAFT)->count(),
            ],
            'recent_movements' => $recent,
            'has_active_store' => Store::query()->where('is_active', true)->exists(),
        ]]);
    }
```

`routes/api.php`, после `stock/products`:

```php
        Route::get('stock/summary', [StockController::class, 'summary']);
```

- [ ] **Step 5: Запустить — должны пройти, журнал движений не изменился**

```bash
php artisan route:clear
STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/StockSummaryApiTest.php tests/Feature/Admin/StockMovementApiTest.php tests/Feature/Admin/StockByProductApiTest.php
vendor/bin/pint --dirty --format agent
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/Services/Inventory/StockMovementPresenter.php app/Http/Controllers/Api/Admin/StockMovementController.php app/Http/Controllers/Api/Admin/StockController.php routes/api.php tests/Feature/Admin/StockSummaryApiTest.php
git commit -m "feat(api): warehouse summary for the overview tab"
```

---

### Task 4: Вкладка «Обзор»

**Files:**
- Create: `admin/src/components/ui/StatTile.tsx`
- Create: `admin/src/components/warehouse/WarehouseSummary.tsx`
- Create: `admin/src/app/warehouse/page.tsx`
- Modify: `admin/src/lib/warehouse.ts` (типы)
- Modify: `admin/src/components/warehouse/WarehouseHeader.tsx` (вкладка «Обзор», счётчик черновиков)
- Modify: `admin/src/app/warehouse/layout.tsx` (провайдер сводки)
- Modify: `admin/next.config.ts` (удалить редирект `/warehouse`)
- Modify: `admin/src/app/page.tsx` (главная берёт `has_active_store` из сводки)
- Create: `admin/e2e/warehouseApi.ts`; Modify: `admin/e2e/warehouse.spec.ts` (помощники — из нового файла)
- Create: `admin/e2e/warehouse-overview.spec.ts`
- Modify: `admin/e2e/warehouse-shell.spec.ts`, `admin/e2e/stock.spec.ts` (тест плашки)

**Interfaces:**
- Consumes: `GET /api/admin/stock/summary` (Task 3); `LinkTabs`, `EmptyState`, `Skeleton`, `cardClass`, `warehouseHref`, `documentHref`, `formatDateTime`, `formatQty`, `StockMovement`, `NoActiveStoreWarning`.
- Produces:
  - `type StockSummary = { total_value: number; low: number; out: number; drafts: { receipts: number; write_offs: number }; recent_movements: StockMovement[]; has_active_store: boolean }` в `lib/warehouse.ts`.
  - `WarehouseSummaryProvider({ children })` и `useWarehouseSummary(): { summary: StockSummary | null; failed: boolean; reload: () => void }` из `components/warehouse/WarehouseSummary.tsx`.
  - `StatTile({ label: string; value: string; icon: ReactNode; tone?: 'neutral' | 'warning' | 'danger'; href?: string })`.
  - В `e2e/warehouseApi.ts`: `createProduct(request, stamp, extra?)`, `createStore(request, stamp)`, `receive(request, storeId, productId, quantity, unitCost?)`, `uniqueStamp()`.
  - `WAREHOUSE_TABS` начинается с `{ key: 'overview', href: '/warehouse', label: 'Обзор' }`; `warehouseTabFor('/warehouse') === 'overview'`.

- [ ] **Step 1: Вынести e2e-помощники в `admin/e2e/warehouseApi.ts`**

```ts
import { test, type APIRequestContext } from "@playwright/test";
import { adminApi } from "./adminApi";

type Created = { data: { id: number } };

/**
 * Помощники e2e для склада. Товар заводится выключенным (на витрину не
 * попадёт), место хранения — неактивным (StoreResolver его не выберет), так
 * что общие фикстуры приёмки не задеваются.
 */

/** Уникальная метка на тест: параллельные тесты в одну миллисекунду иначе получают одинаковые имена. */
export function uniqueStamp(): number {
  return Date.now() * 100 + test.info().parallelIndex;
}

export async function createProduct(request: APIRequestContext, stamp: number, extra: Record<string, unknown> = {}) {
  const name = `E2E товар ${stamp}`;
  const product = await adminApi(request).create<Created>("/admin/products", { name: { ru: name }, is_active: false, ...extra });
  return { id: product.data.id, name };
}

export async function createStore(request: APIRequestContext, stamp: number, suffix = "") {
  const name = `E2E склад ${stamp}${suffix}`;
  const store = await adminApi(request).create<Created>("/admin/stores", { name, is_active: false });
  return { id: store.data.id, name };
}

/** Проведённая приёмка — единственный честный способ завести остаток. */
export async function receive(request: APIRequestContext, storeId: number, productId: number, quantity: number, unitCost = 1000) {
  const api = adminApi(request);
  const receipt = await api.create<Created>("/admin/goods-receipts", { store_id: storeId });
  await api.create(`/admin/goods-receipts/${receipt.data.id}/items`, { product_id: productId, quantity, unit_cost: unitCost });
  await api.send("post", `/admin/goods-receipts/${receipt.data.id}/post`);
}
```

В `e2e/warehouse.spec.ts`: удалить локальные `setupProductAndStore` и `receiveViaApi`, импортировать помощники и переписать их вызовы:

```ts
import { createProduct, createStore, receive, uniqueStamp } from "./warehouseApi";

async function setupProductAndStore(request: APIRequestContext, stamp: number) {
  const product = await createProduct(request, stamp);
  const store = await createStore(request, stamp);
  return { productId: product.id, storeId: store.id, productName: product.name, storeName: store.name };
}
```

(эта тонкая обёртка остаётся в файле, чтобы тела тестов не менялись); `receiveViaApi(request, …)` → `receive(request, …)`; `const stamp = Date.now() * 100 + test.info().parallelIndex;` → `const stamp = uniqueStamp();`.

Прогнать: `cd admin && npx playwright test --project=Desktop e2e/warehouse.spec.ts` — Expected: PASS (поведение не изменилось).

- [ ] **Step 2: Написать падающие e2e**

`admin/e2e/warehouse-overview.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { adminApi } from "./adminApi";
import { ADMIN_SESSION } from "./session";
import { createProduct, createStore, receive, uniqueStamp } from "./warehouseApi";

/**
 * Вкладка «Обзор»: цифры запаса одним взглядом и переходы в отфильтрованные
 * списки, последние движения.
 */
test.use({ storageState: ADMIN_SESSION });

test("«Склад» открывается на обзоре с четырьмя плитками", async ({ page }) => {
  await page.goto("/warehouse");

  const tabs = page.getByRole("navigation", { name: "Разделы склада" });
  await expect(tabs.getByRole("link", { name: "Обзор" })).toHaveAttribute("aria-current", "page");

  for (const label of ["Стоимость запаса", "Заканчивается", "Нет в наличии", "Черновики"]) {
    await expect(page.getByRole("link", { name: new RegExp(label) })).toBeVisible();
  }

  await page.getByRole("link", { name: /Заканчивается/ }).click();
  await expect(page).toHaveURL(/\/warehouse\/stock\?status=low$/);
});

test("новое движение видно в «Последних движениях»", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const product = await createProduct(request, stamp);
  const store = await createStore(request, stamp);
  await receive(request, store.id, product.id, 3);

  await page.goto("/warehouse");
  const recent = page.getByRole("region", { name: "Последние движения" });
  await expect(recent.getByText(product.name)).toBeVisible();
  await expect(recent).toContainText("+3");
});

test("черновик приёмки виден в плитке и на вкладке «Документы»", async ({ page, request }) => {
  const api = adminApi(request);
  const store = await createStore(request, uniqueStamp());
  const draft = await api.create<{ data: { id: number } }>("/admin/goods-receipts", { store_id: store.id });

  try {
    await page.goto("/warehouse");
    const tile = page.getByRole("link", { name: /Черновики/ });
    await expect(tile).toContainText(/[1-9]\d*/);
    await expect(
      page.getByRole("navigation", { name: "Разделы склада" }).getByRole("link", { name: /Документы/ }),
    ).toContainText(/[1-9]/);

    await tile.click();
    await expect(page).toHaveURL(/\/warehouse\/documents\?/);
  } finally {
    await api.delete(`/admin/goods-receipts/${draft.data.id}`);
    await api.delete(`/admin/stores/${store.id}`);
  }
});
```

В `e2e/warehouse-shell.spec.ts`:
- тест «„Склад“ открывается на остатках…» переименовать в «вкладки ведут по разделу» и начать так:

```ts
  await page.goto("/warehouse");
  await expect(page).toHaveURL(/\/warehouse$/);
  await expect(page.getByRole("heading", { level: 1, name: "Склад" })).toBeVisible();

  const tabs = page.getByRole("navigation", { name: "Разделы склада" });
  await tabs.getByRole("link", { name: "Остатки" }).click();
  await expect(page).toHaveURL(/\/warehouse\/stock$/);
  await expect(tabs.getByRole("link", { name: "Остатки" })).toHaveAttribute("aria-current", "page");
```

(дальше — как было: переход на «Движения»);
- тест «„Склад“ в меню ведёт в раздел»: ожидание `toHaveURL(/\/warehouse$/)`;
- тест «справочники открываются из шапки…»: после «Назад» — `toHaveURL(/\/warehouse$/)`.

В `e2e/stock.spec.ts`, тест «без активного склада…» — плашка теперь на обзоре и на главной; перехват — сводки:

```ts
test("без активного склада обзор показывает красную плашку", async ({ page }) => {
  // Реальные цифры остаются реальными: подменяется только флаг.
  await page.route("**/api/admin/stock/summary*", async (route) => {
    const response = await route.fetch();
    const json = await response.json();

    await route.fulfill({ response, json: { data: { ...json.data, has_active_store: false } } });
  });

  await page.goto("/warehouse");

  await expect(page.getByText("Нет ни одного активного склада.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Настроить места хранения/ })).toBeVisible();
});
```

- [ ] **Step 3: Запустить — должны упасть**

```bash
cd admin && npx playwright test --project=Desktop e2e/warehouse-overview.spec.ts e2e/warehouse-shell.spec.ts
```

Expected: FAIL — `/warehouse` уводит на `/warehouse/stock`, вкладки «Обзор» нет.

- [ ] **Step 4: Типы в `lib/warehouse.ts`**

```ts
export type StockSummary = {
  total_value: number;
  low: number;
  out: number;
  drafts: { receipts: number; write_offs: number };
  recent_movements: StockMovement[];
  has_active_store: boolean;
};
```

- [ ] **Step 5: `StatTile.tsx`**

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cardClass } from './styles';

type Tone = 'neutral' | 'warning' | 'danger';

const TONES: Record<Tone, { icon: string; value: string }> = {
  neutral: { icon: 'bg-blue-50 text-blue-700', value: 'text-zinc-900' },
  warning: { icon: 'bg-amber-50 text-amber-700', value: 'text-amber-700' },
  danger: { icon: 'bg-red-50 text-red-700', value: 'text-red-700' },
};

type Props = { label: string; value: string; icon: ReactNode; tone?: Tone; href?: string };

/**
 * Плитка с одним числом: иконка в тонированном квадрате, значение, подпись.
 * С `href` плитка целиком — ссылка на отфильтрованный список.
 */
export default function StatTile({ label, value, icon, tone = 'neutral', href }: Props) {
  const colors = TONES[tone];
  const body = (
    <>
      <span className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl text-lg ${colors.icon}`} aria-hidden="true">
        {icon}
      </span>
      <span className={`block text-xl font-bold md:text-2xl ${colors.value}`}>{value}</span>
      <span className="block text-sm text-zinc-500">{label}</span>
    </>
  );
  const className = `${cardClass} block min-h-11 p-4`;

  return href ? (
    <Link href={href} className={`${className} transition-colors hover:border-blue-200`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
```

- [ ] **Step 6: `WarehouseSummary.tsx` — контекст сводки**

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import api from '@/lib/api';
import type { StockSummary } from '@/lib/warehouse';

type SummaryState = { summary: StockSummary | null; failed: boolean; reload: () => void };

const SummaryContext = createContext<SummaryState>({ summary: null, failed: false, reload: () => undefined });

/**
 * Сводка склада одним запросом на переход: её читают и шапка раздела
 * (счётчик черновиков на вкладке «Документы»), и вкладка «Обзор».
 * Перезапрашивается при смене адреса — после проведения документа цифры
 * свежие без перезагрузки страницы.
 */
export function WarehouseSummaryProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(() => {
    api
      .get<{ data: StockSummary }>('/admin/stock/summary')
      .then((res) => {
        setSummary(res.data.data);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    // Fetch on navigation: the summary mirrors the API, an external system.
    reload();
  }, [reload, pathname]);

  return <SummaryContext.Provider value={{ summary, failed, reload }}>{children}</SummaryContext.Provider>;
}

export function useWarehouseSummary(): SummaryState {
  return useContext(SummaryContext);
}
```

(Если линтер ругается на `react-hooks/set-state-in-effect`, как в `receipts/[id]/page.tsx`, — тем же комментарием `eslint-disable-next-line` с объяснением.)

- [ ] **Step 7: Шапка и layout**

`WarehouseHeader.tsx`: в `WAREHOUSE_TABS` первым элементом `{ key: 'overview', href: warehouseHref.overview, label: 'Обзор' }`; комментарий «„Обзор“ добавит этап 2» удалить. Внутри `WarehouseHeader`:

```tsx
  const { summary } = useWarehouseSummary();
  const drafts = summary ? summary.drafts.receipts + summary.drafts.write_offs : null;
  const tabs = WAREHOUSE_TABS.map((tab) => (tab.key === 'documents' ? { ...tab, count: drafts } : tab));
```

и `below={<LinkTabs label="Разделы склада" tabs={tabs} active={active} />}` (импорт `useWarehouseSummary` из `./WarehouseSummary`).

`app/warehouse/layout.tsx`: обернуть содержимое в `<WarehouseSummaryProvider>…</WarehouseSummaryProvider>`.

`next.config.ts`: удалить `{ source: "/warehouse", destination: "/warehouse/stock", permanent: false },` и строку комментария про «`/warehouse` пока открывает остатки».

- [ ] **Step 8: Страница «Обзор» `app/warehouse/page.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { formatTenge } from '@/lib/money';
import { ru } from '@/lib/text';
import { documentHref, formatDateTime, formatQty, warehouseHref, type StockSummary } from '@/lib/warehouse';
import NoActiveStoreWarning from '@/components/NoActiveStoreWarning';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import StatTile from '@/components/ui/StatTile';
import { buttonLink, buttonSecondary, cardClass } from '@/components/ui/styles';
import { useWarehouseSummary } from '@/components/warehouse/WarehouseSummary';

/** Куда ведёт плитка «Черновики»: туда, где черновики есть; приёмки — по умолчанию. */
const draftsHref = (summary: StockSummary): string =>
  `${warehouseHref.documents(summary.drafts.receipts === 0 && summary.drafts.write_offs > 0 ? 'write_offs' : 'receipts')}&status=draft`;

export default function WarehouseOverviewPage() {
  const { summary, failed, reload } = useWarehouseSummary();

  if (failed && !summary) {
    return (
      <EmptyState
        title="Не удалось загрузить сводку"
        action={<button type="button" className={buttonSecondary} onClick={reload}>Повторить</button>}
      />
    );
  }

  if (!summary) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
        <span className="sr-only">Загрузка…</span>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <NoActiveStoreWarning hasActiveStore={summary.has_active_store} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Стоимость запаса" value={formatTenge(summary.total_value)} icon="📦" href={warehouseHref.stock} />
        <StatTile label="Заканчивается" value={String(summary.low)} icon="⚠️" tone="warning" href={`${warehouseHref.stock}?status=low`} />
        <StatTile label="Нет в наличии" value={String(summary.out)} icon="⛔" tone="danger" href={`${warehouseHref.stock}?status=out`} />
        <StatTile
          label="Черновики"
          value={String(summary.drafts.receipts + summary.drafts.write_offs)}
          icon="📝"
          href={draftsHref(summary)}
        />
      </div>

      <section aria-labelledby="recent-movements" className={`${cardClass} p-4`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="recent-movements" className="font-semibold text-zinc-900">Последние движения</h2>
          <Link href={warehouseHref.movements} className={buttonLink}>Все движения →</Link>
        </div>
        {summary.recent_movements.length === 0 ? (
          <EmptyState bare title="Движений ещё нет" hint="Остаток появится после первой проведённой приёмки." />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {summary.recent_movements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm">
                <span className="min-w-0">
                  <span className={m.qty_delta >= 0 ? 'font-semibold text-green-700' : 'font-semibold text-red-600'}>
                    {m.qty_delta >= 0 ? '+' : '−'}
                    {formatQty(Math.abs(m.qty_delta))}
                  </span>{' '}
                  <span className="text-zinc-900">{ru(m.product?.name) || `#${m.product?.id}`}</span>
                  {m.document && (
                    <>
                      {' · '}
                      <Link href={documentHref(m.document)} className="text-blue-600 hover:text-blue-800">{m.document.label}</Link>
                    </>
                  )}
                </span>
                <span className="text-xs text-zinc-500">
                  {m.store?.name ?? '—'} · {formatDateTime(m.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

`<section aria-labelledby>` даёт роль `region` с именем «Последние движения» — на неё опирается e2e.

- [ ] **Step 9: Главная — сводка вместо `/admin/stock`**

`app/page.tsx`: запрос `api.get('/admin/stock')` →

```tsx
    api.get<{ data: { has_active_store: boolean } }>('/admin/stock/summary')
      .then((res) => setHasActiveStore(res.data?.data?.has_active_store ?? null))
```

и в докблоке «reads `meta.has_active_store` off the stock endpoint» → «reads `has_active_store` off the warehouse summary».

- [ ] **Step 10: Прогнать — должно пройти**

Перезапуск `next dev` произойдёт сам (правка `next.config.ts`); затем:

```bash
cd admin && npx tsc --noEmit && npm run lint
npx playwright test --project=Desktop e2e/warehouse-overview.spec.ts e2e/warehouse-shell.spec.ts e2e/warehouse.spec.ts e2e/stock.spec.ts
npx playwright test --project=Mobile e2e/mobile/warehouse.spec.ts e2e/mobile/no-horizontal-scroll.spec.ts
```

Expected: PASS (кроме известного «7 шт» в `stock.spec`).

- [ ] **Step 11: Commit**

```bash
git add admin/src admin/next.config.ts admin/e2e
git commit -m "feat(admin): warehouse overview tab with stat tiles and recent movements"
```

---

### Task 5: Вкладка «Остатки» по товару

**Files:**
- Create: `admin/src/components/ui/FilterChips.tsx`
- Create: `admin/src/components/warehouse/StockStores.tsx`
- Modify: `admin/src/components/ui/DataTable.tsx`, `admin/src/components/ui/DataTableCards.tsx` (`expandable`, `hideOnDesktop`)
- Modify: `admin/src/lib/warehouse.ts` (типы, `parseStockStatus`, `parseStockSort`)
- Rewrite: `admin/src/app/warehouse/stock/page.tsx`
- Rewrite: `admin/e2e/stock.spec.ts` (кроме теста плашки из Task 4)
- Modify: `admin/e2e/warehouse.spec.ts` (проверка остатка после приёмки), `admin/e2e/mobile/warehouse.spec.ts`

**Interfaces:**
- Consumes: `GET /api/admin/stock/products` (Task 2); `e2e/warehouseApi.ts` (Task 4); `EmptyState`, `DataTable`, `StoreSelect`, `warehouseHref`, `formatQty`, `formatTenge`, `ru`.
- Produces:
  - `Column<T>.hideOnDesktop?: boolean` — колонка только в карточке телефона.
  - `DataTableProps<T>.expandable?: { canExpand: (row: T) => boolean; render: (row: T) => ReactNode; label: string }` — на ПК кнопка «▸/▾» в первой ячейке (`aria-expanded`, `aria-label={label}`), раскрытая строка рисует `render(row)` во всю ширину под собой. На телефоне не используется.
  - `FilterChips({ label: string; options: { value: string; label: string; count?: number | null }[]; value: string; onChange: (value: string) => void })` — `role="radiogroup"`, чип — `role="radio"` с `aria-checked`.
  - В `lib/warehouse.ts`: `type StockStatus = 'ok' | 'low' | 'out'`, `type StockStoreRow`, `type StockProductRow`, `type StockProductsMeta`, `parseStockStatus(value: string | null): '' | 'low' | 'out'`, `STOCK_SORTS`, `parseStockSort(value: string | null): string`.

- [ ] **Step 1: Написать падающие e2e**

`admin/e2e/stock.spec.ts` — файл целиком (тест плашки — из Task 4, без изменений):

```ts
import { test, expect, type Page } from "@playwright/test";
import { adminApi } from "./adminApi";
import { requireInStockProduct, requireProduct } from "./fixtures";
import { ADMIN_SESSION } from "./session";
import { createProduct, createStore, receive, uniqueStamp } from "./warehouseApi";

/**
 * Вкладка «Остатки»: строка — товар, итог по местам хранения, статус,
 * разбивка по складам. Остаток только показывают — меняют его приёмки,
 * заказы и списания через FIFO-журнал.
 */
test.use({ storageState: ADMIN_SESSION });

const productRow = (page: Page, text: string) => page.locator("tbody tr").filter({ hasText: text });

async function search(page: Page, text: string) {
  await page.getByPlaceholder("Название, код или артикул").fill(text);
}

test("остаток товара из фикстур виден одной строкой", async ({ page }) => {
  const product = requireProduct();

  await page.goto("/warehouse/stock");
  await search(page, product.article);

  const row = productRow(page, product.article);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(product.name);
  await expect(row).toContainText(Number(product.stock).toLocaleString("ru-RU"));
});

test("товар в наличии виден с тем же остатком, что покупатель видит на витрине", async ({ page }) => {
  const product = requireInStockProduct();
  expect(product.stock, "прогон должен принять товар «в наличии» ровно на 7 шт").toBe(7);

  await page.goto("/warehouse/stock");
  await search(page, product.article);
  await expect(productRow(page, product.article)).toContainText("7");
});

test("товар на двух складах — одна строка с итогом, склады раскрываются", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const product = await createProduct(request, stamp);
  const first = await createStore(request, stamp, " А");
  const second = await createStore(request, stamp, " Б");
  await receive(request, first.id, product.id, 4);
  await receive(request, second.id, product.id, 8);

  await page.goto("/warehouse/stock");
  await search(page, product.name);

  const row = productRow(page, product.name);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("12");

  await row.getByRole("button", { name: "Показать места хранения" }).click();
  const breakdown = page.getByRole("list", { name: `Места хранения: ${product.name}` });
  await expect(breakdown.getByText(first.name)).toBeVisible();
  await expect(breakdown.getByText(second.name)).toBeVisible();
});

test("мало — в «Заканчивается», ноль — в «Нет в наличии»", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const low = await createProduct(request, stamp, { min_stock: 5 });
  const never = await createProduct(request, stamp + 1);
  const store = await createStore(request, stamp);
  await receive(request, store.id, low.id, 2);

  await page.goto("/warehouse/stock");
  const chips = page.getByRole("radiogroup", { name: "Статус остатка" });

  await search(page, low.name);
  await chips.getByRole("radio", { name: /Заканчивается/ }).click();
  await expect(page).toHaveURL(/status=low/);
  await expect(productRow(page, low.name)).toHaveCount(1);

  await chips.getByRole("radio", { name: /Нет в наличии/ }).click();
  await expect(productRow(page, low.name)).toHaveCount(0);

  await search(page, never.name);
  await expect(productRow(page, never.name)).toHaveCount(1);

  // Фильтр живёт в адресе: перезагрузка его не сбрасывает.
  await page.reload();
  await expect(chips.getByRole("radio", { name: /Нет в наличии/ })).toHaveAttribute("aria-checked", "true");
});

test("неизвестные параметры адреса не ломают экран", async ({ page }) => {
  await page.goto("/warehouse/stock?status=foo&sort=zzz");

  await expect(
    page.getByRole("radiogroup", { name: "Статус остатка" }).getByRole("radio", { name: /Все/ }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("tbody tr").first()).toBeVisible();
});

test("ссылка «Движения» из строки открывает журнал этого товара", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const product = await createProduct(request, stamp);
  const store = await createStore(request, stamp);
  await receive(request, store.id, product.id, 1);

  await page.goto("/warehouse/stock");
  await search(page, product.name);
  await productRow(page, product.name).getByRole("link", { name: "Движения" }).click();

  await expect(page).toHaveURL(new RegExp(`/warehouse/movements\\?product_id=${product.id}`));
  await expect(page.locator("tbody tr").filter({ hasText: product.name })).toHaveCount(1);
});

// + тест «без активного склада обзор показывает красную плашку» из Task 4 — без изменений.
```

(Неиспользуемый импорт `adminApi` удалить, если тест плашки его не использует.)

`e2e/warehouse.spec.ts`, тест «приёмка проводится…» — проверка остатка после проведения:

```ts
  await page.goto("/warehouse/stock");
  await page.getByPlaceholder("Название, код или артикул").fill(productName);
  const stockRow = page.locator("tbody tr").filter({ hasText: productName });
  await expect(stockRow).toContainText("3");

  await stockRow.getByRole("link", { name: "Движения" }).click();
```

(остальное — как было).

`e2e/mobile/warehouse.spec.ts` — новый тест:

```ts
test("карточка остатка показывает разбивку по местам хранения", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const product = await createProduct(request, stamp);
  const first = await createStore(request, stamp, " А");
  const second = await createStore(request, stamp, " Б");
  await receive(request, first.id, product.id, 1);
  await receive(request, second.id, product.id, 2);

  await page.goto("/warehouse/stock");
  await page.getByPlaceholder("Название, код или артикул").fill(product.name);

  const card = page.getByRole("listitem").filter({ hasText: product.name });
  await expect(card).toContainText(`${first.name} 1`);
  await expect(card).toContainText(`${second.name} 2`);
});
```

(импорт `createProduct, createStore, receive, uniqueStamp` из `../warehouseApi`).

- [ ] **Step 2: Запустить — должны упасть**

```bash
cd admin && npx playwright test --project=Desktop e2e/stock.spec.ts
npx playwright test --project=Mobile e2e/mobile/warehouse.spec.ts
```

Expected: FAIL — нет плейсхолдера «Название, код или артикул», нет чипов.

- [ ] **Step 3: Типы и разбор адреса в `lib/warehouse.ts`**

```ts
export type StockStatus = 'ok' | 'low' | 'out';

export type StockStoreRow = { id: number; name: string | null; stock: number; avg_cost: number | null; stock_value: number };

export type StockProductRow = {
  id: number;
  product: { id: number; name: Translatable; code: string | null; article: string | null; uom: string | null; thumb_url: string | null };
  stock: number;
  min_stock: number;
  avg_cost: number | null;
  stock_value: number;
  status: StockStatus;
  stores: StockStoreRow[];
};

export type StockProductsMeta = { counts: { all: number; low: number; out: number }; total_value: number; low_stock_threshold: number };

/** Статус из адреса: всё, кроме low/out, — «все». */
export const parseStockStatus = (value: string | null): '' | 'low' | 'out' => (value === 'low' || value === 'out' ? value : '');

export const STOCK_SORTS: Record<string, string> = {
  name: 'По названию',
  '-stock': 'Больше остаток',
  stock: 'Меньше остаток',
  '-stock_value': 'Дороже запас',
};

/** Сортировка из адреса: неизвестная — по названию. */
export const parseStockSort = (value: string | null): string => (value && value in STOCK_SORTS ? value : 'name');
```

(`Translatable` импортировать из `@/lib/text`, если его ещё нет в файле.)

- [ ] **Step 4: `FilterChips.tsx`**

```tsx
'use client';

export type ChipOption = { value: string; label: string; count?: number | null };

type Props = { label: string; options: ChipOption[]; value: string; onChange: (value: string) => void };

/**
 * Один выбор из нескольких чипов со счётчиками. На телефоне ряд листается
 * вбок одной строкой.
 */
export default function FilterChips({ label, options, value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
      {options.map((option) => {
        const checked = option.value === value;

        return (
          <button
            key={option.value || 'all'}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(option.value)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors md:min-h-9 ${
              checked ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            {option.label}
            {option.count !== undefined && option.count !== null && (
              <span className={checked ? 'text-white/80' : 'text-zinc-500'}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: `DataTable` — `hideOnDesktop` и `expandable`**

`Column<T>` дополнить:

```ts
  /** Только в карточке телефона — в таблице колонки нет. */
  hideOnDesktop?: boolean;
```

`DataTableProps<T>` дополнить:

```ts
  /**
   * Раскрытие строки на ПК: кнопка «▸» в первой ячейке, под строкой —
   * `render(row)` во всю ширину. На телефоне то же содержимое карточка
   * показывает сама (колонкой с `hideOnDesktop`).
   */
  expandable?: { canExpand: (row: T) => boolean; render: (row: T) => ReactNode; label: string };
```

В теле `DataTable` (desktop-ветка):

```tsx
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const tableColumns = columns.filter((c) => !c.hideOnDesktop);
  const toggle = (key: string | number) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
```

- заголовок: если `expandable`, перед колонками `<th className="w-10 px-2 py-3"><span className="sr-only">Раскрыть</span></th>`;
- `colSpan` пустого состояния и строк скелета — `tableColumns.length + (expandable ? 1 : 0)`; ячейки рисуются по `tableColumns`, не по `columns`;
- строки:

```tsx
              rows.map((row) => {
                const key = rowKey(row);
                const canExpand = expandable?.canExpand(row) ?? false;
                const isOpen = canExpand && expanded.has(key);

                return (
                  <Fragment key={key}>
                    <tr className="hover:bg-zinc-50/70">
                      {expandable && (
                        <td className="w-10 px-2 py-3 align-top">
                          {canExpand && (
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              aria-label={expandable.label}
                              onClick={() => toggle(key)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                            >
                              {isOpen ? '▾' : '▸'}
                            </button>
                          )}
                        </td>
                      )}
                      {tableColumns.map((c) => (
                        <td key={c.key} className={`px-4 py-3 ${c.className ?? ''}`}>
                          {c.render(row)}
                        </td>
                      ))}
                    </tr>
                    {isOpen && (
                      <tr className="bg-zinc-50/60">
                        <td colSpan={tableColumns.length + 1} className="px-4 py-3 pl-14">
                          {expandable!.render(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
```

Импорты: `Fragment`, `useState` из `react`. `CardList` получает `columns` как есть (колонки `hideOnDesktop` — только там); в `DataTableCards.tsx` менять ничего не нужно, кроме того, что `hideOnDesktop` там игнорируется — проверить, что `RowCard` не фильтрует по нему.

- [ ] **Step 6: `StockStores.tsx` — разбивка по местам хранения**

```tsx
import { formatTenge } from '@/lib/money';
import { formatQty, type StockStoreRow } from '@/lib/warehouse';

/** Строка для карточки телефона: «Шоурум 4 · Рыскулова 8». */
export function StockStoresLine({ stores }: { stores: StockStoreRow[] }) {
  if (stores.length === 0) {
    return null;
  }

  return <span>{stores.map((s) => `${s.name ?? '—'} ${formatQty(s.stock)}`).join(' · ')}</span>;
}

/** Раскрытая строка таблицы на ПК: место хранения, остаток, себестоимость, стоимость. */
export function StockStoresTable({ stores, productName }: { stores: StockStoreRow[]; productName: string }) {
  return (
    <ul aria-label={`Места хранения: ${productName}`} className="space-y-1 text-sm text-zinc-600">
      {stores.map((s) => (
        <li key={s.id} className="grid grid-cols-[1fr_6rem_8rem_9rem] gap-4">
          <span>{s.name ?? '—'}</span>
          <span className="text-right">{formatQty(s.stock)}</span>
          <span className="text-right">{formatTenge(s.avg_cost)}</span>
          <span className="text-right">{formatTenge(s.stock_value)}</span>
        </li>
      ))}
    </ul>
  );
}
```

(Проверить, что `formatTenge` принимает `null` и рисует «—» — см. `admin/src/lib/money.ts`; если нет — `s.avg_cost === null ? '—' : formatTenge(s.avg_cost)`.)

- [ ] **Step 7: Переписать `app/warehouse/stock/page.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import api from '@/lib/api';
import type { PageMeta } from '@/lib/crud';
import { formatTenge } from '@/lib/money';
import { ru } from '@/lib/text';
import {
  formatQty,
  parseStockSort,
  parseStockStatus,
  STOCK_SORTS,
  warehouseHref,
  type StockProductRow,
  type StockProductsMeta,
} from '@/lib/warehouse';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import FilterChips from '@/components/ui/FilterChips';
import { buttonLink, buttonSecondary, inputClass } from '@/components/ui/styles';
import StoreSelect from '@/components/warehouse/StoreSelect';
import { StockStoresLine, StockStoresTable } from '@/components/warehouse/StockStores';

type StockBody = { data: StockProductRow[]; current_page: number; last_page: number; meta: StockProductsMeta };

const STATUS_TEXT = { ok: 'text-green-700', low: 'text-amber-700', out: 'text-red-600' } as const;
const STATUS_BADGE = { low: 'bg-amber-50 text-amber-800', out: 'bg-red-50 text-red-700' } as const;
const STATUS_LABEL = { low: 'мало', out: 'нет' } as const;

/**
 * Остатки по товару. Только чтение: остаток меняют приёмки, заказы и
 * списания через FIFO-журнал. Фильтры, сортировка и страница — в адресе.
 */
function StockView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const search = params.get('search') ?? '';
  const storeId = params.get('store_id') ?? '';
  const productId = params.get('product_id') ?? '';
  const status = parseStockStatus(params.get('status'));
  const sort = parseStockSort(params.get('sort'));
  const page = Number(params.get('page')) || 1;

  const [draft, setDraft] = useState(search);
  const [body, setBody] = useState<StockBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const setParam = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    if (!('page' in updates)) {
      next.delete('page');
    }
    router.replace(`${pathname}${next.toString() ? `?${next}` : ''}`);
  };

  // Поиск уходит в адрес с задержкой, чтобы не делать запрос на каждую букву.
  useEffect(() => {
    if (draft === search) {
      return;
    }
    const timer = setTimeout(() => setParam({ search: draft.trim() }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParam читает актуальный адрес
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    const query: Record<string, string> = { page: String(page), sort };
    if (search) query['filter[search]'] = search;
    if (storeId) query['filter[store_id]'] = storeId;
    if (productId) query['filter[product_id]'] = productId;
    if (status) query['filter[status]'] = status;

    // Fetch on URL change: the list mirrors the API, an external system.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api
      .get<StockBody>('/admin/stock/products', { params: query })
      .then((res) => {
        if (!cancelled) {
          setBody(res.data);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [search, storeId, productId, status, sort, page]);

  const counts = body?.meta.counts;
  const rows = body?.data ?? [];
  const meta: PageMeta | null = body ? { current_page: body.current_page, last_page: body.last_page } : null;
  const hasFilters = Boolean(search || storeId || productId || status);
  const unit = (row: StockProductRow) => row.product.uom || 'шт';

  const columns: Column<StockProductRow>[] = [
    {
      key: 'product',
      header: 'Товар',
      mobile: 'title',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.product.thumb_url ? (
            <img src={row.product.thumb_url} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-zinc-100 object-cover" />
          ) : (
            <span className="h-10 w-10 shrink-0 rounded-lg bg-zinc-100" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <div className="font-medium text-zinc-900">
              {ru(row.product.name) || `#${row.product.id}`}
              {row.status !== 'ok' && (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status]}`}>
                  {STATUS_LABEL[row.status]}
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-500">{row.product.article || row.product.code || '—'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Остаток',
      className: 'text-right',
      mobile: 'badge',
      render: (row) => (
        <span className={`font-semibold ${STATUS_TEXT[row.status]}`}>
          {formatQty(row.stock)} {unit(row)}
        </span>
      ),
    },
    { key: 'avg', header: 'Себест. ед.', className: 'text-right', mobile: 'hidden', render: (row) => formatTenge(row.avg_cost) },
    { key: 'value', header: 'Стоимость', className: 'text-right', mobile: 'meta', render: (row) => formatTenge(row.stock_value) },
    { key: 'stores', header: '', mobile: 'meta', hideOnDesktop: true, render: (row) => <StockStoresLine stores={row.stores} /> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      mobile: 'actions',
      render: (row) => (
        <div className="flex justify-end gap-4">
          <Link href={`${warehouseHref.movements}?product_id=${row.product.id}${storeId ? `&store_id=${storeId}` : ''}`} className={buttonLink}>
            Движения
          </Link>
          <Link href={`/products/${row.product.id}`} className={buttonLink}>Открыть товар</Link>
        </div>
      ),
    },
  ];

  const productName = productId ? (rows[0] ? ru(rows[0].product.name) : `Товар #${productId}`) : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          type="search"
          aria-label="Поиск товара"
          placeholder="Название, код или артикул"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={`${inputClass} md:flex-1`}
        />
        <StoreSelect aria-label="Склад" emptyLabel="Все склады" className="md:max-w-64" value={storeId} onChange={(e) => setParam({ store_id: e.target.value })} />
        <select aria-label="Сортировка" className={`${inputClass} md:max-w-56`} value={sort} onChange={(e) => setParam({ sort: e.target.value === 'name' ? '' : e.target.value })}>
          {Object.entries(STOCK_SORTS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <FilterChips
        label="Статус остатка"
        value={status}
        onChange={(value) => setParam({ status: value })}
        options={[
          { value: '', label: 'Все', count: counts?.all },
          { value: 'low', label: 'Заканчивается', count: counts?.low },
          { value: 'out', label: 'Нет в наличии', count: counts?.out },
        ]}
      />

      {productId && (
        <p className="text-sm text-zinc-600">
          Товар: {productName}{' '}
          <button type="button" className={buttonLink} onClick={() => setParam({ product_id: '' })}>Показать все</button>
        </p>
      )}

      {failed ? (
        <EmptyState
          title="Не удалось загрузить остатки"
          action={<button type="button" className={buttonSecondary} onClick={() => router.refresh()}>Повторить</button>}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          meta={meta}
          onPageChange={(next) => setParam({ page: next > 1 ? String(next) : '' })}
          expandable={{
            label: 'Показать места хранения',
            canExpand: (row) => row.stores.length > 0,
            render: (row) => <StockStoresTable stores={row.stores} productName={ru(row.product.name)} />,
          }}
          empty={
            hasFilters ? (
              <EmptyState
                title="Ничего не найдено"
                action={
                  <button
                    type="button"
                    className={buttonSecondary}
                    onClick={() => {
                      setDraft('');
                      router.replace(pathname);
                    }}
                  >
                    Сбросить фильтры
                  </button>
                }
              />
            ) : (
              <EmptyState title="Товаров пока нет" hint="Заведите товар в каталоге и проведите приёмку." />
            )
          }
        />
      )}

      {body && (
        <p className="text-right text-sm text-zinc-500">
          Итого по фильтру: {status ? counts?.[status] : counts?.all} позиций · {formatTenge(body.meta.total_value)}
        </p>
      )}
    </div>
  );
}

export default function StockPage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense fallback={null}>
      <StockView />
    </Suspense>
  );
}
```

Для «Повторить» `router.refresh()` не перезапускает клиентский `useEffect`; вместо него — счётчик попыток в состоянии, добавленный в зависимости эффекта:

```tsx
  const [attempt, setAttempt] = useState(0);
  // …в зависимостях эффекта: [search, storeId, productId, status, sort, page, attempt]
  // …кнопка: onClick={() => setAttempt((n) => n + 1)}
```

(импорт `useRouter` при этом остаётся — он нужен `setParam`).

Стоимость запаса в «Итого по фильтру» — это стоимость **без учёта статуса** (так её считает API); подпись оставить «Итого по фильтру» — число позиций берётся по выбранному чипу. Если это кажется противоречивым при выбранном чипе, показывать стоимость только когда `status === ''` — и записать решение в отчёт.

- [ ] **Step 8: Прогнать — должно пройти**

```bash
cd admin && npx tsc --noEmit && npm run lint
npx playwright test --project=Desktop e2e/stock.spec.ts e2e/warehouse.spec.ts e2e/warehouse-shell.spec.ts e2e/empty-state.spec.ts
npx playwright test --project=Mobile e2e/mobile/warehouse.spec.ts e2e/mobile/no-horizontal-scroll.spec.ts e2e/mobile/controls.spec.ts
```

Expected: PASS (кроме известного «7 шт», если фикстуры не пересобраны).

- [ ] **Step 9: Commit**

```bash
git add admin/src admin/e2e
git commit -m "feat(admin): stock by product with status chips and store breakdown"
```

---

### Task 6: «Мин. остаток» в форме товара, удаление старого `GET /admin/stock`, итоговая проверка

**Files:**
- Modify: `admin/src/components/products/form/formModel.ts`
- Modify: `admin/src/components/products/form/AccountingCard.tsx`
- Modify: `admin/src/components/products/form/StockCard.tsx`
- Modify: `admin/src/components/products/form/ProductForm.tsx` (передать минимум по умолчанию в `AccountingCard`)
- Modify: `admin/e2e/product-form.spec.ts`
- Modify: `app/Http/Controllers/Api/Admin/StockController.php` (удалить `index`), `routes/api.php`
- Delete: `tests/Feature/Admin/StockApiTest.php`

**Interfaces:**
- Consumes: `GET /api/admin/products/{id}` с `min_stock`, `min_stock_default` (Task 1); `warehouseHref`.
- Produces: поле формы `min_stock` (строка, пусто — общий порог); `ApiProduct.min_stock?: string | number | null`, `ApiProduct.min_stock_default?: number`.

- [ ] **Step 1: Написать падающий e2e**

В `admin/e2e/product-form.spec.ts` добавить (по образцу существующих тестов файла — как они открывают товар и сохраняют; кнопка сохранения — «Сохранить» в `SaveBar`):

```ts
test("«Мин. остаток» сохраняется и виден после перезагрузки", async ({ page, request }) => {
  const product = await createProduct(request, uniqueStamp());

  await page.goto(`/products/${product.id}`);
  const field = page.getByLabel("Мин. остаток");
  await expect(field).toHaveAttribute("placeholder", /по умолчанию/);
  await field.fill("3");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Сохранено")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Мин. остаток")).toHaveValue("3");
});
```

(импорт `createProduct, uniqueStamp` из `./warehouseApi`; если сообщение об успешном сохранении в форме товара другое — взять его из `ProductForm.tsx`).

- [ ] **Step 2: Запустить — должен упасть**

```bash
cd admin && npx playwright test --project=Desktop e2e/product-form.spec.ts -g "Мин. остаток"
```

Expected: FAIL — поля нет.

- [ ] **Step 3: Модель формы**

`formModel.ts`:
- `ApiProduct`: после `stock?` добавить

```ts
  /** Порог «заканчивается», decimal:3; null — действует общий порог. */
  min_stock?: string | number | null;
  /** Общий порог из config/inventory.php. */
  min_stock_default?: number;
```

- `productSchema`: после `volume: decimal3,` — `min_stock: decimal3,`
- `SCALARS`: после `'volume',` — `'min_stock',`
- `emptyProductValues`: `min_stock: '',` (рядом с `volume`)
- `toFormValues`: `min_stock: decimalText(p.min_stock),`
- `toFormData`: запятая → точка и для `min_stock`:

```ts
    data.append(field, field === 'weight' || field === 'volume' || field === 'min_stock' ? values[field].replace(',', '.') : values[field]);
```

- [ ] **Step 4: Поле в «Учёте» и текст в «Остатке»**

`AccountingCard.tsx` — пропс `defaultMinStock?: number`; после поля «Единица измерения»:

```tsx
      <Field
        label="Мин. остаток"
        htmlFor="min_stock"
        hint="Меньше или столько же — товар попадёт в «Заканчивается»"
        error={errors.min_stock?.message}
      >
        <input
          id="min_stock"
          inputMode="decimal"
          className={inputClass}
          placeholder={defaultMinStock === undefined ? 'по умолчанию — общий порог' : `по умолчанию: ${defaultMinStock}`}
          aria-invalid={errors.min_stock ? true : undefined}
          {...register('min_stock')}
        />
      </Field>
```

(Проверить, что `Field` поддерживает `hint` — `admin/src/components/ui/Field.tsx`; если нет — подсказку `<p className="text-xs text-zinc-500">` под полем внутри `Field`.)

`ProductForm.tsx`: `<AccountingCard form={form} defaultMinStock={product?.min_stock_default} />`.

`StockCard.tsx`: под «Меняется приёмками, заказами и списаниями» строка

```tsx
      <p className="text-xs text-zinc-500">
        Заканчивается при {formatQuantity(product.min_stock ?? product.min_stock_default ?? 0)} {product.uom || 'шт'} и меньше
      </p>
```

и ссылка «По складам» — с фильтром по товару: `href={`${warehouseHref.stock}?product_id=${product.id}`}`.

- [ ] **Step 5: Удалить старый `GET /admin/stock`**

- `StockController::index()` удалить; из докблока класса убрать абзацы про `index`/`meta.has_active_store` и вместо них одной строкой: «`summary` — сводка для вкладки „Обзор“ (в том числе `has_active_store`), `products` — остатки по товару». Удалить ставшие ненужными импорты (`ProductStoreStock`, `AllowedFilter`, `QueryBuilder`, если не используются).
- `routes/api.php`: удалить `Route::get('stock', [StockController::class, 'index']);`.
- `git rm tests/Feature/Admin/StockApiTest.php` — его проверки покрыты `StockByProductApiTest` (список, фильтры, доступ) и `StockSummaryApiTest` (`has_active_store`).
- Убедиться, что вызовов не осталось:

```bash
grep -rnE "admin/stock['\"\`?]|/admin/stock\b[^/-]" admin/src admin/e2e app routes tests
```

Expected: пусто.

- [ ] **Step 6: Полная проверка этапа**

```bash
php artisan route:clear
STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact
vendor/bin/pint --dirty --format agent
cd admin && npx tsc --noEmit && npm run lint && npm run build
npx playwright test
```

Expected: PHPUnit зелёный; Playwright — всё зелёное, кроме известных (`stock.spec` «7 шт», пропуски `orders.spec`), — сравнить со списком базового прогона.

- [ ] **Step 7: Ручная проверка**

Телефон (375 px в Browser pane или Pixel 7) и ПК: «Склад» → «Обзор» (плитки, последние движения) → плитка «Заканчивается» → «Остатки» с выбранным чипом → раскрыть строку с двумя складами (ПК) / строка «Склад A 1 · Склад B 2» (телефон) → «Движения» из строки → форма товара: «Мин. остаток» сохраняется.

- [ ] **Step 8: Commit и проверка трейлеров**

```bash
git add -A app routes tests admin/src admin/e2e
git commit -m "feat(admin): minimum stock in the product form; drop the old stock endpoint"
git log main..HEAD --format=%B | grep -iE "co-authored-by|generated with" || echo "clean"
```

Expected: `clean`.
