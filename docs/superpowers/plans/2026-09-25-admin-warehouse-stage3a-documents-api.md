# Раздел «Склад», этап 3а: сервер для быстрой приёмки — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API, на котором экран этапа 3б делает приёмку и списание без модалок: черновик создаётся пустым запросом, товар добавляется одним `product_id` (или пачкой), список товаров для выбора отдаётся сразу с остатком и себестоимостью, а поиск товара не зависит от регистра.

**Architecture:** Регистр снимается в PHP: колонка `products.search_text` (ru+kk название, код, артикул в `mb_strtolower`) пишется в `Product::saving`, искать по ней умеет `App\Support\ProductSearch::apply()` — им пользуются список товаров, `StockByProduct` и новый `ProductPicker`. Себестоимость новой строки считает один класс `SuggestedUnitCost`; добавление строк с объединением повторов — один класс `DocumentLines`, который вызывают `POST …/items` и новый `POST …/items/batch` под существующей блокировкой черновика `whileDraft`. Значения по умолчанию при создании документа подставляют контроллеры (`StoreResolver`, последний поставщик менеджера, автор).

**Tech Stack:** Laravel 13 / PHP 8.5, spatie/laravel-query-builder, spatie/laravel-translatable, PHPUnit 12 (SQLite в памяти в тестах, MySQL 8 в dev/prod).

**Spec:** `docs/superpowers/specs/2026-09-24-admin-warehouse-redesign-design.md` — разделы «Поиск товаров без учёта регистра», «`GET /api/admin/product-picker`», «Изменения API документов», «Изменения API позиций», «Вкладка „Документы“» (сортировка), «Тестирование → API», «Этапы» п. 3а.

## Global Constraints

- Остатки только читаются: ничто кроме `FifoInventoryService` не пишет `products.stock` и `product_store_stock`. Этот этап их не трогает (в тестах записи остатка создаются фабрикой `ProductStoreStock`, как в `StockByProductApiTest`).
- Деньги в API — целые тиыны; во входе позиции приёмки `unit_cost` — тенге до 2 знаков (`ConvertsTengeToTiyn`). Количество — `decimal:3`, максимум `9999999.999`, `> 0`.
- `/api/admin/*` — только `admin|manager` (группа маршрутов уже под `auth:sanctum` + `role:admin|manager`).
- Проведённый документ не меняется: любая запись в строки идёт через `whileDraft` (`RefusesPostedDocuments`), ответ 422 «Документ проведён — изменить нельзя.».
- `PUT` позиций и `post` документов не меняются.
- Сообщения API — на русском.
- PHP: после правок — `vendor/bin/pint --dirty --format agent`; фигурные скобки всегда; явные типы; PHPDoc вместо инлайн-комментариев; `declare(strict_types=1);` как в соседних файлах.
- PHP-тесты — с хоста: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact <файл>` (без этих переопределений часть тестов падает из-за `.env`). Правка маршрутов «не видна» — `php artisan route:clear`.
- Миграция dev-базы (MySQL): `docker exec paradisekz-app-1 php artisan migrate --no-interaction`. Никогда `migrate:fresh` и `mvp:acceptance --fresh` — они стирают dev-базу.
- Коммиты — без `Co-Authored-By` и без «Generated with Claude Code».
- Ветка `feat/warehouse-documents-api` от локального `main` в основном checkout (этап 3б будет гонять e2e против dev-сервера :3002 из этого checkout).

### Решения плана, уточняющие спеку

- **Хелпер поиска — `App\Support\ProductSearch`, а не только scope.** `StockByProduct` и `ProductPicker` строят запрос через `DB::table('products')`, где Eloquent-scope недоступен. `Product::scopeSearch()` остаётся тонкой обёрткой над `ProductSearch::apply()`.
- **LIKE экранируется символом `!`, а не `\`.** `ESCAPE '\'` пишется в MySQL и SQLite по-разному (в MySQL обратная косая в строковом литерале сама экранирует), `ESCAPE '!'` одинаков в обеих.
- **Заполнение `search_text` у существующих товаров — `ProductSearch::backfill()`,** его вызывает миграция; тест вызывает его напрямую.
- **`filter[search]` в списке товаров с запятой** («Диван 2,5 м») — spatie/query-builder режет значение фильтра по запятой в массив; обёртка склеивает его обратно.
- **Повторный товар оставляет у строки её себестоимость**, даже если в POST передан другой `unit_cost`, — меняется только количество.
- **Сумма количеств больше `9999999.999`** при объединении — 422 `quantity` «Количество в строке не может быть больше 9 999 999,999.», транзакция откатывается (в `batch` не сохраняется ничего).
- **`supplier_id: null` в теле** — «без поставщика» явно; последний поставщик подставляется, только если ключа `supplier_id` нет вовсе.
- **Переданный `store_id` не проверяется на активность** — как сейчас; `StoreResolver` спрашивается, только если склада в теле нет.
- **«Недавние» в `product-picker`** — товары из приёмок этого склада любого статуса, порядок по `MAX(received_at)`, при равенстве — по `MAX(goods_receipts.id)`.
- **Сортировка списаний** — черновики первыми, затем по `id` (у списания нет даты документа, `id` растёт с созданием); приёмок — черновики, `received_at`, `id`.

## Review Focus

1. **Поиск с символами шаблона LIKE** — «100%» или «_» ищутся как текст, а не «всё подряд». Тест: Task 1 `percent_and_underscore_are_searched_literally`.
2. **Поиск с запятой** («2,5») в списке товаров не падает и находит товар. Тест: Task 1 `a_comma_in_the_search_is_kept`.
3. **Повторный товар в пачке и в документе одновременно** — одна строка с суммой, без дублей. Тест: Task 4 `a_receipt_batch_adds_new_lines_and_merges_repeats`.
4. **Переполнение количества при объединении** — 422 и ничего не записано, даже если другие товары пачки валидны. Тест: Task 3 `merging_past_the_maximum_quantity_is_refused`, Task 4 `an_overflowing_batch_saves_nothing`.
5. **Нет ни одного активного склада** при создании пустым запросом — понятная 422, а не 500 от `NOT NULL store_id`. Тест: Task 5 `without_an_active_store_a_receipt_is_refused`.

---

## Карта файлов

| Файл | Что | Задача |
|---|---|---|
| `database/migrations/2026_09_25_000001_add_search_text_to_products_table.php` | новая колонка + заполнение | 1 |
| `app/Support/ProductSearch.php` | новый: текст для `search_text`, условие поиска, заполнение | 1 |
| `app/Models/Product.php` | `saving` пишет `search_text`, `scopeSearch`, `$hidden` | 1 |
| `app/Http/Controllers/Api/Admin/ProductController.php` | `filter[search]` → `search()` | 1 |
| `app/Services/Inventory/StockByProduct.php` | поиск → `ProductSearch::apply` | 1 |
| `tests/Feature/Admin/ProductSearchTest.php` | новый | 1 |
| `app/Services/Inventory/SuggestedUnitCost.php` | новый: себестоимость новой строки | 2 |
| `tests/Feature/Inventory/SuggestedUnitCostTest.php` | новый | 2 |
| `app/Services/Inventory/DocumentLines.php` | новый: добавление строк с объединением | 3 |
| `app/Http/Requests/Admin/GoodsReceiptItemRequest.php`, `WriteOffItemRequest.php` | POST без `quantity`/`unit_cost` | 3 |
| `app/Http/Controllers/Api/Admin/GoodsReceiptItemController.php`, `WriteOffItemController.php` | `store` через `DocumentLines`; `batch` | 3, 4 |
| `tests/Feature/Admin/GoodsReceiptItemApiTest.php`, `WriteOffItemApiTest.php` | новые случаи | 3 |
| `app/Http/Requests/Admin/DocumentItemsBatchRequest.php` | новый | 4 |
| `routes/api.php` | `items/batch` ×2, `product-picker` | 4, 6 |
| `tests/Feature/Admin/DocumentItemsBatchApiTest.php` | новый | 4 |
| `app/Http/Controllers/Api/Admin/Concerns/DefaultsDocumentStore.php` | новый: склад по умолчанию | 5 |
| `app/Http/Requests/Admin/GoodsReceiptRequest.php`, `WriteOffRequest.php` | POST без `store_id` (и `reason`) | 5 |
| `app/Http/Controllers/Api/Admin/GoodsReceiptController.php`, `WriteOffController.php` | значения по умолчанию в `store`; сортировка в `index` | 5, 7 |
| `tests/Feature/Admin/GoodsReceiptApiTest.php`, `WriteOffApiTest.php` | новые случаи, правка «store обязателен» | 5, 7 |
| `app/Services/Inventory/ProductPicker.php` | новый | 6 |
| `app/Http/Controllers/Api/Admin/ProductPickerController.php` | новый | 6 |
| `tests/Feature/Admin/ProductPickerApiTest.php` | новый | 6 |

---

### Task 0: Ветка

- [ ] **Step 1: Создать ветку от локального `main`**

```bash
git switch main
git switch -c feat/warehouse-documents-api
```

- [ ] **Step 2: Убедиться, что сьют зелёный до начала**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin`
Expected: PASS (все тесты папки). Если красное — остановиться и сообщить, не начинать.

---

### Task 1: Поиск товара без учёта регистра (`search_text`)

**Files:**
- Create: `database/migrations/2026_09_25_000001_add_search_text_to_products_table.php`
- Create: `app/Support/ProductSearch.php`
- Modify: `app/Models/Product.php` (свойства класса, `booted()`, новый scope после `scopeActive`)
- Modify: `app/Http/Controllers/Api/Admin/ProductController.php` (callback `search` в `index`)
- Modify: `app/Services/Inventory/StockByProduct.php` (блок `->when($filters['search'] …)` в `rows()`)
- Test: `tests/Feature/Admin/ProductSearchTest.php`

**Interfaces:**
- Produces:
  - `App\Support\ProductSearch::haystack(Product $product): string`
  - `App\Support\ProductSearch::normalize(string $text): string`
  - `App\Support\ProductSearch::apply(\Illuminate\Contracts\Database\Query\Builder $query, string $term, string $column = 'products.search_text'): void` — работает и с `DB::table('products')`, и с Eloquent-запросом к `products`.
  - `App\Support\ProductSearch::backfill(): int`
  - `Product::scopeSearch(Builder $query, string $term): void` → `Product::query()->search('диван')`.

- [ ] **Step 1: Написать падающий тест**

`tests/Feature/Admin/ProductSearchTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Support\ProductSearch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ProductSearchTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        $this->actingAsManager();
    }

    /**
     * @return list<int>
     */
    private function productIds(string $search): array
    {
        return collect($this->getJson('/api/admin/products?filter[search]='.rawurlencode($search))->assertOk()->json('data'))
            ->pluck('id')
            ->all();
    }

    /**
     * @return list<int>
     */
    private function stockIds(string $search): array
    {
        return collect($this->getJson('/api/admin/stock/products?filter[search]='.rawurlencode($search))->assertOk()->json('data'))
            ->pluck('product.id')
            ->all();
    }

    #[Test]
    public function any_letter_case_finds_a_cyrillic_name(): void
    {
        $sofa = Product::factory()->create(['name' => ['ru' => 'Диван Осло']]);
        Product::factory()->create(['name' => ['ru' => 'Стол Лофт']]);

        foreach (['диван', 'ДИВАН', 'Диван', 'осло'] as $search) {
            $this->assertSame([$sofa->id], $this->productIds($search), "admin/products: {$search}");
            $this->assertSame([$sofa->id], $this->stockIds($search), "stock/products: {$search}");
        }
    }

    #[Test]
    public function the_kazakh_name_code_and_article_are_searched(): void
    {
        $product = Product::factory()->create([
            'name' => ['ru' => 'Кресло', 'kk' => 'Орындық'],
            'code' => 'PX-501',
            'article' => 'ART-Берн',
        ]);
        Product::factory()->create(['name' => ['ru' => 'Стул'], 'code' => 'Z-1', 'article' => 'Z-2']);

        foreach (['орындық', 'px-501', 'берн'] as $search) {
            $this->assertSame([$product->id], $this->productIds($search), $search);
        }
    }

    #[Test]
    public function renaming_a_product_updates_what_it_is_found_by(): void
    {
        $product = Product::factory()->create(['name' => ['ru' => 'Тумба']]);

        $product->setTranslation('name', 'ru', 'Комод')->save();

        $this->assertSame([], $this->productIds('тумба'));
        $this->assertSame([$product->id], $this->productIds('комод'));
    }

    #[Test]
    public function percent_and_underscore_are_searched_literally(): void
    {
        $discounted = Product::factory()->create(['name' => ['ru' => 'Стол скидка 100%'], 'code' => 'A1', 'article' => 'B1']);
        Product::factory()->create(['name' => ['ru' => 'Стул'], 'code' => 'A2', 'article' => 'B2']);

        $this->assertSame([$discounted->id], $this->productIds('100%'));
        $this->assertSame([], $this->productIds('_'));
    }

    #[Test]
    public function a_comma_in_the_search_is_kept(): void
    {
        $sofa = Product::factory()->create(['name' => ['ru' => 'Диван 2,5 м']]);
        Product::factory()->create(['name' => ['ru' => 'Диван 3 м']]);

        $this->assertSame([$sofa->id], $this->productIds('2,5'));
    }

    #[Test]
    public function backfill_fills_products_saved_before_the_column_existed(): void
    {
        $product = Product::factory()->create(['name' => ['ru' => 'Шкаф Норд']]);
        DB::table('products')->where('id', $product->id)->update(['search_text' => null]);

        $this->assertSame(1, ProductSearch::backfill());
        $this->assertSame([$product->id], Product::query()->search('шкаф')->pluck('id')->all());
    }

    #[Test]
    public function search_text_is_not_exposed_by_the_api(): void
    {
        Product::factory()->create(['name' => ['ru' => 'Диван']]);

        $this->assertArrayNotHasKey('search_text', $this->getJson('/api/admin/products')->assertOk()->json('data.0'));
    }
}
```

- [ ] **Step 2: Запустить — тест падает**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/ProductSearchTest.php`
Expected: FAIL — `Class "App\Support\ProductSearch" not found` / строчные буквы не находят «Диван» (на SQLite кириллица не складывается по регистру).

- [ ] **Step 3: Хелпер `ProductSearch`**

`app/Support/ProductSearch.php`:

```php
<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Product;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Поиск товара без учёта регистра на любой СУБД.
 *
 * `name->ru LIKE` в MySQL сравнивает результат json_extract в utf8mb4_bin, и
 * «диван» не находит «Диван»; SQLite (тесты) не складывает регистр кириллицы
 * ни в LIKE, ни в lower(). Поэтому регистр снимается в PHP: при сохранении
 * товара в `products.search_text` пишутся названия (ru, kk), код и артикул в
 * нижнем регистре, и искомая строка приводится так же.
 */
final class ProductSearch
{
    /**
     * Текст колонки `search_text` для товара.
     */
    public static function haystack(Product $product): string
    {
        $parts = [
            $product->getTranslation('name', 'ru', false),
            $product->getTranslation('name', 'kk', false),
            $product->code,
            $product->article,
        ];

        return self::normalize(implode(' ', array_filter($parts, fn (?string $part): bool => $part !== null && $part !== '')));
    }

    public static function normalize(string $text): string
    {
        return mb_strtolower(trim($text));
    }

    /**
     * Оставляет в запросе к `products` товары, в тексте которых есть $term.
     * `%` и `_` ищутся как обычные символы; экранирующий символ — `!`,
     * потому что `ESCAPE '\'` в MySQL и SQLite записывается по-разному.
     */
    public static function apply(Builder $query, string $term, string $column = 'products.search_text'): void
    {
        $needle = self::normalize($term);

        if ($needle === '') {
            return;
        }

        $escaped = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $needle);

        $query->whereRaw("{$column} LIKE ? ESCAPE '!'", ["%{$escaped}%"]);
    }

    /**
     * Заполняет `search_text` у товаров, где он пуст (сохранённых до появления
     * колонки или вставленных мимо событий модели). Возвращает их количество.
     */
    public static function backfill(): int
    {
        $filled = 0;

        Product::query()->whereNull('search_text')->chunkById(500, function (Collection $products) use (&$filled): void {
            foreach ($products as $product) {
                DB::table('products')->where('id', $product->id)->update(['search_text' => self::haystack($product)]);
                $filled++;
            }
        });

        return $filled;
    }
}
```

- [ ] **Step 4: Миграция**

`database/migrations/2026_09_25_000001_add_search_text_to_products_table.php`:

```php
<?php

declare(strict_types=1);

use App\Support\ProductSearch;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Текст для поиска товара без учёта регистра — см. {@see ProductSearch}.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->text('search_text')->nullable()->after('article');
        });

        ProductSearch::backfill();
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('search_text');
        });
    }
};
```

- [ ] **Step 5: Модель `Product`**

В `app/Models/Product.php`:

1. Импорт: `use App\Support\ProductSearch;`
2. После `protected $fillable = [...]` добавить:

```php
    /**
     * Служебная колонка поиска ({@see ProductSearch}) — не для ответов API.
     *
     * @var list<string>
     */
    protected $hidden = ['search_text'];
```

3. В `booted()` перед `static::created(...)` добавить:

```php
        static::saving(function (Product $product): void {
            $product->search_text = ProductSearch::haystack($product);
        });
```

4. После `scopeActive(...)` добавить:

```php
    /**
     * Товары, у которых название (ru/kk), код или артикул содержат $term,
     * без учёта регистра.
     */
    public function scopeSearch(Builder $query, string $term): void
    {
        ProductSearch::apply($query, $term);
    }
```

- [ ] **Step 6: `ProductController@index`**

В `app/Http/Controllers/Api/Admin/ProductController.php` заменить callback фильтра `search`:

```php
                AllowedFilter::callback('search', function ($query, $value) {
                    $query->where(function ($q) use ($value) {
                        $q->where('name->ru', 'LIKE', "%{$value}%")
                            ->orWhere('name->kk', 'LIKE', "%{$value}%")
                            ->orWhere('code', 'LIKE', "%{$value}%");
                    });
                }),
```

на:

```php
                // query-builder режет значение фильтра по запятой в массив —
                // «Диван 2,5 м» склеивается обратно.
                AllowedFilter::callback('search', fn (Builder $query, mixed $value) => $query->search(
                    is_array($value) ? implode(',', $value) : (string) $value,
                )),
```

(добавить `use Illuminate\Database\Eloquent\Builder;`, если его нет). Обновить PHPDoc `index`: `filter[search]=<name|code|article>, без учёта регистра`.

- [ ] **Step 7: `StockByProduct`**

В `app/Services/Inventory/StockByProduct.php`, метод `rows()`, заменить:

```php
            ->when($filters['search'] ?? null, function (Builder $query, string $search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query->where('products.name->ru', 'like', "%{$search}%")
                        ->orWhere('products.name->kk', 'like', "%{$search}%")
                        ->orWhere('products.code', 'like', "%{$search}%")
                        ->orWhere('products.article', 'like', "%{$search}%");
                });
            });
```

на:

```php
            ->when($filters['search'] ?? null, fn (Builder $query, string $search) => ProductSearch::apply($query, $search));
```

и добавить `use App\Support\ProductSearch;`.

- [ ] **Step 8: Тесты зелёные, соседние не сломаны**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/ProductSearchTest.php tests/Feature/Admin/StockByProductApiTest.php tests/Feature/Admin/ProductCrudTest.php tests/Feature/Admin/CatalogAdminTest.php`
Expected: PASS.

- [ ] **Step 9: Проверка на MySQL (dev-база)**

```bash
docker exec paradisekz-app-1 php artisan migrate --no-interaction
docker exec paradisekz-app-1 php artisan tinker --execute 'echo App\Models\Product::query()->search("диван")->count(), " / ", App\Models\Product::query()->search("ДИВАН")->count(), " / ", App\Models\Product::query()->whereNull("search_text")->count();'
```

Expected: первые два числа равны и больше 0 (в dev-базе есть «ACC Диван приёмки …»), третье — `0`.

- [ ] **Step 10: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Support/ProductSearch.php app/Models/Product.php app/Http/Controllers/Api/Admin/ProductController.php app/Services/Inventory/StockByProduct.php database/migrations/2026_09_25_000001_add_search_text_to_products_table.php tests/Feature/Admin/ProductSearchTest.php
git commit -m "fix(api): case-insensitive product search via products.search_text"
```

---

### Task 2: Себестоимость новой строки (`SuggestedUnitCost`)

**Files:**
- Create: `app/Services/Inventory/SuggestedUnitCost.php`
- Test: `tests/Feature/Inventory/SuggestedUnitCostTest.php`

**Interfaces:**
- Produces:
  - `App\Services\Inventory\SuggestedUnitCost::forMany(array $productIds, int $storeId): array` — `list<int>` → `array<int, int>` (`product_id` → тиыны), ключ есть для каждого запрошенного товара.
  - `App\Services\Inventory\SuggestedUnitCost::for(int $productId, int $storeId): int`

- [ ] **Step 1: Написать падающий тест**

`tests/Feature/Inventory/SuggestedUnitCostTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\Store;
use App\Services\Inventory\SuggestedUnitCost;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SuggestedUnitCostTest extends TestCase
{
    use RefreshDatabase;

    private function receiptLine(Product $product, Store $store, int $unitCost, ?string $postedAt): void
    {
        $receipt = GoodsReceipt::factory()->for($store, 'store')->create([
            'status' => $postedAt === null ? GoodsReceipt::STATUS_DRAFT : GoodsReceipt::STATUS_POSTED,
            'posted_at' => $postedAt,
        ]);
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create(['product_id' => $product->id, 'unit_cost' => $unitCost]);
    }

    #[Test]
    public function the_latest_posted_receipt_wins_on_any_store(): void
    {
        $product = Product::factory()->create();
        $here = Store::factory()->create();
        $there = Store::factory()->create();
        $this->receiptLine($product, $here, 100_000, '2026-09-01 10:00:00');
        $this->receiptLine($product, $there, 120_000, '2026-09-20 10:00:00');
        $this->receiptLine($product, $here, 999_999, null);
        ProductStoreStock::factory()->create(['product_id' => $product->id, 'store_id' => $here->id, 'stock' => 3, 'avg_cost' => 70_000]);

        $this->assertSame(120_000, app(SuggestedUnitCost::class)->for($product->id, $here->id));
    }

    #[Test]
    public function without_posted_receipts_the_store_average_cost_is_used(): void
    {
        $product = Product::factory()->create();
        $here = Store::factory()->create();
        $there = Store::factory()->create();
        $this->receiptLine($product, $here, 999_999, null);
        ProductStoreStock::factory()->create(['product_id' => $product->id, 'store_id' => $here->id, 'stock' => 3, 'avg_cost' => 70_000]);
        ProductStoreStock::factory()->create(['product_id' => $product->id, 'store_id' => $there->id, 'stock' => 3, 'avg_cost' => 90_000]);

        $this->assertSame(70_000, app(SuggestedUnitCost::class)->for($product->id, $here->id));
    }

    #[Test]
    public function a_product_with_no_history_costs_zero(): void
    {
        $product = Product::factory()->create();
        $store = Store::factory()->create();

        $this->assertSame(0, app(SuggestedUnitCost::class)->for($product->id, $store->id));
    }

    #[Test]
    public function for_many_answers_every_requested_product(): void
    {
        $known = Product::factory()->create();
        $unknown = Product::factory()->create();
        $store = Store::factory()->create();
        $this->receiptLine($known, $store, 55_000, '2026-09-20 10:00:00');

        $this->assertSame(
            [$known->id => 55_000, $unknown->id => 0],
            app(SuggestedUnitCost::class)->forMany([$known->id, $unknown->id], $store->id),
        );
        $this->assertSame([], app(SuggestedUnitCost::class)->forMany([], $store->id));
    }
}
```

- [ ] **Step 2: Запустить — тест падает**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Inventory/SuggestedUnitCostTest.php`
Expected: FAIL — `Class "App\Services\Inventory\SuggestedUnitCost" not found`.

- [ ] **Step 3: Реализация**

`app/Services/Inventory/SuggestedUnitCost.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\ProductStoreStock;

/**
 * Себестоимость, которую получает новая строка приёмки без `unit_cost`, и
 * которую «Подбор» показывает заранее: из последней проведённой приёмки
 * товара (любой склад, по `posted_at`), иначе средняя себестоимость товара
 * на складе документа, иначе 0. В тиынах.
 */
class SuggestedUnitCost
{
    public function for(int $productId, int $storeId): int
    {
        return $this->forMany([$productId], $storeId)[$productId];
    }

    /**
     * @param  list<int>  $productIds
     * @return array<int, int>
     */
    public function forMany(array $productIds, int $storeId): array
    {
        if ($productIds === []) {
            return [];
        }

        $costs = array_fill_keys($productIds, 0);

        $averages = ProductStoreStock::query()
            ->where('store_id', $storeId)
            ->whereIn('product_id', $productIds)
            ->whereNotNull('avg_cost')
            ->pluck('avg_cost', 'product_id');

        foreach ($averages as $productId => $cost) {
            $costs[(int) $productId] = (int) $cost;
        }

        /** Старые первыми: каждая следующая строка перезаписывает цену, последней остаётся самая свежая. */
        $posted = GoodsReceiptItem::query()
            ->join('goods_receipts', 'goods_receipts.id', '=', 'goods_receipt_items.goods_receipt_id')
            ->where('goods_receipts.status', GoodsReceipt::STATUS_POSTED)
            ->whereIn('goods_receipt_items.product_id', $productIds)
            ->orderBy('goods_receipts.posted_at')
            ->orderBy('goods_receipt_items.id')
            ->get(['goods_receipt_items.product_id', 'goods_receipt_items.unit_cost']);

        foreach ($posted as $line) {
            $costs[(int) $line->product_id] = (int) $line->unit_cost;
        }

        return $costs;
    }
}
```

- [ ] **Step 4: Тест зелёный**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Inventory/SuggestedUnitCostTest.php`
Expected: PASS (4 теста).

- [ ] **Step 5: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Services/Inventory/SuggestedUnitCost.php tests/Feature/Inventory/SuggestedUnitCostTest.php
git commit -m "feat(api): suggested unit cost for a new receipt line"
```

---

### Task 3: Строка документа одним `product_id` (`DocumentLines`, POST позиций)

**Files:**
- Create: `app/Services/Inventory/DocumentLines.php`
- Modify: `app/Http/Requests/Admin/GoodsReceiptItemRequest.php` (`rules()`)
- Modify: `app/Http/Requests/Admin/WriteOffItemRequest.php` (`rules()`)
- Modify: `app/Http/Controllers/Api/Admin/GoodsReceiptItemController.php` (`store`)
- Modify: `app/Http/Controllers/Api/Admin/WriteOffItemController.php` (`store`)
- Test: `tests/Feature/Admin/GoodsReceiptItemApiTest.php`, `tests/Feature/Admin/WriteOffItemApiTest.php`

**Interfaces:**
- Consumes: `SuggestedUnitCost::for(int, int): int`, `SuggestedUnitCost::forMany(list<int>, int): array<int,int>` (Task 2).
- Produces:
  - `App\Services\Inventory\DocumentLines::add(GoodsReceipt|WriteOff $document, int $productId, ?string $quantity = null, ?int $unitCost = null): array{item: GoodsReceiptItem|WriteOffItem, created: bool}`
  - `App\Services\Inventory\DocumentLines::addMany(GoodsReceipt|WriteOff $document, array $lines): void` — `$lines`: `list<array{product_id: int, quantity?: string|int|float|null}>`.
  - Оба метода вызываются **только внутри `whileDraft`** (документ уже заблокирован); при переполнении бросают `ValidationException` по ключу `quantity`.

- [ ] **Step 1: Написать падающие тесты приёмки**

В `tests/Feature/Admin/GoodsReceiptItemApiTest.php` добавить импорты `use App\Models\ProductStoreStock;` и методы:

```php
    #[Test]
    public function a_line_needs_only_the_product(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $earlier = GoodsReceipt::factory()->posted()->create(['posted_at' => '2026-09-20 10:00:00']);
        GoodsReceiptItem::factory()->for($earlier, 'goodsReceipt')->create(['product_id' => $product->id, 'unit_cost' => 120_000]);
        $receipt = GoodsReceipt::factory()->create();

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", ['product_id' => $product->id])
            ->assertCreated()
            ->assertJsonPath('data.quantity', '1.000')
            ->assertJsonPath('data.unit_cost', 120_000)
            ->assertJsonPath('data.product.id', $product->id);
    }

    #[Test]
    public function without_history_the_line_costs_the_store_average_or_zero(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        $averaged = Product::factory()->create();
        $fresh = Product::factory()->create();
        ProductStoreStock::factory()->create(['product_id' => $averaged->id, 'store_id' => $receipt->store_id, 'stock' => 2, 'avg_cost' => 70_000]);

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", ['product_id' => $averaged->id])
            ->assertCreated()
            ->assertJsonPath('data.unit_cost', 70_000);
        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", ['product_id' => $fresh->id])
            ->assertCreated()
            ->assertJsonPath('data.unit_cost', 0);
    }

    #[Test]
    public function adding_a_product_again_raises_its_line_instead_of_a_second_one(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        $product = Product::factory()->create();

        $id = $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", [
            'product_id' => $product->id, 'quantity' => '2', 'unit_cost' => '1500',
        ])->assertCreated()->json('data.id');

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", ['product_id' => $product->id, 'unit_cost' => '9'])
            ->assertOk()
            ->assertJsonPath('data.id', $id)
            ->assertJsonPath('data.quantity', '3.000')
            ->assertJsonPath('data.unit_cost', 150_000);

        $this->assertSame(1, $receipt->items()->count());
    }

    #[Test]
    public function merging_past_the_maximum_quantity_is_refused(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        $item = GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create(['quantity' => '9999999.000']);

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", ['product_id' => $item->product_id, 'quantity' => '1.5'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('quantity');

        $this->assertSame('9999999.000', $item->fresh()->quantity);
    }
```

- [ ] **Step 2: Написать падающие тесты списания**

В `tests/Feature/Admin/WriteOffItemApiTest.php` добавить:

```php
    #[Test]
    public function a_write_off_line_needs_only_the_product_and_repeats_merge(): void
    {
        $this->actingAsManager();
        $writeOff = WriteOff::factory()->create();
        $product = Product::factory()->create();

        $id = $this->postJson("/api/admin/write-offs/{$writeOff->id}/items", ['product_id' => $product->id])
            ->assertCreated()
            ->assertJsonPath('data.quantity', '1.000')
            ->json('data.id');

        $this->postJson("/api/admin/write-offs/{$writeOff->id}/items", ['product_id' => $product->id, 'quantity' => '0.5'])
            ->assertOk()
            ->assertJsonPath('data.id', $id)
            ->assertJsonPath('data.quantity', '1.500');

        $this->assertSame(1, $writeOff->items()->count());
    }
```

- [ ] **Step 3: Запустить — тесты падают**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/GoodsReceiptItemApiTest.php tests/Feature/Admin/WriteOffItemApiTest.php`
Expected: FAIL — 422 `quantity`/`unit_cost` required; повторный товар даёт 201 и вторую строку.

- [ ] **Step 4: `DocumentLines`**

`app/Services/Inventory/DocumentLines.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\WriteOff;
use App\Models\WriteOffItem;
use Illuminate\Validation\ValidationException;

/**
 * Добавление строк в черновик приёмки или списания: количество по умолчанию
 * 1, себестоимость строки приёмки по умолчанию — {@see SuggestedUnitCost};
 * товар, который уже есть в документе, увеличивает количество своей строки
 * (себестоимость строки не меняется) вместо второй строки.
 *
 * Вызывать внутри `whileDraft` (`RefusesPostedDocuments`): документ уже
 * заблокирован, и `ValidationException` откатывает всю транзакцию.
 */
class DocumentLines
{
    /** Наибольшее количество в строке, в тысячных (`9999999.999`). */
    private const MAX_MILLI_QUANTITY = 9_999_999_999;

    public function __construct(private readonly SuggestedUnitCost $costs) {}

    /**
     * @return array{item: GoodsReceiptItem|WriteOffItem, created: bool}
     */
    public function add(GoodsReceipt|WriteOff $document, int $productId, ?string $quantity = null, ?int $unitCost = null): array
    {
        $quantity ??= '1';

        /** @var GoodsReceiptItem|WriteOffItem|null $existing */
        $existing = $document->items()->where('product_id', $productId)->orderBy('id')->first();

        if ($existing !== null) {
            $existing->quantity = $this->sum((string) $existing->quantity, $quantity);
            $existing->save();

            return ['item' => $existing, 'created' => false];
        }

        $attributes = ['product_id' => $productId, 'quantity' => $this->sum('0', $quantity)];

        if ($document instanceof GoodsReceipt) {
            $attributes['unit_cost'] = $unitCost ?? $this->costs->for($productId, $document->store_id);
        }

        return ['item' => $document->items()->create($attributes), 'created' => true];
    }

    /**
     * Повторы внутри $lines складываются до записи; себестоимость новых строк
     * приёмки считается одним запросом на всю пачку.
     *
     * @param  list<array{product_id: int|string, quantity?: string|int|float|null}>  $lines
     */
    public function addMany(GoodsReceipt|WriteOff $document, array $lines): void
    {
        $quantities = [];

        foreach ($lines as $line) {
            $productId = (int) $line['product_id'];
            $quantity = isset($line['quantity']) ? (string) $line['quantity'] : '1';
            $quantities[$productId] = isset($quantities[$productId]) ? $this->sum($quantities[$productId], $quantity) : $quantity;
        }

        $costs = $document instanceof GoodsReceipt
            ? $this->costs->forMany(array_keys($quantities), $document->store_id)
            : [];

        foreach ($quantities as $productId => $quantity) {
            $this->add($document, $productId, $quantity, $costs[$productId] ?? null);
        }
    }

    /**
     * Сумма двух количеств в тысячных — без накопления ошибки float.
     */
    private function sum(string $left, string $right): string
    {
        $milli = (int) round((float) $left * 1000) + (int) round((float) $right * 1000);

        if ($milli > self::MAX_MILLI_QUANTITY) {
            throw ValidationException::withMessages([
                'quantity' => 'Количество в строке не может быть больше 9 999 999,999.',
            ]);
        }

        return number_format($milli / 1000, 3, '.', '');
    }
}
```

- [ ] **Step 5: Правила POST позиций**

`app/Http/Requests/Admin/GoodsReceiptItemRequest.php`, `rules()`:

```php
    public function rules(): array
    {
        $isCreate = $this->isMethod('POST');

        return [
            'product_id' => [$isCreate ? 'required' : 'sometimes', 'integer', 'exists:products,id'],
            // POST: без количества — 1, без себестоимости — SuggestedUnitCost.
            'quantity' => [$isCreate ? 'nullable' : 'sometimes', 'numeric', 'decimal:0,3', 'gt:0', 'max:9999999.999'],
            'unit_cost' => [$isCreate ? 'nullable' : 'sometimes', 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
        ];
    }
```

`app/Http/Requests/Admin/WriteOffItemRequest.php`, `rules()`:

```php
    public function rules(): array
    {
        $isCreate = $this->isMethod('POST');

        return [
            'product_id' => [$isCreate ? 'required' : 'sometimes', 'integer', 'exists:products,id'],
            // POST: без количества — 1.
            'quantity' => [$isCreate ? 'nullable' : 'sometimes', 'numeric', 'decimal:0,3', 'gt:0', 'max:9999999.999'],
        ];
    }
```

- [ ] **Step 6: `store` в контроллерах позиций**

`GoodsReceiptItemController` — импорт `use App\Services\Inventory\DocumentLines;`, `store` заменить на:

```php
    /**
     * 201 — новая строка; 200 — товар уже был в документе, его строка
     * получила переданное количество (или +1).
     */
    public function store(GoodsReceiptItemRequest $request, GoodsReceipt $goodsReceipt, DocumentLines $lines): JsonResponse
    {
        return $this->whileDraft($goodsReceipt, function (GoodsReceipt $locked) use ($request, $lines): JsonResponse {
            $data = $request->validated();

            ['item' => $item, 'created' => $created] = $lines->add(
                $locked,
                (int) $data['product_id'],
                isset($data['quantity']) ? (string) $data['quantity'] : null,
                isset($data['unit_cost']) ? (int) $data['unit_cost'] : null,
            );

            return response()->json(['data' => $item->load(self::PRODUCT_COLUMNS)], $created ? 201 : 200);
        });
    }
```

`WriteOffItemController` — импорт `use App\Services\Inventory\DocumentLines;`, `store` заменить на:

```php
    /**
     * 201 — новая строка; 200 — товар уже был в документе, его строка
     * получила переданное количество (или +1).
     */
    public function store(WriteOffItemRequest $request, WriteOff $writeOff, DocumentLines $lines): JsonResponse
    {
        return $this->whileDraft($writeOff, function (WriteOff $locked) use ($request, $lines): JsonResponse {
            $data = $request->validated();

            ['item' => $item, 'created' => $created] = $lines->add(
                $locked,
                (int) $data['product_id'],
                isset($data['quantity']) ? (string) $data['quantity'] : null,
            );

            return response()->json(['data' => $item->load(self::PRODUCT_COLUMNS)], $created ? 201 : 200);
        });
    }
```

- [ ] **Step 7: Тесты зелёные**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/GoodsReceiptItemApiTest.php tests/Feature/Admin/WriteOffItemApiTest.php tests/Feature/Admin/RefusesPostedDocumentsTest.php`
Expected: PASS, включая прежние `quantity_and_cost_are_validated` и `lines_of_a_posted_receipt_are_frozen`.

- [ ] **Step 8: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Services/Inventory/DocumentLines.php app/Http/Requests/Admin/GoodsReceiptItemRequest.php app/Http/Requests/Admin/WriteOffItemRequest.php app/Http/Controllers/Api/Admin/GoodsReceiptItemController.php app/Http/Controllers/Api/Admin/WriteOffItemController.php tests/Feature/Admin/GoodsReceiptItemApiTest.php tests/Feature/Admin/WriteOffItemApiTest.php
git commit -m "feat(api): add a document line by product alone; repeats merge into one line"
```

---

### Task 4: Пачка строк (`POST …/items/batch`)

**Files:**
- Create: `app/Http/Requests/Admin/DocumentItemsBatchRequest.php`
- Modify: `app/Http/Controllers/Api/Admin/GoodsReceiptItemController.php` (новый метод `batch`)
- Modify: `app/Http/Controllers/Api/Admin/WriteOffItemController.php` (новый метод `batch`)
- Modify: `routes/api.php` (рядом с `apiResource('goods-receipts.items', …)` и `apiResource('write-offs.items', …)`)
- Test: `tests/Feature/Admin/DocumentItemsBatchApiTest.php`

**Interfaces:**
- Consumes: `DocumentLines::addMany(GoodsReceipt|WriteOff, list<array{product_id, quantity?}>): void` (Task 3).
- Produces: `POST /api/admin/goods-receipts/{id}/items/batch`, `POST /api/admin/write-offs/{id}/items/batch` — тело `{ items: [{ product_id, quantity? }] }`, 1–200; ответ 200 в формате `index` соответствующего контроллера (у списания строки с `available`).

- [ ] **Step 1: Написать падающий тест**

`tests/Feature/Admin/DocumentItemsBatchApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\WriteOff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class DocumentItemsBatchApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_add_a_batch(): void
    {
        $receipt = GoodsReceipt::factory()->create();

        $this->assertStaffOnly('POST', "/api/admin/goods-receipts/{$receipt->id}/items/batch", ['items' => []]);
    }

    #[Test]
    public function a_receipt_batch_adds_new_lines_and_merges_repeats(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        [$a, $b, $c] = Product::factory()->count(3)->create()->all();
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create(['product_id' => $a->id, 'quantity' => '2', 'unit_cost' => 10_000]);
        $earlier = GoodsReceipt::factory()->posted()->create();
        GoodsReceiptItem::factory()->for($earlier, 'goodsReceipt')->create(['product_id' => $c->id, 'unit_cost' => 50_000]);

        $lines = collect($this->postJson("/api/admin/goods-receipts/{$receipt->id}/items/batch", ['items' => [
            ['product_id' => $a->id, 'quantity' => 1],
            ['product_id' => $b->id, 'quantity' => '3'],
            ['product_id' => $b->id, 'quantity' => '2.5'],
            ['product_id' => $c->id],
        ]])->assertOk()->assertJsonCount(3, 'data')->json('data'))->keyBy('product_id');

        $this->assertSame('3.000', $lines[$a->id]['quantity']);
        $this->assertSame(10_000, $lines[$a->id]['unit_cost']);
        $this->assertSame('5.500', $lines[$b->id]['quantity']);
        $this->assertSame('1.000', $lines[$c->id]['quantity']);
        $this->assertSame(50_000, $lines[$c->id]['unit_cost']);
        $this->assertSame($c->id, $lines[$c->id]['product']['id']);
    }

    #[Test]
    public function a_write_off_batch_answers_with_what_is_available(): void
    {
        $this->actingAsManager();
        $writeOff = WriteOff::factory()->create();
        $product = Product::factory()->create();
        ProductStoreStock::factory()->create(['product_id' => $product->id, 'store_id' => $writeOff->store_id, 'stock' => 4]);

        $this->postJson("/api/admin/write-offs/{$writeOff->id}/items/batch", ['items' => [['product_id' => $product->id, 'quantity' => 2]]])
            ->assertOk()
            ->assertJsonPath('data.0.quantity', '2.000')
            ->assertJsonPath('data.0.available', 4);
    }

    #[Test]
    public function the_batch_is_validated(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        $product = Product::factory()->create();

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items/batch", ['items' => []])
            ->assertUnprocessable()->assertJsonValidationErrors('items');

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items/batch", [
            'items' => array_fill(0, 201, ['product_id' => $product->id]),
        ])->assertUnprocessable()->assertJsonValidationErrors('items');

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items/batch", ['items' => [
            ['product_id' => 999_999],
            ['product_id' => $product->id, 'quantity' => 0],
        ]])->assertUnprocessable()->assertJsonValidationErrors(['items.0.product_id', 'items.1.quantity']);

        $this->assertSame(0, $receipt->items()->count());
    }

    #[Test]
    public function an_overflowing_batch_saves_nothing(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        $full = GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create(['quantity' => '9999999.000']);
        $other = Product::factory()->create();

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items/batch", ['items' => [
            ['product_id' => $other->id, 'quantity' => 1],
            ['product_id' => $full->product_id, 'quantity' => 1],
        ]])->assertUnprocessable()->assertJsonValidationErrors('quantity');

        $this->assertSame(1, $receipt->items()->count());
        $this->assertSame('9999999.000', $full->fresh()->quantity);
    }

    #[Test]
    public function a_posted_document_takes_no_batch(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->posted()->create();

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items/batch", ['items' => [['product_id' => Product::factory()->create()->id]]])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Документ проведён — изменить нельзя.');

        $this->assertSame(0, $receipt->items()->count());
    }
}
```

- [ ] **Step 2: Запустить — тест падает**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/DocumentItemsBatchApiTest.php`
Expected: FAIL — 404/405 на `items/batch`.

- [ ] **Step 3: Запрос**

`app/Http/Requests/Admin/DocumentItemsBatchRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Пачка строк из «Подбора»: товар и количество (без количества — 1).
 * Себестоимость не принимается — строки приёмки получают SuggestedUnitCost.
 */
class DocumentItemsBatchRequest extends FormRequest
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
            'items' => ['required', 'array', 'min:1', 'max:200'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['nullable', 'numeric', 'decimal:0,3', 'gt:0', 'max:9999999.999'],
        ];
    }
}
```

- [ ] **Step 4: Методы `batch`**

`GoodsReceiptItemController` — импорт `use App\Http\Requests\Admin\DocumentItemsBatchRequest;`, метод после `store`:

```php
    /**
     * Все строки пачки — в одной транзакции; ответ — все строки документа.
     */
    public function batch(DocumentItemsBatchRequest $request, GoodsReceipt $goodsReceipt, DocumentLines $lines): JsonResponse
    {
        return $this->whileDraft($goodsReceipt, function (GoodsReceipt $locked) use ($request, $lines): JsonResponse {
            $lines->addMany($locked, $request->validated('items'));

            return $this->index($locked);
        });
    }
```

`WriteOffItemController` — импорт `use App\Http\Requests\Admin\DocumentItemsBatchRequest;`, метод после `store`:

```php
    /**
     * Все строки пачки — в одной транзакции; ответ — все строки документа
     * с `available`, как у `index`.
     */
    public function batch(DocumentItemsBatchRequest $request, WriteOff $writeOff, DocumentLines $lines): JsonResponse
    {
        return $this->whileDraft($writeOff, function (WriteOff $locked) use ($request, $lines): JsonResponse {
            $lines->addMany($locked, $request->validated('items'));

            return $this->index($locked);
        });
    }
```

- [ ] **Step 5: Маршруты**

В `routes/api.php` сразу после строки `Route::apiResource('goods-receipts.items', GoodsReceiptItemController::class)->except('show')->scoped();` добавить:

```php
        Route::post('goods-receipts/{goods_receipt}/items/batch', [GoodsReceiptItemController::class, 'batch']);
```

и сразу после `Route::apiResource('write-offs.items', WriteOffItemController::class)->except('show')->scoped();`:

```php
        Route::post('write-offs/{write_off}/items/batch', [WriteOffItemController::class, 'batch']);
```

Затем `php artisan route:clear`.

- [ ] **Step 6: Тесты зелёные**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/DocumentItemsBatchApiTest.php tests/Feature/Admin/GoodsReceiptItemApiTest.php tests/Feature/Admin/WriteOffItemApiTest.php`
Expected: PASS.

- [ ] **Step 7: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Requests/Admin/DocumentItemsBatchRequest.php app/Http/Controllers/Api/Admin/GoodsReceiptItemController.php app/Http/Controllers/Api/Admin/WriteOffItemController.php routes/api.php tests/Feature/Admin/DocumentItemsBatchApiTest.php
git commit -m "feat(api): add many document lines in one request"
```

---

### Task 5: Черновик пустым запросом (значения по умолчанию)

**Files:**
- Create: `app/Http/Controllers/Api/Admin/Concerns/DefaultsDocumentStore.php`
- Modify: `app/Http/Requests/Admin/GoodsReceiptRequest.php` (PHPDoc класса, `prepareForValidation`, `rules`)
- Modify: `app/Http/Requests/Admin/WriteOffRequest.php` (`rules`)
- Modify: `app/Http/Controllers/Api/Admin/GoodsReceiptController.php` (`store`)
- Modify: `app/Http/Controllers/Api/Admin/WriteOffController.php` (`store`)
- Test: `tests/Feature/Admin/GoodsReceiptApiTest.php`, `tests/Feature/Admin/WriteOffApiTest.php`

**Interfaces:**
- Consumes: `App\Services\Catalog\StoreResolver::resolve(?User $user, ?int $requestedId): ?Store` (есть).
- Produces: `POST /api/admin/goods-receipts` и `POST /api/admin/write-offs` принимают `{}`; `DefaultsDocumentStore::documentStoreId(?int $requested, User $user): int`.

- [ ] **Step 1: Написать падающие тесты приёмки**

В `tests/Feature/Admin/GoodsReceiptApiTest.php`: импорт `use Illuminate\Support\Carbon;`. **Удалить** тест `the_store_is_required_on_create` (правило изменилось по спеке — склад теперь подставляется) и добавить:

```php
    #[Test]
    public function an_empty_body_creates_a_draft_with_defaults(): void
    {
        Carbon::setTestNow('2026-09-25 10:32:00');
        $manager = $this->actingAsManager();
        Store::factory()->inactive()->create(['name' => 'А-закрыт', 'is_default' => true]);
        $default = Store::factory()->create(['name' => 'Я-основной', 'is_default' => true]);
        Store::factory()->create(['name' => 'Б-другой']);
        $usual = Supplier::factory()->create();
        GoodsReceipt::factory()->create(['user_id' => $manager->id, 'supplier_id' => $usual->id]);
        GoodsReceipt::factory()->create(['user_id' => $manager->id, 'supplier_id' => null]);
        GoodsReceipt::factory()->create(['supplier_id' => Supplier::factory()->create()->id]);

        $id = $this->postJson('/api/admin/goods-receipts', [])
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.store.id', $default->id)
            ->assertJsonPath('data.supplier.id', $usual->id)
            ->json('data.id');

        $receipt = GoodsReceipt::findOrFail($id);
        $this->assertSame($manager->id, $receipt->user_id);
        $this->assertSame('2026-09-25 10:32:00', $receipt->received_at->format('Y-m-d H:i:s'));
    }

    #[Test]
    public function an_explicit_store_and_no_supplier_are_kept(): void
    {
        $manager = $this->actingAsManager();
        Store::factory()->create(['is_default' => true]);
        $chosen = Store::factory()->create();
        GoodsReceipt::factory()->create(['user_id' => $manager->id, 'supplier_id' => Supplier::factory()->create()->id]);

        $this->postJson('/api/admin/goods-receipts', ['store_id' => $chosen->id, 'supplier_id' => null])
            ->assertCreated()
            ->assertJsonPath('data.store.id', $chosen->id)
            ->assertJsonPath('data.supplier', null);
    }

    #[Test]
    public function the_managers_preferred_store_comes_before_the_default(): void
    {
        $manager = $this->actingAsManager();
        Store::factory()->create(['is_default' => true]);
        $preferred = Store::factory()->create();
        $manager->update(['preferred_store_id' => $preferred->id]);

        $this->postJson('/api/admin/goods-receipts', [])
            ->assertCreated()
            ->assertJsonPath('data.store.id', $preferred->id);
    }

    #[Test]
    public function without_an_active_store_a_receipt_is_refused(): void
    {
        $this->actingAsManager();
        Store::factory()->inactive()->create();

        $this->postJson('/api/admin/goods-receipts', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['store_id' => 'Нет активного места хранения.']);
    }
```

- [ ] **Step 2: Написать падающие тесты списания**

В `tests/Feature/Admin/WriteOffApiTest.php` **заменить** тест `store_and_a_known_reason_are_required` на:

```php
    #[Test]
    public function an_unknown_reason_is_refused(): void
    {
        $this->actingAsManager();
        Store::factory()->create();

        $this->postJson('/api/admin/write-offs', ['reason' => 'stolen'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason')
            ->assertJsonMissingValidationErrors('store_id');
    }

    #[Test]
    public function an_empty_body_creates_a_damaged_goods_draft_at_the_default_store(): void
    {
        $manager = $this->actingAsManager();
        Store::factory()->create(['name' => 'Б-другой']);
        $default = Store::factory()->create(['name' => 'Я-основной', 'is_default' => true]);

        $id = $this->postJson('/api/admin/write-offs', [])
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.reason', 'damaged')
            ->assertJsonPath('data.store.id', $default->id)
            ->json('data.id');

        $this->assertDatabaseHas('write_offs', ['id' => $id, 'user_id' => $manager->id]);
    }

    #[Test]
    public function without_an_active_store_a_write_off_is_refused(): void
    {
        $this->actingAsManager();

        $this->postJson('/api/admin/write-offs', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['store_id' => 'Нет активного места хранения.']);
    }
```

- [ ] **Step 3: Запустить — тесты падают**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/GoodsReceiptApiTest.php tests/Feature/Admin/WriteOffApiTest.php`
Expected: FAIL — 422 `store_id` required / `reason` required.

- [ ] **Step 4: Трейт склада по умолчанию**

`app/Http/Controllers/Api/Admin/Concerns/DefaultsDocumentStore.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin\Concerns;

use App\Models\User;
use App\Services\Catalog\StoreResolver;
use Illuminate\Validation\ValidationException;

/**
 * Склад нового документа: переданный, иначе предпочтительный склад
 * менеджера → склад по умолчанию → первый активный по названию
 * ({@see StoreResolver}).
 */
trait DefaultsDocumentStore
{
    protected function documentStoreId(?int $requested, User $user): int
    {
        if ($requested !== null) {
            return $requested;
        }

        return app(StoreResolver::class)->resolve($user, null)?->id
            ?? throw ValidationException::withMessages(['store_id' => 'Нет активного места хранения.']);
    }
}
```

- [ ] **Step 5: Запросы**

`app/Http/Requests/Admin/GoodsReceiptRequest.php`:
- PHPDoc класса: `Receipt header only; status and posted_at are set by posting. On create every field is optional — GoodsReceiptController::store fills the store, date, supplier and author.`
- В `prepareForValidation` список полей: `['store_id', 'supplier_id', 'number', 'received_at', 'note']`.
- В `rules()` строка склада: `'store_id' => [$this->isMethod('POST') ? 'nullable' : 'sometimes', 'integer', 'exists:stores,id'],`

`app/Http/Requests/Admin/WriteOffRequest.php`, `rules()`:

```php
        $optional = $this->isMethod('POST') ? 'nullable' : 'sometimes';

        return [
            // POST без склада и причины — WriteOffController::store подставит.
            'store_id' => [$optional, 'integer', 'exists:stores,id'],
            'reason' => [$optional, Rule::in(WriteOff::REASONS)],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
```

(переменная `$required` в этом методе больше не нужна — удалить).

- [ ] **Step 6: `store` в контроллерах документов**

`GoodsReceiptController` — импорт `use App\Http\Controllers\Api\Admin\Concerns\DefaultsDocumentStore;`, `use App\Models\User;`, в классе `use DefaultsDocumentStore;` (рядом с уже подключёнными трейтами), `store` заменить на:

```php
    /**
     * Черновик создаётся и пустым запросом: склад — {@see DefaultsDocumentStore},
     * дата — сейчас, поставщик — из последней приёмки этого менеджера, где он
     * был указан (если ключа `supplier_id` в запросе нет вовсе), автор — менеджер.
     */
    public function store(GoodsReceiptRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validated();

        $data['store_id'] = $this->documentStoreId(isset($data['store_id']) ? (int) $data['store_id'] : null, $user);
        $data['received_at'] ??= now();

        if (! array_key_exists('supplier_id', $data)) {
            $data['supplier_id'] = GoodsReceipt::query()
                ->where('user_id', $user->id)
                ->whereNotNull('supplier_id')
                ->latest('id')
                ->value('supplier_id');
        }

        $receipt = GoodsReceipt::create([...$data, 'status' => GoodsReceipt::STATUS_DRAFT, 'user_id' => $user->id]);

        return response()->json(['data' => $this->present($receipt)], 201);
    }
```

`WriteOffController` — те же импорты и `use DefaultsDocumentStore;`, `store` заменить на:

```php
    /**
     * Черновик создаётся и пустым запросом: склад — {@see DefaultsDocumentStore},
     * причина — «Повреждён» (`damaged`), автор — менеджер.
     */
    public function store(WriteOffRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validated();

        $data['store_id'] = $this->documentStoreId(isset($data['store_id']) ? (int) $data['store_id'] : null, $user);
        $data['reason'] ??= 'damaged';

        $writeOff = WriteOff::create([...$data, 'status' => WriteOff::STATUS_DRAFT, 'user_id' => $user->id]);

        return response()->json(['data' => $this->present($writeOff)], 201);
    }
```

- [ ] **Step 7: Тесты зелёные**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/GoodsReceiptApiTest.php tests/Feature/Admin/WriteOffApiTest.php tests/Feature/Admin/GoodsReceiptAdminTest.php`
Expected: PASS (включая `posting_receives_the_stock_and_freezes_the_document` — у фабричного черновика `user_id = null`, автором становится проводящий, как раньше).

- [ ] **Step 8: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Controllers/Api/Admin/Concerns/DefaultsDocumentStore.php app/Http/Requests/Admin/GoodsReceiptRequest.php app/Http/Requests/Admin/WriteOffRequest.php app/Http/Controllers/Api/Admin/GoodsReceiptController.php app/Http/Controllers/Api/Admin/WriteOffController.php tests/Feature/Admin/GoodsReceiptApiTest.php tests/Feature/Admin/WriteOffApiTest.php
git commit -m "feat(api): create a receipt or write-off draft from an empty request"
```

---

### Task 6: Список для выбора товаров (`GET /admin/product-picker`)

**Files:**
- Create: `app/Services/Inventory/ProductPicker.php`
- Create: `app/Http/Controllers/Api/Admin/ProductPickerController.php`
- Modify: `routes/api.php` (импорт контроллера; маршрут рядом с `stock/products`)
- Test: `tests/Feature/Admin/ProductPickerApiTest.php`

**Interfaces:**
- Consumes: `ProductSearch::apply(Builder, string): void` (Task 1), `SuggestedUnitCost::forMany(list<int>, int): array<int,int>` (Task 2), `CategoryTree::subtreeIds(string $idOrSlug): list<int>` (есть).
- Produces: `GET /api/admin/product-picker?store_id=&filter[search]=&filter[category_id]=&filter[recent]=1&filter[in_stock]=1&page=` → пагинатор Laravel (`data`, `current_page`, `last_page`, `per_page` = 30, `total`, …); строка `data[]`: `{ id: int, name: {ru, kk?}, code: ?string, article: ?string, uom: ?string, on_hand: float, suggested_unit_cost: int }`. `ProductPicker::list(int $storeId, array $filters): LengthAwarePaginator`.

- [ ] **Step 1: Написать падающий тест**

`tests/Feature/Admin/ProductPickerApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Category;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ProductPickerApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        $this->store = Store::factory()->create();
    }

    /**
     * @return list<int>
     */
    private function ids(string $query = ''): array
    {
        return collect($this->getJson("/api/admin/product-picker?store_id={$this->store->id}{$query}")->assertOk()->json('data'))
            ->pluck('id')
            ->all();
    }

    private function product(string $name, array $attributes = []): Product
    {
        return Product::factory()->create(['name' => ['ru' => $name], ...$attributes]);
    }

    private function receivedAt(Product $product, Store $store, string $receivedAt): void
    {
        $receipt = GoodsReceipt::factory()->for($store, 'store')->create(['received_at' => $receivedAt]);
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create(['product_id' => $product->id]);
    }

    #[Test]
    public function only_staff_may_pick_products(): void
    {
        $this->assertStaffOnly('GET', "/api/admin/product-picker?store_id={$this->store->id}");
    }

    #[Test]
    public function the_store_is_required(): void
    {
        $this->actingAsManager();

        $this->getJson('/api/admin/product-picker')->assertUnprocessable()->assertJsonValidationErrors('store_id');
    }

    #[Test]
    public function rows_carry_the_documents_store_stock_and_skip_composites(): void
    {
        $this->actingAsManager();
        $other = Store::factory()->create();
        $sofa = $this->product('Диван', ['code' => 'S-1', 'article' => 'A-1', 'uom' => 'шт']);
        $table = $this->product('Стол');
        $kit = $this->product('Гарнитур');
        DB::table('products')->where('id', $kit->id)->update(['is_composite' => true]);
        ProductStoreStock::factory()->create(['product_id' => $sofa->id, 'store_id' => $this->store->id, 'stock' => 5, 'avg_cost' => 70_000]);
        ProductStoreStock::factory()->create(['product_id' => $sofa->id, 'store_id' => $other->id, 'stock' => 7]);

        $response = $this->getJson("/api/admin/product-picker?store_id={$this->store->id}")
            ->assertOk()
            ->assertJsonPath('per_page', 30)
            ->assertJsonPath('total', 2);

        $this->assertSame([$sofa->id, $table->id], collect($response->json('data'))->pluck('id')->all());
        $response->assertJsonPath('data.0.name.ru', 'Диван')
            ->assertJsonPath('data.0.code', 'S-1')
            ->assertJsonPath('data.0.article', 'A-1')
            ->assertJsonPath('data.0.uom', 'шт')
            ->assertJsonPath('data.0.on_hand', 5)
            ->assertJsonPath('data.0.suggested_unit_cost', 70_000)
            ->assertJsonPath('data.1.on_hand', 0)
            ->assertJsonPath('data.1.suggested_unit_cost', 0);
    }

    #[Test]
    public function search_ignores_letter_case(): void
    {
        $this->actingAsManager();
        $sofa = $this->product('Диван Осло');
        $this->product('Стол');

        $this->assertSame([$sofa->id], $this->ids('&filter[search]='.rawurlencode('диван')));
    }

    #[Test]
    public function a_category_includes_its_subcategories(): void
    {
        $this->actingAsManager();
        $furniture = Category::factory()->create();
        $sofas = Category::factory()->create(['parent_id' => $furniture->id]);
        $lamps = Category::factory()->create();
        $chair = $this->product('Кресло', ['category_id' => $furniture->id]);
        $sofa = $this->product('Диван', ['category_id' => $sofas->id]);
        $this->product('Лампа', ['category_id' => $lamps->id]);

        $this->assertSame([$sofa->id, $chair->id], $this->ids("&filter[category_id]={$furniture->id}"));
    }

    #[Test]
    public function recent_lists_products_received_at_this_store_newest_first(): void
    {
        $this->actingAsManager();
        $older = $this->product('А старый');
        $newer = $this->product('Б новый');
        $elsewhere = $this->product('В на другом складе');
        $this->product('Г не принимали');
        $this->receivedAt($older, $this->store, '2026-09-20 10:00:00');
        $this->receivedAt($newer, $this->store, '2026-09-24 10:00:00');
        $this->receivedAt($elsewhere, Store::factory()->create(), '2026-09-25 10:00:00');

        $this->assertSame([$newer->id, $older->id], $this->ids('&filter[recent]=1'));
    }

    #[Test]
    public function in_stock_keeps_only_what_is_on_hand_at_the_store(): void
    {
        $this->actingAsManager();
        $sofa = $this->product('Диван');
        $table = $this->product('Стол');
        ProductStoreStock::factory()->create(['product_id' => $sofa->id, 'store_id' => $this->store->id, 'stock' => 2]);
        ProductStoreStock::factory()->create(['product_id' => $table->id, 'store_id' => $this->store->id, 'stock' => 0]);

        $this->assertSame([$sofa->id], $this->ids('&filter[in_stock]=1'));
    }

    #[Test]
    public function the_list_is_paged_by_thirty(): void
    {
        $this->actingAsManager();
        Product::factory()->count(31)->create();

        $this->getJson("/api/admin/product-picker?store_id={$this->store->id}&page=2")
            ->assertOk()
            ->assertJsonPath('total', 31)
            ->assertJsonPath('last_page', 2)
            ->assertJsonCount(1, 'data');
    }
}
```

- [ ] **Step 2: Запустить — тест падает**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/ProductPickerApiTest.php`
Expected: FAIL — 404 на `/api/admin/product-picker`.

- [ ] **Step 3: Сервис `ProductPicker`**

`app/Services/Inventory/ProductPicker.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Models\Product;
use App\Services\Catalog\CategoryTree;
use App\Support\ProductSearch;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\DB;

/**
 * Товары для строки поиска и «Подбора» в приёмке и списании: остаток на
 * складе документа и себестоимость, которую получит новая строка.
 */
class ProductPicker
{
    public const PER_PAGE = 30;

    public function __construct(
        private readonly CategoryTree $categories,
        private readonly SuggestedUnitCost $costs,
    ) {}

    /**
     * @param  array{search?: ?string, category_id?: ?int, recent?: bool, in_stock?: bool}  $filters
     */
    public function list(int $storeId, array $filters): LengthAwarePaginator
    {
        $onHand = 'COALESCE(store_stock.stock, 0)';

        $query = DB::table('products')
            ->leftJoin('product_store_stock as store_stock', function (JoinClause $join) use ($storeId): void {
                $join->on('store_stock.product_id', '=', 'products.id')
                    ->where('store_stock.store_id', '=', $storeId);
            })
            ->where('products.is_composite', false)
            ->select('products.id', 'products.name->ru as name_ru')
            ->selectRaw("{$onHand} as on_hand")
            ->when($filters['search'] ?? null, fn (Builder $query, string $search) => ProductSearch::apply($query, $search))
            ->when($filters['category_id'] ?? null, fn (Builder $query, int $categoryId) => $query->whereIn(
                'products.category_id',
                $this->categories->subtreeIds((string) $categoryId),
            ))
            ->when($filters['in_stock'] ?? false, fn (Builder $query) => $query->whereRaw("{$onHand} > 0"));

        if ($filters['recent'] ?? false) {
            $recent = DB::table('goods_receipt_items')
                ->join('goods_receipts', 'goods_receipts.id', '=', 'goods_receipt_items.goods_receipt_id')
                ->where('goods_receipts.store_id', $storeId)
                ->groupBy('goods_receipt_items.product_id')
                ->select('goods_receipt_items.product_id')
                ->selectRaw('MAX(goods_receipts.received_at) as last_received_at')
                ->selectRaw('MAX(goods_receipts.id) as last_receipt_id');

            $query->joinSub($recent, 'recent', 'recent.product_id', '=', 'products.id')
                ->orderByDesc('recent.last_received_at')
                ->orderByDesc('recent.last_receipt_id');
        } else {
            $query->orderBy('name_ru');
        }

        $page = $query->orderBy('products.id')->paginate(self::PER_PAGE);

        $this->present($page, $storeId);

        return $page;
    }

    /**
     * Заменяет строки страницы на ответ API.
     */
    private function present(LengthAwarePaginator $page, int $storeId): void
    {
        $ids = collect($page->items())->map(fn (object $row): int => (int) $row->id)->all();

        $products = Product::query()->whereIn('id', $ids)->get(['id', 'name', 'code', 'article', 'uom'])->keyBy('id');
        $costs = $this->costs->forMany($ids, $storeId);

        $page->through(function (object $row) use ($products, $costs): array {
            $product = $products[(int) $row->id];

            return [
                'id' => $product->id,
                'name' => $product->getTranslations('name'),
                'code' => $product->code,
                'article' => $product->article,
                'uom' => $product->uom,
                'on_hand' => (float) $row->on_hand,
                'suggested_unit_cost' => $costs[$product->id],
            ];
        });
    }
}
```

- [ ] **Step 4: Контроллер**

`app/Http/Controllers/Api/Admin/ProductPickerController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\Inventory\ProductPicker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductPickerController extends Controller
{
    /**
     * Товары для строки поиска и «Подбора» документа склада.
     *
     * `store_id` (обязателен) — склад документа; filter[search] (название
     * ru/kk, код, артикул, без регистра), filter[category_id] (с
     * подкатегориями), filter[recent]=1 (принимали на этот склад, новые
     * первыми), filter[in_stock]=1 (остаток на складе > 0). По 30.
     */
    public function index(Request $request, ProductPicker $picker): JsonResponse
    {
        $validated = $request->validate([
            'store_id' => ['required', 'integer', 'exists:stores,id'],
            'filter.search' => ['nullable', 'string', 'max:255'],
            'filter.category_id' => ['nullable', 'integer'],
            'filter.recent' => ['nullable', 'boolean'],
            'filter.in_stock' => ['nullable', 'boolean'],
        ]);

        $filter = $validated['filter'] ?? [];

        $page = $picker->list((int) $validated['store_id'], [
            'search' => $filter['search'] ?? null,
            'category_id' => isset($filter['category_id']) ? (int) $filter['category_id'] : null,
            'recent' => filter_var($filter['recent'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'in_stock' => filter_var($filter['in_stock'] ?? false, FILTER_VALIDATE_BOOLEAN),
        ]);

        return response()->json($page->appends($request->query())->toArray());
    }
}
```

- [ ] **Step 5: Маршрут**

В `routes/api.php`: импорт `use App\Http\Controllers\Api\Admin\ProductPickerController;` (по алфавиту, после `ProductPriceController`), и сразу после `Route::get('stock/summary', [StockController::class, 'summary']);`:

```php
        Route::get('product-picker', [ProductPickerController::class, 'index']);
```

Затем `php artisan route:clear`.

- [ ] **Step 6: Тесты зелёные**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/ProductPickerApiTest.php`
Expected: PASS (8 тестов). `on_hand` сравнивается с целым `5`, как `available` в `WriteOffItemApiTest` (там тоже `(float)` и ожидание `4`); строка `"5.000"` в ответе значит, что приведение `(float)` в `present()` потеряно.

- [ ] **Step 7: Проверка на MySQL (dev-база)**

```bash
docker exec paradisekz-app-1 php artisan tinker --execute '$s = App\Models\Store::query()->where("is_active", true)->value("id"); $p = app(App\Services\Inventory\ProductPicker::class)->list($s, ["search" => "диван", "recent" => false]); echo $p->total(), " ", json_encode($p->items()[0] ?? null, JSON_UNESCAPED_UNICODE);'
```

Expected: `total` > 0, первая строка с `name.ru`, содержащим «Диван», и числовым `on_hand`.

- [ ] **Step 8: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Services/Inventory/ProductPicker.php app/Http/Controllers/Api/Admin/ProductPickerController.php routes/api.php tests/Feature/Admin/ProductPickerApiTest.php
git commit -m "feat(api): product picker with store stock, categories and recent products"
```

---

### Task 7: Черновики первыми в списках документов

**Files:**
- Modify: `app/Http/Controllers/Api/Admin/GoodsReceiptController.php` (`index`)
- Modify: `app/Http/Controllers/Api/Admin/WriteOffController.php` (`index`)
- Test: `tests/Feature/Admin/GoodsReceiptApiTest.php`, `tests/Feature/Admin/WriteOffApiTest.php`

**Interfaces:**
- Produces: `GET /admin/goods-receipts` — черновики, затем проведённые; внутри — `received_at` по убыванию, затем `id` по убыванию. `GET /admin/write-offs` — черновики, затем `id` по убыванию.

- [ ] **Step 1: Написать падающие тесты**

В `GoodsReceiptApiTest`:

```php
    #[Test]
    public function drafts_come_first_then_the_newest(): void
    {
        $this->actingAsManager();
        $postedNew = GoodsReceipt::factory()->posted()->create(['received_at' => '2026-09-25 10:00:00']);
        $draftOld = GoodsReceipt::factory()->create(['received_at' => '2026-09-01 10:00:00']);
        $draftNew = GoodsReceipt::factory()->create(['received_at' => '2026-09-20 10:00:00']);
        $postedOld = GoodsReceipt::factory()->posted()->create(['received_at' => '2026-09-02 10:00:00']);

        $this->assertSame(
            [$draftNew->id, $draftOld->id, $postedNew->id, $postedOld->id],
            collect($this->getJson('/api/admin/goods-receipts')->assertOk()->json('data'))->pluck('id')->all(),
        );
    }
```

В `WriteOffApiTest`:

```php
    #[Test]
    public function draft_write_offs_come_first(): void
    {
        $this->actingAsManager();
        $draftOld = WriteOff::factory()->create();
        $posted = WriteOff::factory()->posted()->create();
        $draftNew = WriteOff::factory()->create();

        $this->assertSame(
            [$draftNew->id, $draftOld->id, $posted->id],
            collect($this->getJson('/api/admin/write-offs')->assertOk()->json('data'))->pluck('id')->all(),
        );
    }
```

- [ ] **Step 2: Запустить — тесты падают**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact --filter='drafts_come_first_then_the_newest|draft_write_offs_come_first'`
Expected: FAIL — порядок по `id` по убыванию.

- [ ] **Step 3: Сортировка**

`GoodsReceiptController@index` — заменить `->orderByDesc('id')` на:

```php
            // Черновики — незаконченная работа — сверху, затем по дате документа.
            ->orderByRaw("CASE WHEN status = 'draft' THEN 0 ELSE 1 END")
            ->orderByDesc('received_at')
            ->orderByDesc('id')
```

`WriteOffController@index` — заменить `->orderByDesc('id')` на:

```php
            // Черновики — незаконченная работа — сверху; у списания нет даты
            // документа, `id` растёт с созданием.
            ->orderByRaw("CASE WHEN status = 'draft' THEN 0 ELSE 1 END")
            ->orderByDesc('id')
```

- [ ] **Step 4: Тесты зелёные**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact tests/Feature/Admin/GoodsReceiptApiTest.php tests/Feature/Admin/WriteOffApiTest.php`
Expected: PASS.

- [ ] **Step 5: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Controllers/Api/Admin/GoodsReceiptController.php app/Http/Controllers/Api/Admin/WriteOffController.php tests/Feature/Admin/GoodsReceiptApiTest.php tests/Feature/Admin/WriteOffApiTest.php
git commit -m "feat(api): draft documents first in receipt and write-off lists"
```

---

### Task 8: Финальная проверка

- [ ] **Step 1: Весь сьют**

Run: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact`
Expected: PASS (прежнее число пропущенных/risky не выросло).

- [ ] **Step 2: Админка на dev не сломалась**

Текущие экраны `admin/` ещё шлют старые тела (`store_id` в создании, `quantity`+`unit_cost` в строке) — они остаются валидными. Проверить в браузере (dev-сервер :3002 уже запущен): «+ Принять товар» → модалка → создать; добавить позицию модалкой; в «Остатках» поиск `диван` строчными находит товар.

- [ ] **Step 3: Pint по всей ветке**

Run: `vendor/bin/pint --format agent $(git diff --name-only main -- '*.php')`
Expected: без изменений (каждая задача уже форматировала свои файлы). Если что-то поменялось — отдельный коммит `style: pint`.
