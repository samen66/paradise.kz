# Атрибуты на двух языках, характеристики в форме товара, фото вариантов — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Атрибут и его значение хранятся на ru и kk; характеристики товара заполняются прямо в форме (и у нового товара), атрибут, бренд и категория создаются из выпадающего списка «+ Создать»; у варианта — характеристики из того же справочника и фото из галереи товара; экран «Атрибуты» в новом виде; выбор B2B-клиента показывает список сразу.

**Architecture:** API: `attributes.name` и `attribute_values.value` становятся JSON `{ru, kk}` (`HasTranslations`, как у брендов). Сохранение товара и варианта синхронизирует набор характеристик через `AttributeValueSync`. Вариант получает таблицы `product_variant_attribute_values` и `product_variant_media` (отметка на фото товара). Публичный API отдаёт переводы на языке запроса, фасеты — `{value, label}` с ru-ключом. Админка: общий `AttributeRows` (строки «атрибут → значение») в форме товара и в окне варианта, шторки создания атрибута/бренда/категории, `SearchSelect` с «+ Создать», `EntityPicker` со списком по фокусу.

**Tech Stack:** Laravel 13, PHP 8.5, spatie/laravel-translatable 6.14, spatie/laravel-medialibrary, Spatie Query Builder, Filament 5 + lara-zeus/spatie-translatable, PHPUnit 12 (SQLite in-memory); Next.js 16, React 19, TypeScript, react-hook-form 7, zod 4, Tailwind 4; Playwright (Desktop + Mobile).

**Spec:** `docs/superpowers/specs/2026-09-25-bilingual-attributes-variant-photos-design.md`

## Global Constraints

- PHP-тесты — с хоста из корня репозитория: `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact <фильтр>` (без этих переменных рабочий `.env` роняет десятки тестов, см. память `test-env-gotchas`). Ниже этот префикс записан как `$T`, т. е. «`$T --filter=X`» = полная команда с переменными.
- Если правка маршрутов «не видна» тестам — `php artisan route:clear` (устаревший кэш маршрутов).
- После правки PHP — `vendor/bin/pint --dirty --format agent`.
- Фронтенд: в `admin/` — `npx tsc --noEmit && npm run lint && npm run build`; в `storefront/` и `b2b-portal/` — `npx tsc --noEmit && npm run build` (`next lint` в Next 16 нет). e2e админки — из `admin/`: `npx playwright test --project=Desktop <файл>` и `--project=Mobile <файл>`; перед тем как верить красному прогону — память `e2e-browser-tests`.
- `admin/AGENTS.md`: у Next 16 ломающие изменения — незнакомый API сверять с `admin/node_modules/next/dist/docs/`.
- Остатки не трогаем: ничего не пишет в `products.stock`, `product_store_stock`, `product_variants.stock`.
- Переводы: ru обязателен, kk необязателен. Пустой kk **не хранится** (`Translations::filled`), чтобы витрина откатывалась на ru, а не показывала пустую строку.
- Ключ фильтра витрины — ru-значение (`attribute_values.value->ru`); на экране — перевод.
- Интерфейс — на русском; тексты — как в спеке. Телефон: элементы ≥ 44 px (`min-h-11`), поля через `inputClass`.
- Коммиты — без `Co-Authored-By` и без «Generated with Claude Code».
- Ветка `feat/bilingual-attributes` от локального `main` в основном checkout (e2e ходят в dev-сервер :3002 этого checkout).

### Решения плана, уточняющие спеку

- **Ключ запроса — `attribute_values`, а не `attributes`.** У `products` есть устаревшая JSON-колонка `attributes` из ERP, а у `Illuminate\Http\Request` — свойство `$attributes`; одинаковое имя путало бы. Ответы товара и варианта тоже отдают `attribute_values`.
- **B2B-портал варианты не показывает** (его страница товара не использует `ProductInfo`; файл `b2b-portal/src/components/product/ProductInfo.tsx` не подключён). Переключение галереи по варианту делается только на витрине; в B2B-портале меняется только формат фасетов.
- **Старый `characteristics` варианта админка больше не пишет**: правило уходит из `ProductVariantRequest`, колонка остаётся данными.
- **Экран «Атрибуты» между задачами 1 и 10** показывает название через `ru()` (правка в задаче 7) — до редизайна он просто работает.
- **Esc и отправка во вложенной шторке.** Шторка атрибута открывается поверх окна варианта. Порталы не отменяют всплытие событий React по дереву компонентов: `submit` внутренней формы дошёл бы до внешней, а Esc закрыл бы обе. `CrudModal` гасит всплытие `submit`, `useOverlay` закрывает по Esc только верхний слой (задача 8).

## Review Focus

- **Очищенный kk.** Менеджер стёр казахский перевод значения или названия → в базе kk нет, витрина на kk показывает ru, а не пустую строку. Тесты — задачи 2 и 3.
- **Удалена последняя характеристика.** Форма товара — multipart, пустой массив в `FormData` не передать; без ключа сервер оставил бы всё как было. Форма шлёт `attribute_values=''`, сервер читает как `[]` и удаляет всё. Тест — задача 3.
- **Один атрибут дважды в строках.** Ошибка у строки, а не 500 от уникального индекса. Тест — задача 3 (`distinct`), на фронте — `superRefine` (задача 8).
- **Вариант из ERP** только со старым JSON `characteristics` → витрина по-прежнему показывает его характеристики. Тест — задача 5.
- **Вложенная шторка.** «+ Создать» атрибут внутри окна варианта: «Создать» не сохраняет вариант, Esc закрывает только шторку. e2e — задача 9.

---

### Task 1: Переводимые `attributes.name` и `attribute_values.value`, читатели этих колонок

**Files:**
- Create: `database/migrations/2026_09_25_000002_make_attribute_names_and_values_translatable.php`
- Modify: `app/Models/Attribute.php`, `app/Models/AttributeValue.php`
- Modify: `database/factories/AttributeFactory.php`, `database/factories/AttributeValueFactory.php`
- Modify: `app/Support/Translations.php`
- Modify: `app/Http/Controllers/Api/Admin/AttributeController.php` (`index`)
- Modify: `app/Http/Controllers/Api/Public/FacetController.php` (`attributeFacets`)
- Modify: `app/Http/Controllers/Api/Public/ProductController.php` (`attributeFilter`), `app/Http/Controllers/Api/ProductController.php` (`attributeFilter`)
- Modify: `app/Filament/Resources/Attributes/AttributeResource.php`, `.../Attributes/Pages/{CreateAttribute,EditAttribute,ListAttributes}.php`
- Modify: `app/Filament/Resources/Products/RelationManagers/AttributeValuesRelationManager.php`
- Create: `tests/Feature/Migrations/TranslatableAttributesMigrationTest.php`
- Modify: `tests/Feature/Admin/AttributeApiTest.php`, `tests/Feature/Public/FacetsTest.php`, `tests/Feature/Public/ProductFiltersTest.php`, `tests/Feature/Admin/AdminPagesRenderTest.php`

**Interfaces:**
- Produces: `Attribute` и `AttributeValue` с `HasTranslations` (`$translatable = ['name']` / `['value']`); `Translations::filled(array $translations): array` (убирает пустые локали); `Translations::pick(?string $json, string $locale): string` (перевод из сырой JSON-строки с откатом на ru); фасеты `values: list<array{value: string, label: string}>`.

- [ ] **Step 1: Ветка**

```bash
git checkout -b feat/bilingual-attributes
```

- [ ] **Step 2: Тест миграции (падает — миграции нет)**

`tests/Feature/Migrations/TranslatableAttributesMigrationTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Migrations;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class TranslatableAttributesMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function migration(): object
    {
        return require database_path('migrations/2026_09_25_000002_make_attribute_names_and_values_translatable.php');
    }

    #[Test]
    public function plain_names_and_values_become_the_ru_translation(): void
    {
        $migration = $this->migration();
        $migration->down();

        $product = Product::factory()->create();
        $attributeId = DB::table('attributes')->insertGetId(['name' => 'Цвет', 'slug' => 'color', 'is_filterable' => true]);
        DB::table('attribute_values')->insert(['product_id' => $product->id, 'attribute_id' => $attributeId, 'value' => 'Серый']);

        $migration->up();

        $this->assertSame(['ru' => 'Цвет'], json_decode((string) DB::table('attributes')->value('name'), true));
        $this->assertSame(['ru' => 'Серый'], json_decode((string) DB::table('attribute_values')->value('value'), true));
    }

    #[Test]
    public function down_keeps_the_ru_text(): void
    {
        $product = Product::factory()->create();
        $attributeId = DB::table('attributes')->insertGetId([
            'name' => json_encode(['ru' => 'Цвет', 'kk' => 'Түсі'], JSON_UNESCAPED_UNICODE),
            'slug' => 'color',
            'is_filterable' => false,
        ]);
        DB::table('attribute_values')->insert([
            'product_id' => $product->id,
            'attribute_id' => $attributeId,
            'value' => json_encode(['ru' => 'Серый', 'kk' => 'Сұр'], JSON_UNESCAPED_UNICODE),
        ]);

        $this->migration()->down();

        $this->assertSame('Цвет', DB::table('attributes')->value('name'));
        $this->assertSame('Серый', DB::table('attribute_values')->value('value'));

        $this->migration()->up();
    }
}
```

Run: `$T --filter=TranslatableAttributesMigrationTest`
Expected: FAIL — файла миграции нет.

- [ ] **Step 3: Миграция**

`database/migrations/2026_09_25_000002_make_attribute_names_and_values_translatable.php`:

```php
<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * attributes.name and attribute_values.value become {ru, kk} JSON, like
 * brands.name. The existing text becomes the ru translation.
 *
 * varchar → text first: `{"ru":"…"}` is longer than the plain string, and
 * MySQL refuses to turn non-JSON text into a json column — so the data is
 * rewritten while the column is plain text, then the type is changed.
 */
return new class extends Migration
{
    /** @var array<string, string> table => column */
    private const COLUMNS = ['attributes' => 'name', 'attribute_values' => 'value'];

    public function up(): void
    {
        foreach (self::COLUMNS as $table => $column) {
            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->text($column)->change());

            DB::table($table)->lazyById()->each(function (object $row) use ($table, $column): void {
                DB::table($table)->where('id', $row->id)->update([
                    $column => json_encode(['ru' => (string) $row->{$column}], JSON_UNESCAPED_UNICODE),
                ]);
            });

            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->json($column)->change());
        }
    }

    public function down(): void
    {
        foreach (self::COLUMNS as $table => $column) {
            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->text($column)->change());

            DB::table($table)->lazyById()->each(function (object $row) use ($table, $column): void {
                $translations = json_decode((string) $row->{$column}, true);
                $text = is_array($translations) ? (string) ($translations['ru'] ?? '') : (string) $row->{$column};

                DB::table($table)->where('id', $row->id)->update([$column => mb_substr($text, 0, 255)]);
            });

            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->string($column)->change());
        }
    }
};
```

- [ ] **Step 4: Модели и фабрики**

`app/Models/Attribute.php` — добавить импорт `use Spatie\Translatable\HasTranslations;`, трейт и список полей (обновить и докблок класса: «name is {ru, kk}»):

```php
    /** @use HasFactory<AttributeFactory> */
    use HasFactory;

    use HasTranslations;

    /** @var list<string> */
    public array $translatable = ['name'];
```

`app/Models/AttributeValue.php` — то же с `public array $translatable = ['value'];`.

`database/factories/AttributeFactory.php`: `'name' => ['ru' => $name],` (slug по-прежнему из `$name`).
`database/factories/AttributeValueFactory.php`: `'value' => ['ru' => fake()->word()],`.

Строка в `create(['name' => 'Цвет'])` у переводимой модели записывается в текущую локаль (ru) — старые тесты с такими вызовами продолжают работать.

- [ ] **Step 5: Помощники переводов**

`app/Support/Translations.php` — поправить докблок класса на «Helpers for spatie/laravel-translatable JSON columns» (текущий текст про ERP-синк перенести в докблок `mergeRu`) и добавить:

```php
    /**
     * Drops blank locales, so a cleared kk is not stored as "" and the
     * storefront falls back to ru instead of showing an empty string.
     *
     * @param  array<string, string|null>  $translations
     * @return array<string, string>
     */
    public static function filled(array $translations): array
    {
        return array_filter(
            array_map(fn (?string $text): string => trim((string) $text), $translations),
            fn (string $text): bool => $text !== '',
        );
    }

    /**
     * The $locale text of a raw translations JSON string (a column read past
     * Eloquent), falling back to ru when that locale is missing or blank.
     */
    public static function pick(?string $json, string $locale): string
    {
        $translations = json_decode((string) $json, true);

        if (! is_array($translations)) {
            return (string) $json;
        }

        $text = trim((string) ($translations[$locale] ?? ''));

        return $text !== '' ? $text : (string) ($translations['ru'] ?? '');
    }
```

- [ ] **Step 6: Прогнать тест миграции**

Run: `$T --filter=TranslatableAttributesMigrationTest`
Expected: PASS (2 теста).

- [ ] **Step 7: Тесты читателей — обновить и добавить (падают)**

`tests/Feature/Admin/AttributeApiTest.php`: пути `data.0.name` / `data.1.name` → `data.0.name.ru` / `data.1.name.ru`; в `it_creates_updates_and_deletes_an_attribute` — `->assertJsonPath('data.name.ru', 'Цвет обивки')`. (Запросы пока шлют `name` строкой — это меняет задача 2.)

`tests/Feature/Public/FacetsTest.php`: в первом тесте

```php
        $this->assertEqualsCanonicalizing(
            [['value' => 'красный', 'label' => 'красный'], ['value' => 'синий', 'label' => 'синий']],
            $response->json('attributes.0.values'),
        );
```

в `facets_are_scoped_to_the_requested_category_subtree`:
`$this->assertSame([['value' => 'красный', 'label' => 'красный']], $response->json('attributes.0.values'));`

и новый тест:

```php
    #[Test]
    public function facet_labels_follow_the_locale_and_keep_the_ru_key(): void
    {
        $color = Attribute::factory()->create(['name' => ['ru' => 'Цвет', 'kk' => 'Түсі'], 'slug' => 'color', 'is_filterable' => true]);
        $grey = Product::factory()->create();
        $white = Product::factory()->create();
        AttributeValue::factory()->create(['product_id' => $grey->id, 'attribute_id' => $color->id, 'value' => ['ru' => 'Серый', 'kk' => 'Сұр']]);
        // kk не заполнен — подпись откатывается на ru.
        AttributeValue::factory()->create(['product_id' => $white->id, 'attribute_id' => $color->id, 'value' => ['ru' => 'Белый']]);

        $response = $this->getJson('/api/public/facets?locale=kk')->assertOk();

        $this->assertSame('Түсі', $response->json('attributes.0.name'));
        $this->assertEqualsCanonicalizing(
            [['value' => 'Серый', 'label' => 'Сұр'], ['value' => 'Белый', 'label' => 'Белый']],
            $response->json('attributes.0.values'),
        );
    }
```

`tests/Feature/Public/ProductFiltersTest.php` — новый тест рядом с тестами `filter[attr]` (взять тот же помощник `listedIds` и ту же подготовку товаров, что у соседних тестов файла):

```php
    #[Test]
    public function the_attribute_filter_matches_the_ru_key_in_any_locale(): void
    {
        $color = Attribute::factory()->filterable()->create(['slug' => 'color']);
        $grey = Product::factory()->create();
        AttributeValue::factory()->create(['product_id' => $grey->id, 'attribute_id' => $color->id, 'value' => ['ru' => 'Серый', 'kk' => 'Сұр']]);

        $this->assertSame([$grey->id], $this->listedIds('locale=kk&filter[attr][color]='.rawurlencode('Серый')));
        $this->assertSame([], $this->listedIds('locale=kk&filter[attr][color]='.rawurlencode('Сұр')));
    }
```

Если `listedIds` принимает строку запроса без `locale` — передать `locale` так же, как файл передаёт остальные параметры (прочитать помощник в начале файла).

Run: `$T --filter='AttributeApiTest|FacetsTest|ProductFiltersTest'`
Expected: FAIL — фасеты отдают сырой JSON, фильтр сравнивает JSON-строку, `index` сортирует по JSON.

- [ ] **Step 8: Читатели**

`app/Http/Controllers/Api/Admin/AttributeController.php` — `index`:

```php
    public function index(): JsonResponse
    {
        $attributes = Attribute::query()->get()
            ->sortBy(fn (Attribute $attribute): string => mb_strtolower($attribute->getTranslation('name', 'ru')))
            ->values();

        return response()->json(['data' => $attributes]);
    }
```

`app/Http/Controllers/Api/Public/FacetController.php` — `attributeFacets` (добавить `use App\Support\Translations;`):

```php
    /**
     * Values are keyed by their ru text — the key filter[attr] matches on,
     * the same in both languages — and labelled in the request's locale,
     * falling back to ru where kk is not filled in.
     *
     * @param  Builder<Product>  $productIds
     * @return list<array{name: string, slug: string, values: list<array{value: string, label: string}>}>
     */
    private function attributeFacets(Builder $productIds): array
    {
        $locale = app()->getLocale();

        $rows = DB::table('attribute_values')
            ->join('attributes', 'attributes.id', '=', 'attribute_values.attribute_id')
            ->where('attributes.is_filterable', true)
            ->whereIn('attribute_values.product_id', $productIds)
            ->distinct()
            ->get(['attributes.name', 'attributes.slug', 'attribute_values.value']);

        return $rows
            ->groupBy('slug')
            ->sortKeys()
            ->map(fn ($group): array => [
                'name' => Translations::pick($group->first()->name, $locale),
                'slug' => $group->first()->slug,
                'values' => $group
                    ->map(fn (object $row): array => [
                        'value' => Translations::pick($row->value, 'ru'),
                        'label' => Translations::pick($row->value, $locale),
                    ])
                    ->unique('value')
                    ->sortBy('label', SORT_NATURAL | SORT_FLAG_CASE)
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();
    }
```

`app/Http/Controllers/Api/Public/ProductController.php` и `app/Http/Controllers/Api/ProductController.php` — в `attributeFilter` заменить `->whereIn('attribute_values.value', $values)` на

```php
                    // The ru text is the filter key in both languages (see FacetController).
                    ->whereIn('attribute_values.value->ru', $values);
```

(Laravel разворачивает `->ru` в `json_unquote(json_extract(...))` на MySQL и `json_extract(...)` на SQLite.) Докблок `attributeFilter` в публичном контроллере дополнить: «values are the ru texts from the facets».

- [ ] **Step 9: Filament — переводимые формы атрибута**

По образцу `app/Filament/Resources/Brands`:
- `AttributeResource.php`: `use LaraZeus\SpatieTranslatable\Resources\Concerns\Translatable;` и `use Translatable;` в классе.
- `Pages/CreateAttribute.php`, `EditAttribute.php`, `ListAttributes.php`: трейт `LaraZeus\SpatieTranslatable\Resources\Pages\{CreateRecord|EditRecord|ListRecords}\Concerns\Translatable` и `LocaleSwitcher::make()` первым в `getHeaderActions()` (у Create — единственным), как в `CreateBrand` / `EditBrand` / `ListBrands`.
- `AttributeValuesRelationManager.php`: `use LaraZeus\SpatieTranslatable\Resources\RelationManagers\Concerns\Translatable;` + `use Translatable;`; в `Select::make('attribute_id')` после `->relationship('attribute', 'name')` добавить
  `->getOptionLabelFromRecordUsing(fn (Attribute $record): string => $record->getTranslation('name', 'ru'))`
  (иначе список покажет сырой JSON); в `headerActions` таблицы первым — `LocaleSwitcher::make()` (`LaraZeus\SpatieTranslatable\Actions\LocaleSwitcher`).

Тест отрисовки — `tests/Feature/Admin/AdminPagesRenderTest.php`, новый метод:

```php
    #[Test]
    public function the_attribute_pages_and_the_attribute_values_relation_manager_render(): void
    {
        $attribute = Attribute::factory()->create(['name' => ['ru' => 'Цвет', 'kk' => 'Түсі']]);
        $product = Product::factory()->create();
        AttributeValue::factory()->create(['product_id' => $product->id, 'attribute_id' => $attribute->id, 'value' => ['ru' => 'Серый']]);

        Livewire::test(ListAttributes::class)->assertOk()->assertSee('Цвет');
        Livewire::test(EditAttribute::class, ['record' => $attribute->getRouteKey()])->assertOk();
        Livewire::test(AttributeValuesRelationManager::class, [
            'ownerRecord' => $product,
            'pageClass' => EditProduct::class,
        ])->assertOk()->assertSee('Серый');
    }
```

(импорты: `App\Models\Attribute`, `App\Models\AttributeValue`, `App\Filament\Resources\Attributes\Pages\ListAttributes`, `...\EditAttribute`, `App\Filament\Resources\Products\RelationManagers\AttributeValuesRelationManager`.)

- [ ] **Step 10: Прогнать**

Run: `$T --filter='TranslatableAttributesMigrationTest|AttributeApiTest|AttributeValueApiTest|FacetsTest|ProductFiltersTest|AdminPagesRenderTest|CatalogApiTest'`
Expected: PASS. Если `AdminPagesRenderTest` падает на Filament-переводах — сверить с `vendor/lara-zeus/spatie-translatable/src/Resources/RelationManagers/Concerns/Translatable.php` и страницами брендов; не отключать тест.

- [ ] **Step 11: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add -A database/migrations app/Models app/Support app/Http app/Filament database/factories tests
git commit -m "feat(api): translatable attribute names and values, facets keyed by ru"
```

---

### Task 2: Необязательный slug, двуязычное название атрибута, счётчик использования

**Files:**
- Create: `app/Support/UniqueSlug.php`
- Modify: `app/Http/Requests/Admin/AttributeRequest.php`
- Modify: `app/Http/Controllers/Api/Admin/AttributeController.php`
- Modify: `app/Http/Controllers/Api/Admin/BrandController.php`, `app/Http/Controllers/Api/Admin/CategoryController.php` (`store`)
- Create: `tests/Feature/Admin/CatalogSlugTest.php`
- Modify: `tests/Feature/Admin/AttributeApiTest.php`

**Interfaces:**
- Consumes: `Translations::filled` (задача 1).
- Produces: `UniqueSlug::make(string $table, string $name, string $fallback): string`; `POST/PUT /admin/attributes` — `{name: {ru, kk?}, slug?, is_filterable?}`, ответ `data` с `values_count`; `GET /admin/attributes` — у каждого `values_count`; константа `AttributeController::COUNTS` (задача 4 добавит `variantValues`).

- [ ] **Step 1: Тесты (падают)**

`tests/Feature/Admin/CatalogSlugTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Attribute;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class CatalogSlugTest extends TestCase
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
    public function an_attribute_without_a_slug_gets_one_from_its_ru_name(): void
    {
        $this->postJson('/api/admin/attributes', ['name' => ['ru' => 'Размер', 'kk' => 'Өлшемі']])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'razmer')
            ->assertJsonPath('data.name.kk', 'Өлшемі');

        $this->postJson('/api/admin/attributes', ['name' => ['ru' => 'Размер']])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'razmer-2');
    }

    #[Test]
    public function a_name_with_nothing_to_transliterate_falls_back(): void
    {
        $this->postJson('/api/admin/attributes', ['name' => ['ru' => '!!!']])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'attribute');
    }

    #[Test]
    public function a_long_name_still_gets_a_slug_that_fits_the_column(): void
    {
        $slug = $this->postJson('/api/admin/attributes', ['name' => ['ru' => str_repeat('щ', 255)]])
            ->assertCreated()
            ->json('data.slug');

        $this->assertLessThanOrEqual(255, strlen($slug));
        $this->assertMatchesRegularExpression('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug);
    }

    #[Test]
    public function an_explicit_slug_is_still_validated(): void
    {
        Attribute::factory()->create(['slug' => 'color']);

        $this->postJson('/api/admin/attributes', ['name' => ['ru' => 'Цвет'], 'slug' => 'color'])
            ->assertUnprocessable()->assertJsonValidationErrors('slug');
        $this->postJson('/api/admin/attributes', ['name' => ['ru' => 'Цвет'], 'slug' => 'Цвет!'])
            ->assertUnprocessable()->assertJsonValidationErrors('slug');
    }

    #[Test]
    public function the_ru_name_is_required(): void
    {
        $this->postJson('/api/admin/attributes', ['name' => ['kk' => 'Түсі']])
            ->assertUnprocessable()->assertJsonValidationErrors('name.ru');
    }

    #[Test]
    public function an_update_without_a_slug_keeps_it_and_a_cleared_kk_is_dropped(): void
    {
        $attribute = Attribute::factory()->create(['name' => ['ru' => 'Цвет', 'kk' => 'Түсі'], 'slug' => 'color']);

        $this->putJson("/api/admin/attributes/{$attribute->id}", ['name' => ['ru' => 'Цвет корпуса', 'kk' => '']])
            ->assertOk()
            ->assertJsonPath('data.slug', 'color');

        $this->assertSame(['ru' => 'Цвет корпуса'], $attribute->refresh()->getTranslations('name'));
    }

    #[Test]
    public function brands_and_categories_get_a_slug_too(): void
    {
        $this->postJson('/api/admin/brands', ['name' => ['ru' => 'Икея']])
            ->assertCreated()->assertJsonPath('slug', 'ikeia');
        $this->postJson('/api/admin/categories', ['name' => ['ru' => 'Диваны']])
            ->assertCreated()->assertJsonPath('slug', 'divany');
    }

    #[Test]
    public function the_list_counts_how_many_products_use_an_attribute(): void
    {
        $used = Attribute::factory()->create(['name' => ['ru' => 'А']]);
        Attribute::factory()->create(['name' => ['ru' => 'Б']]);
        \App\Models\AttributeValue::factory()->count(2)->create(['attribute_id' => $used->id]);

        $this->getJson('/api/admin/attributes')
            ->assertOk()
            ->assertJsonPath('data.0.values_count', 2)
            ->assertJsonPath('data.1.values_count', 0);
    }
}
```

Транслитерация «Икея» зависит от `Str::slug` (ASCII-таблица voku). Если фактический slug другой (например, `ikeya`), поправить ожидание в тесте на фактический — проверяется, что slug есть и сделан из названия, а не конкретная таблица транслитерации.

В `tests/Feature/Admin/AttributeApiTest.php` все тела запросов с `'name' => 'Цвет'` / `'Цвет обивки'` / `'Материал'` перевести в `['ru' => …]`.

Run: `$T --filter='CatalogSlugTest|AttributeApiTest'`
Expected: FAIL.

- [ ] **Step 2: `UniqueSlug`**

`app/Support/UniqueSlug.php`:

```php
<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * A free `slug` for a new catalog row, made from its ru name: «Размер» →
 * razmer, then razmer-2, razmer-3… while taken. A name with nothing to
 * transliterate («!!!») gets $fallback. The base is capped so the suffix
 * still fits a varchar(255).
 */
final class UniqueSlug
{
    private const MAX_BASE = 240;

    public static function make(string $table, string $name, string $fallback): string
    {
        $base = trim(Str::limit(Str::slug($name), self::MAX_BASE, ''), '-');
        $base = $base === '' ? $fallback : $base;
        $slug = $base;

        for ($suffix = 2; DB::table($table)->where('slug', $slug)->exists(); $suffix++) {
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }
}
```

- [ ] **Step 3: Запрос и контроллер атрибута**

`app/Http/Requests/Admin/AttributeRequest.php` — `rules()`:

```php
        return [
            'name' => ['required', 'array'],
            'name.ru' => ['required', 'string', 'max:255'],
            'name.kk' => ['nullable', 'string', 'max:255'],
            // Blank on create: the controller makes one from name.ru. Blank on
            // update: the current slug stays.
            'slug' => [
                'nullable', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('attributes', 'slug')->ignore($this->route('attribute')),
            ],
            'is_filterable' => ['boolean'],
        ];
```

`app/Http/Controllers/Api/Admin/AttributeController.php` (импорты `App\Support\Translations`, `App\Support\UniqueSlug`):

```php
    /**
     * Usage counters every response carries, for the attributes screen.
     *
     * @var list<string>
     */
    private const COUNTS = ['values'];

    public function index(): JsonResponse
    {
        $attributes = Attribute::query()->withCount(self::COUNTS)->get()
            ->sortBy(fn (Attribute $attribute): string => mb_strtolower($attribute->getTranslation('name', 'ru')))
            ->values();

        return response()->json(['data' => $attributes]);
    }

    public function store(AttributeRequest $request): JsonResponse
    {
        $data = $request->validated();

        $attribute = new Attribute([
            'slug' => $data['slug'] ?? UniqueSlug::make('attributes', $data['name']['ru'], 'attribute'),
            'is_filterable' => $data['is_filterable'] ?? false,
        ]);
        $attribute->replaceTranslations('name', Translations::filled($data['name']));
        $attribute->save();

        return response()->json(['data' => $attribute->loadCount(self::COUNTS)], 201);
    }

    public function show(Attribute $attribute): JsonResponse
    {
        return response()->json(['data' => $attribute->loadCount(self::COUNTS)]);
    }

    public function update(AttributeRequest $request, Attribute $attribute): JsonResponse
    {
        $data = $request->validated();

        $attribute->replaceTranslations('name', Translations::filled($data['name']));

        if (($data['slug'] ?? null) !== null) {
            $attribute->slug = $data['slug'];
        }

        if (array_key_exists('is_filterable', $data)) {
            $attribute->is_filterable = $data['is_filterable'];
        }

        $attribute->save();

        return response()->json(['data' => $attribute->loadCount(self::COUNTS)]);
    }
```

- [ ] **Step 4: Бренд и категория**

`BrandController::store`: правило slug → `'slug' => 'nullable|string|max:255|unique:brands,slug',`, перед `Brand::create`:

```php
        $validated['slug'] ??= UniqueSlug::make('brands', $validated['name']['ru'], 'brand');
```

`CategoryController::store`: то же с `unique:categories,slug` и `UniqueSlug::make('categories', $validated['name']['ru'], 'category')`. `update` у обоих не меняется.

- [ ] **Step 5: Прогнать**

Run: `$T --filter='CatalogSlugTest|AttributeApiTest|CatalogAdminTest'`
Expected: PASS.

- [ ] **Step 6: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Support/UniqueSlug.php app/Http tests/Feature/Admin/CatalogSlugTest.php tests/Feature/Admin/AttributeApiTest.php
git commit -m "feat(api): optional slugs for attributes, brands and categories; bilingual attribute names"
```

---

### Task 3: Характеристики сохраняются вместе с товаром

**Files:**
- Create: `app/Services/Catalog/AttributeValueSync.php`
- Modify: `app/Http/Requests/Admin/ProductSaveRequest.php`
- Modify: `app/Http/Controllers/Api/Admin/ProductController.php` (`show`, `store`, `update`, `present`)
- Delete: `app/Http/Controllers/Api/Admin/AttributeValueController.php`, `app/Http/Requests/Admin/AttributeValueRequest.php`, маршрут `products.attribute-values` в `routes/api.php`, `tests/Feature/Admin/AttributeValueApiTest.php` (удаление эндпоинта согласовано в спеке; его проверки переезжают в новый тест)
- Create: `tests/Feature/Admin/ProductAttributeValuesTest.php`

**Interfaces:**
- Consumes: `Translations::filled`.
- Produces: `AttributeValueSync::sync(Product|ProductVariant $owner, array $rows): void` — `$rows`: `list<array{attribute_id: int|string, value: array<string, string|null>}>`; владелец должен иметь `attributeValues(): HasMany`. Товар в ответах `show/store/update` несёт `attribute_values: [{id, attribute_id, value: {ru, kk?}, attribute: {id, name: {ru, kk?}, slug}}]`. Запрос: `attribute_values` необязателен; `''` (multipart) = `[]`.

- [ ] **Step 1: Тесты (падают)**

`tests/Feature/Admin/ProductAttributeValuesTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Product;
use App\Services\Catalog\AttributeValueSync;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ProductAttributeValuesTest extends TestCase
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
    public function a_new_product_is_created_with_its_characteristics(): void
    {
        $size = Attribute::factory()->create(['name' => ['ru' => 'Размер', 'kk' => 'Өлшемі']]);

        $response = $this->postJson('/api/admin/products', [
            'name' => ['ru' => 'Кровать'],
            'attribute_values' => [
                ['attribute_id' => $size->id, 'value' => ['ru' => '200x90 см', 'kk' => '200x90 см']],
            ],
        ])->assertCreated();

        $response
            ->assertJsonPath('data.attribute_values.0.attribute_id', $size->id)
            ->assertJsonPath('data.attribute_values.0.value.ru', '200x90 см')
            ->assertJsonPath('data.attribute_values.0.attribute.name.kk', 'Өлшемі');
        $this->assertSame(1, AttributeValue::query()->where('product_id', $response->json('data.id'))->count());
    }

    #[Test]
    public function saving_makes_the_characteristics_exactly_the_given_set(): void
    {
        $product = Product::factory()->create();
        [$color, $size, $material] = Attribute::factory()->count(3)->create();
        AttributeValue::factory()->create(['product_id' => $product->id, 'attribute_id' => $color->id, 'value' => ['ru' => 'Серый']]);
        AttributeValue::factory()->create(['product_id' => $product->id, 'attribute_id' => $size->id, 'value' => ['ru' => '90']]);

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Кровать'],
            'attribute_values' => [
                ['attribute_id' => $size->id, 'value' => ['ru' => '120']],
                ['attribute_id' => $material->id, 'value' => ['ru' => 'Дуб', 'kk' => 'Емен']],
            ],
        ])->assertOk();

        $values = $product->attributeValues()->get()->keyBy('attribute_id');
        $this->assertFalse($values->has($color->id));
        $this->assertSame('120', $values[$size->id]->getTranslation('value', 'ru'));
        $this->assertSame(['ru' => 'Дуб', 'kk' => 'Емен'], $values[$material->id]->getTranslations('value'));
    }

    #[Test]
    public function without_the_key_the_characteristics_stay(): void
    {
        $product = Product::factory()->create();
        AttributeValue::factory()->create(['product_id' => $product->id]);

        $this->putJson("/api/admin/products/{$product->id}", ['name' => ['ru' => 'Кровать']])->assertOk();

        $this->assertSame(1, $product->attributeValues()->count());
    }

    #[Test]
    public function an_empty_multipart_field_removes_them_all(): void
    {
        $product = Product::factory()->create();
        AttributeValue::factory()->count(2)->create(['product_id' => $product->id]);

        // The admin form is multipart: an empty set travels as "".
        $this->post("/api/admin/products/{$product->id}", [
            '_method' => 'PUT',
            'name' => ['ru' => 'Кровать'],
            'attribute_values' => '',
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertSame(0, $product->attributeValues()->count());
    }

    #[Test]
    public function a_cleared_kk_is_dropped_so_ru_shows_instead(): void
    {
        $product = Product::factory()->create();
        $color = Attribute::factory()->create();
        AttributeValue::factory()->create(['product_id' => $product->id, 'attribute_id' => $color->id, 'value' => ['ru' => 'Серый', 'kk' => 'Сұр']]);

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Кровать'],
            'attribute_values' => [['attribute_id' => $color->id, 'value' => ['ru' => 'Серый', 'kk' => '']]],
        ])->assertOk();

        $this->assertSame(['ru' => 'Серый'], $product->attributeValues()->first()->getTranslations('value'));
    }

    #[Test]
    public function the_same_attribute_twice_is_a_row_error(): void
    {
        $product = Product::factory()->create();
        $color = Attribute::factory()->create();

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Кровать'],
            'attribute_values' => [
                ['attribute_id' => $color->id, 'value' => ['ru' => 'Серый']],
                ['attribute_id' => $color->id, 'value' => ['ru' => 'Белый']],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors('attribute_values.1.attribute_id');
    }

    #[Test]
    public function a_row_needs_an_existing_attribute_and_a_ru_value(): void
    {
        $product = Product::factory()->create();

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Кровать'],
            'attribute_values' => [['attribute_id' => 999_999, 'value' => ['kk' => 'Сұр']]],
        ])->assertUnprocessable()->assertJsonValidationErrors(['attribute_values.0.attribute_id', 'attribute_values.0.value.ru']);
    }

    #[Test]
    public function a_failed_sync_rolls_the_new_product_back(): void
    {
        $color = Attribute::factory()->create();
        $this->mock(AttributeValueSync::class)->shouldReceive('sync')->andThrow(new RuntimeException('boom'));

        $this->postJson('/api/admin/products', [
            'name' => ['ru' => 'Кровать'],
            'attribute_values' => [['attribute_id' => $color->id, 'value' => ['ru' => 'Серый']]],
        ])->assertServerError();

        $this->assertSame(0, Product::query()->count());
    }

    #[Test]
    public function the_product_card_lists_its_characteristics(): void
    {
        $product = Product::factory()->create();
        AttributeValue::factory()->create(['product_id' => $product->id, 'value' => ['ru' => 'Серый']]);

        $this->getJson("/api/admin/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.attribute_values.0.value.ru', 'Серый');
    }
}
```

Run: `$T --filter=ProductAttributeValuesTest`
Expected: FAIL.

- [ ] **Step 2: `AttributeValueSync`**

`app/Services/Catalog/AttributeValueSync.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Catalog;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\Translations;

/**
 * Makes an owner's characteristics exactly the given set: one row per
 * attribute, its value replaced (a cleared kk is dropped, not kept), rows of
 * attributes no longer listed deleted. Shared by products and variants —
 * both keep `attribute_id` + translatable `value` rows.
 *
 * The relation is re-created for every query: a HasMany instance keeps the
 * where() clauses of firstOrNew(), so reusing one would narrow every next
 * lookup to the previous attribute.
 */
final class AttributeValueSync
{
    /**
     * @param  list<array{attribute_id: int|string, value: array<string, string|null>}>  $rows
     */
    public function sync(Product|ProductVariant $owner, array $rows): void
    {
        $kept = [];

        foreach ($rows as $row) {
            $attributeId = (int) $row['attribute_id'];

            $value = $owner->attributeValues()->firstOrNew(['attribute_id' => $attributeId]);
            $value->replaceTranslations('value', Translations::filled($row['value']));
            $value->save();

            $kept[] = $attributeId;
        }

        $owner->attributeValues()->whereNotIn('attribute_id', $kept)->delete();
    }
}
```

`ProductVariant::attributeValues()` появится в задаче 4; до тех пор тип-хинт `ProductVariant` просто не используется.

- [ ] **Step 3: Запрос**

`app/Http/Requests/Admin/ProductSaveRequest.php`:
- в `prepareForValidation()`, после цикла `BLANK_MEANS_UNSET`:

```php
        // A multipart form cannot send an empty array: the admin sends "" for
        // "no characteristics", which ConvertEmptyStringsToNull has made null.
        if ($this->has('attribute_values') && $this->input('attribute_values') === null) {
            $normalised['attribute_values'] = [];
        }
```

(поставить до `if ($normalised !== [])`).
- в `rules()` после блока «Storefront flags»:

```php
            // Characteristics — the whole set, synced by AttributeValueSync.
            // Absent: left as they are; empty: all removed.
            'attribute_values' => 'sometimes|array',
            'attribute_values.*.attribute_id' => 'required|integer|distinct|exists:attributes,id',
            'attribute_values.*.value' => 'required|array',
            'attribute_values.*.value.ru' => 'required|string|max:255',
            'attribute_values.*.value.kk' => 'nullable|string|max:255',
```

- в докблок класса — абзац: «`attribute_values` is not a products column: the controller hands it to AttributeValueSync».

- [ ] **Step 4: Контроллер товара**

`app/Http/Controllers/Api/Admin/ProductController.php` (импорты `App\Services\Catalog\AttributeValueSync`, `Illuminate\Support\Arr`, `Illuminate\Support\Facades\DB`):

```php
    /** Relations every show/store/update response carries. */
    private const CARD_RELATIONS = ['category', 'brand', 'attributeValues.attribute:id,name,slug'];

    public function show(Product $product): JsonResponse
    {
        $product->load([...self::CARD_RELATIONS, 'externalMapping']);

        return response()->json(['data' => [
            ...$this->present($product),
            'images' => ProductMediaController::presentAll($product),
        ]]);
    }

    public function store(ProductSaveRequest $request, AttributeValueSync $sync): JsonResponse
    {
        $validated = $request->validated();

        $product = DB::transaction(function () use ($validated, $sync): Product {
            $product = Product::create(Arr::except($validated, 'attribute_values'));
            $this->syncAttributeValues($product, $validated, $sync);

            return $product;
        });

        return response()->json(['data' => $this->present($product->load(self::CARD_RELATIONS))], 201);
    }

    public function update(ProductSaveRequest $request, Product $product, AttributeValueSync $sync): JsonResponse
    {
        $validated = $request->validated();

        DB::transaction(function () use ($product, $validated, $sync): void {
            $product->update(Arr::except($validated, 'attribute_values'));
            $this->syncAttributeValues($product, $validated, $sync);
        });

        return response()->json(['data' => $this->present($product->load(self::CARD_RELATIONS))]);
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function syncAttributeValues(Product $product, array $validated, AttributeValueSync $sync): void
    {
        if (array_key_exists('attribute_values', $validated)) {
            $sync->sync($product, $validated['attribute_values']);
        }
    }
```

`present()` не меняется: загруженная связь `attributeValues` попадает в `toArray()` ключом `attribute_values`.

- [ ] **Step 5: Убрать старый эндпоинт**

- `routes/api.php`: удалить строку `Route::apiResource('products.attribute-values', AttributeValueController::class)->except('show')->scoped();` и импорт `AttributeValueController`.
- Удалить `app/Http/Controllers/Api/Admin/AttributeValueController.php`, `app/Http/Requests/Admin/AttributeValueRequest.php`, `tests/Feature/Admin/AttributeValueApiTest.php`.

```bash
php artisan route:clear
grep -rn "AttributeValueController\|AttributeValueRequest\|attribute-values" app routes tests
```

Expected: пусто.

- [ ] **Step 6: Прогнать**

Run: `$T --filter='ProductAttributeValuesTest|ProductCrudTest|ProductMinStockTest|ProductSearchTest'`
Expected: PASS.

- [ ] **Step 7: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add -A app routes tests
git commit -m "feat(api): product characteristics saved with the product as one set"
```

---

### Task 4: Характеристики и фото варианта

**Files:**
- Create: `database/migrations/2026_09_25_000003_create_product_variant_attribute_values_table.php`
- Create: `database/migrations/2026_09_25_000004_create_product_variant_media_table.php`
- Create: `app/Models/ProductVariantAttributeValue.php`, `database/factories/ProductVariantAttributeValueFactory.php`
- Modify: `app/Models/ProductVariant.php`, `app/Models/Attribute.php`
- Modify: `app/Http/Requests/Admin/ProductVariantRequest.php`
- Modify: `app/Http/Controllers/Api/Admin/ProductVariantController.php`
- Modify: `app/Http/Controllers/Api/Admin/AttributeController.php` (`COUNTS`, `destroy`)
- Modify: `tests/Feature/Admin/ProductVariantApiTest.php`, `tests/Feature/Admin/AttributeApiTest.php`

**Interfaces:**
- Consumes: `AttributeValueSync::sync` (задача 3), `ProductMediaController::present(Media): array{id, file_name, url, thumb_url, order}`.
- Produces: `ProductVariant::attributeValues(): HasMany<ProductVariantAttributeValue>`, `ProductVariant::images(): BelongsToMany<Media>` (по `sort_order`), `Attribute::variantValues(): HasMany`. Вариант в ответах `/admin/products/{p}/variants*`: `{id, name, code, retail_price, b2b_price, stock, barcodes, attribute_values: [...как у товара], images: [{id, file_name, url, thumb_url, order}]}`. Запрос: `attribute_values?`, `media_ids?: int[]`. Атрибут в `/admin/attributes` получает `variant_values_count`.

- [ ] **Step 1: Тесты (падают)**

`tests/Feature/Admin/ProductVariantApiTest.php`:
- в `setUp()` добавить `Storage::fake(config('media-library.disk_name'));` (импорт `Illuminate\Support\Facades\Storage`);
- в тесте создания варианта убрать `'characteristics' => ['Цвет' => 'Серый']` из тела и проверку `$variant->characteristics`;
- добавить помощник и тесты:

```php
    private function photo(Product $product, string $name = 'a.jpg'): Media
    {
        return $product->addMedia(UploadedFile::fake()->image($name))->toMediaCollection(Product::IMAGE_COLLECTION);
    }

    #[Test]
    public function a_variant_keeps_its_characteristics_and_photos_in_order(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $color = Attribute::factory()->create(['name' => ['ru' => 'Цвет', 'kk' => 'Түсі']]);
        $first = $this->photo($product, 'a.jpg');
        $second = $this->photo($product, 'b.jpg');

        $this->postJson("/api/admin/products/{$product->id}/variants", [
            'name' => 'Серый',
            'attribute_values' => [['attribute_id' => $color->id, 'value' => ['ru' => 'Серый', 'kk' => 'Сұр']]],
            'media_ids' => [$second->id, $first->id],
        ])
            ->assertCreated()
            ->assertJsonPath('data.attribute_values.0.value.kk', 'Сұр')
            ->assertJsonPath('data.attribute_values.0.attribute.name.ru', 'Цвет')
            ->assertJsonPath('data.images.0.id', $second->id)
            ->assertJsonPath('data.images.1.id', $first->id);

        $this->getJson("/api/admin/products/{$product->id}/variants")
            ->assertOk()
            ->assertJsonPath('data.0.images.0.id', $second->id)
            ->assertJsonPath('data.0.attribute_values.0.value.ru', 'Серый');
    }

    #[Test]
    public function a_photo_of_another_product_is_refused(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $foreign = $this->photo(Product::factory()->create());

        $this->postJson("/api/admin/products/{$product->id}/variants", ['name' => 'Серый', 'media_ids' => [$foreign->id]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('media_ids.0');
    }

    #[Test]
    public function an_update_without_media_ids_keeps_the_photos(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $variant = ProductVariant::factory()->for($product)->create();
        $photo = $this->photo($product);
        $variant->images()->attach($photo->id, ['sort_order' => 0]);

        $this->putJson("/api/admin/products/{$product->id}/variants/{$variant->id}", ['name' => 'Белый'])
            ->assertOk()
            ->assertJsonPath('data.images.0.id', $photo->id);
    }

    #[Test]
    public function deleting_a_gallery_photo_unmarks_it_on_variants(): void
    {
        $product = Product::factory()->create();
        $variant = ProductVariant::factory()->for($product)->create();
        $photo = $this->photo($product);
        $variant->images()->attach($photo->id, ['sort_order' => 0]);

        $photo->delete();

        $this->assertDatabaseMissing('product_variant_media', ['product_variant_id' => $variant->id]);
    }
```

(импорты: `App\Models\Attribute`, `Illuminate\Http\UploadedFile`, `Spatie\MediaLibrary\MediaCollections\Models\Media`.)

`tests/Feature/Admin/AttributeApiTest.php` — два теста:

```php
    #[Test]
    public function an_attribute_used_by_a_variant_cannot_be_deleted(): void
    {
        $this->actingAsManager();
        $attribute = Attribute::factory()->create();
        ProductVariantAttributeValue::factory()->create(['attribute_id' => $attribute->id]);

        $this->deleteJson("/api/admin/attributes/{$attribute->id}")->assertUnprocessable();
        $this->assertDatabaseHas('attributes', ['id' => $attribute->id]);
    }

    #[Test]
    public function the_list_counts_variant_usage_too(): void
    {
        $this->actingAsManager();
        $attribute = Attribute::factory()->create();
        ProductVariantAttributeValue::factory()->count(3)->create(['attribute_id' => $attribute->id]);

        $this->getJson('/api/admin/attributes')
            ->assertOk()
            ->assertJsonPath('data.0.variant_values_count', 3);
    }
```

Run: `$T --filter='ProductVariantApiTest|AttributeApiTest'`
Expected: FAIL.

- [ ] **Step 2: Миграции**

`database/migrations/2026_09_25_000003_create_product_variant_attribute_values_table.php`:

```php
<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A variant's characteristics, from the same attribute dictionary as the
 * product's (attribute_values), value as {ru, kk} JSON.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_variant_attribute_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('attribute_id')->constrained()->cascadeOnDelete();
            $table->json('value');
            $table->timestamps();
            // The default name is longer than MySQL's 64 characters.
            $table->unique(['product_variant_id', 'attribute_id'], 'pvav_variant_attribute_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variant_attribute_values');
    }
};
```

`database/migrations/2026_09_25_000004_create_product_variant_media_table.php`:

```php
<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which of the product's photos (media, collection `images`) belong to a
 * variant, in the variant's own order. A photo deleted from the gallery
 * disappears from its variants by the cascade.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_variant_media', function (Blueprint $table) {
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_id')->constrained('media')->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->primary(['product_variant_id', 'media_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variant_media');
    }
};
```

- [ ] **Step 3: Модели**

```bash
php artisan make:model ProductVariantAttributeValue --factory --no-interaction
```

`app/Models/ProductVariantAttributeValue.php`:

```php
<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductVariantAttributeValueFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Translatable\HasTranslations;

/**
 * One characteristic of a variant — the variant's counterpart of
 * {@see AttributeValue}, from the same attribute dictionary.
 */
class ProductVariantAttributeValue extends Model
{
    /** @use HasFactory<ProductVariantAttributeValueFactory> */
    use HasFactory;

    use HasTranslations;

    /** @var list<string> */
    public array $translatable = ['value'];

    protected $fillable = [
        'product_variant_id',
        'attribute_id',
        'value',
    ];

    /**
     * @return BelongsTo<ProductVariant, $this>
     */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    /**
     * @return BelongsTo<Attribute, $this>
     */
    public function attribute(): BelongsTo
    {
        return $this->belongsTo(Attribute::class);
    }
}
```

`database/factories/ProductVariantAttributeValueFactory.php` — `definition()`:

```php
        return [
            'product_variant_id' => ProductVariant::factory(),
            'attribute_id' => Attribute::factory(),
            'value' => ['ru' => fake()->word()],
        ];
```

`app/Models/ProductVariant.php` — добавить (импорты `HasMany`, `BelongsToMany`, `Spatie\MediaLibrary\MediaCollections\Models\Media`):

```php
    /**
     * @return HasMany<ProductVariantAttributeValue, $this>
     */
    public function attributeValues(): HasMany
    {
        return $this->hasMany(ProductVariantAttributeValue::class);
    }

    /**
     * The variant's photos: a subset of its product's `images` collection,
     * in the variant's own order.
     *
     * @return BelongsToMany<Media, $this>
     */
    public function images(): BelongsToMany
    {
        return $this->belongsToMany(Media::class, 'product_variant_media')
            ->withPivot('sort_order')
            ->orderByPivot('sort_order');
    }
```

`app/Models/Attribute.php`:

```php
    /**
     * @return HasMany<ProductVariantAttributeValue, $this>
     */
    public function variantValues(): HasMany
    {
        return $this->hasMany(ProductVariantAttributeValue::class);
    }
```

- [ ] **Step 4: Запрос варианта**

`app/Http/Requests/Admin/ProductVariantRequest.php` (импорты `App\Models\Product`, `Illuminate\Validation\Rule`) — вместо двух правил `characteristics*`:

```php
            // Characteristics — the whole set, synced by AttributeValueSync.
            'attribute_values' => ['sometimes', 'array'],
            'attribute_values.*.attribute_id' => ['required', 'integer', 'distinct', 'exists:attributes,id'],
            'attribute_values.*.value' => ['required', 'array'],
            'attribute_values.*.value.ru' => ['required', 'string', 'max:255'],
            'attribute_values.*.value.kk' => ['nullable', 'string', 'max:255'],
            // Photos: ids of this product's gallery, in the variant's order.
            'media_ids' => ['sometimes', 'array'],
            'media_ids.*' => ['integer', 'distinct', $this->ownPhoto()],
```

и метод:

```php
    /**
     * A media id from this product's `images` collection — never another
     * product's photo.
     */
    private function ownPhoto(): Exists
    {
        /** @var Product $product */
        $product = $this->route('product');

        return Rule::exists('media', 'id')
            ->where('model_type', $product->getMorphClass())
            ->where('model_id', $product->id)
            ->where('collection_name', Product::IMAGE_COLLECTION);
    }
```

(импорт `Illuminate\Validation\Rules\Exists`). Докблок класса: убрать упоминание характеристик-текстом, добавить «the legacy `characteristics` JSON is ERP data and no longer written».

- [ ] **Step 5: Контроллер варианта**

`app/Http/Controllers/Api/Admin/ProductVariantController.php` целиком:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProductVariantRequest;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\Catalog\AttributeValueSync;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class ProductVariantController extends Controller
{
    /** ERP bookkeeping kept as data, never shown in the admin. */
    private const HIDDEN = ['source', 'external_id', 'synced_at', 'characteristics'];

    /** Relations every response carries. */
    private const RELATIONS = ['attributeValues.attribute:id,name,slug', 'images'];

    public function index(Product $product): JsonResponse
    {
        $variants = $product->variants()->with(self::RELATIONS)->orderBy('id')->get();

        return response()->json(['data' => $variants->map(fn (ProductVariant $variant): array => $this->present($variant))->all()]);
    }

    public function store(ProductVariantRequest $request, Product $product, AttributeValueSync $sync): JsonResponse
    {
        $data = $request->validated();

        $variant = DB::transaction(function () use ($data, $product, $sync): ProductVariant {
            $variant = $product->variants()->create([
                ...Arr::except($data, ['attribute_values', 'media_ids']),
                // NOT NULL columns from the ERP days; a hand-made variant is local.
                'source' => 'local',
                'external_id' => (string) Str::uuid(),
            ]);
            $this->saveRelations($variant, $data, $sync);

            return $variant;
        });

        return response()->json(['data' => $this->present($variant)], 201);
    }

    public function update(ProductVariantRequest $request, Product $product, ProductVariant $variant, AttributeValueSync $sync): JsonResponse
    {
        $data = $request->validated();

        DB::transaction(function () use ($data, $variant, $sync): void {
            $variant->update(Arr::except($data, ['attribute_values', 'media_ids']));
            $this->saveRelations($variant, $data, $sync);
        });

        return response()->json(['data' => $this->present($variant)]);
    }

    public function destroy(Product $product, ProductVariant $variant): JsonResponse
    {
        $variant->delete();

        return response()->json(null, 204);
    }

    /**
     * Keys absent from the request leave that relation as it is.
     *
     * @param  array<string, mixed>  $data
     */
    private function saveRelations(ProductVariant $variant, array $data, AttributeValueSync $sync): void
    {
        if (array_key_exists('attribute_values', $data)) {
            $sync->sync($variant, $data['attribute_values']);
        }

        if (array_key_exists('media_ids', $data)) {
            $variant->images()->sync(
                collect($data['media_ids'])
                    ->values()
                    ->mapWithKeys(fn (mixed $id, int $position): array => [(int) $id => ['sort_order' => $position]])
                    ->all(),
            );
        }
    }

    /**
     * The variant as the admin reads it; photos in the gallery's own shape.
     *
     * @return array<string, mixed>
     */
    private function present(ProductVariant $variant): array
    {
        $variant->load(self::RELATIONS)->makeHidden([...self::HIDDEN, 'images']);

        return [
            ...$variant->toArray(),
            'images' => $variant->images->map(fn (Media $media): array => ProductMediaController::present($media))->values()->all(),
        ];
    }
}
```

- [ ] **Step 6: Атрибуты — счётчик вариантов и запрет удаления**

`AttributeController`: `private const COUNTS = ['values', 'variantValues'];` и в `destroy`:

```php
        if ($attribute->values()->exists() || $attribute->variantValues()->exists()) {
            return response()->json(['message' => 'Атрибут используется в товарах или вариантах — сначала удалите его значения.'], 422);
        }
```

Докблок `destroy`: «…would cascade away every product's and variant's value…». Если в `AttributeApiTest` есть проверка старого текста сообщения — обновить её.

- [ ] **Step 7: Прогнать**

Run: `$T --filter='ProductVariantApiTest|AttributeApiTest|CatalogSlugTest|AdminPagesRenderTest'`
Expected: PASS.

- [ ] **Step 8: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add -A app database tests
git commit -m "feat(api): variant characteristics from the attribute dictionary and photos from the product gallery"
```

---

### Task 5: Публичный API — переведённые характеристики и фото вариантов

**Files:**
- Modify: `app/Http/Resources/ProductResource.php` (`variantsPayload`, `imagePayload`)
- Modify: `app/Http/Controllers/Api/Public/ProductController.php:114`, `app/Http/Controllers/Api/ProductController.php:116` (eager loads)
- Create: `tests/Feature/Public/ProductCharacteristicsTranslationTest.php`
- Modify: `tests/Feature/Catalog/CatalogApiTest.php` (если его проверка `characteristics` варианта ломается — она про старый JSON и должна остаться зелёной)

**Interfaces:**
- Consumes: `ProductVariant::attributeValues()`, `ProductVariant::images()` (задача 4).
- Produces: в детальной карточке `variants[].characteristics` — `list<{name, slug, value}>` на языке запроса, либо старый объект `{"Цвет": "красный"}`, если структурированных нет; `variants[].images` — `list<{thumb, medium, full}>`.

- [ ] **Step 1: Тесты (падают)**

`tests/Feature/Public/ProductCharacteristicsTranslationTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ProductVariantAttributeValue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ProductCharacteristicsTranslationTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function characteristics_come_in_the_request_locale_with_ru_as_fallback(): void
    {
        $product = Product::factory()->create();
        $color = Attribute::factory()->create(['name' => ['ru' => 'Цвет', 'kk' => 'Түсі'], 'slug' => 'color']);
        $size = Attribute::factory()->create(['name' => ['ru' => 'Размер'], 'slug' => 'size']);
        AttributeValue::factory()->create(['product_id' => $product->id, 'attribute_id' => $color->id, 'value' => ['ru' => 'Серый', 'kk' => 'Сұр']]);
        AttributeValue::factory()->create(['product_id' => $product->id, 'attribute_id' => $size->id, 'value' => ['ru' => '200x90']]);

        $characteristics = collect($this->getJson("/api/public/products/{$product->id}?locale=kk")->assertOk()->json('data.characteristics'))
            ->keyBy('slug');

        $this->assertSame(['name' => 'Түсі', 'slug' => 'color', 'value' => 'Сұр'], $characteristics['color']);
        $this->assertSame(['name' => 'Размер', 'slug' => 'size', 'value' => '200x90'], $characteristics['size']);
    }

    #[Test]
    public function a_variant_carries_its_structured_characteristics_and_photos(): void
    {
        Storage::fake(config('media-library.disk_name'));
        $product = Product::factory()->create();
        $variant = ProductVariant::factory()->for($product)->create(['characteristics' => ['Цвет' => 'старое']]);
        $color = Attribute::factory()->create(['name' => ['ru' => 'Цвет', 'kk' => 'Түсі'], 'slug' => 'color']);
        ProductVariantAttributeValue::factory()->create([
            'product_variant_id' => $variant->id,
            'attribute_id' => $color->id,
            'value' => ['ru' => 'Серый', 'kk' => 'Сұр'],
        ]);
        $photo = $product->addMedia(UploadedFile::fake()->image('a.jpg'))->toMediaCollection(Product::IMAGE_COLLECTION);
        $variant->images()->attach($photo->id, ['sort_order' => 0]);

        $response = $this->getJson("/api/public/products/{$product->id}?locale=kk")->assertOk();

        $this->assertSame([['name' => 'Түсі', 'slug' => 'color', 'value' => 'Сұр']], $response->json('data.variants.0.characteristics'));
        $this->assertCount(1, $response->json('data.variants.0.images'));
        $this->assertStringContainsString('thumb', (string) $response->json('data.variants.0.images.0.thumb'));
    }

    #[Test]
    public function a_legacy_variant_still_shows_its_erp_characteristics(): void
    {
        $product = Product::factory()->create();
        ProductVariant::factory()->for($product)->create(['characteristics' => ['Цвет' => 'красный']]);

        $this->getJson("/api/public/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.variants.0.characteristics', ['Цвет' => 'красный'])
            ->assertJsonPath('data.variants.0.images', []);
    }
}
```

Путь `…/thumb…` у конверсии зависит от генератора путей media-library; если `getUrl('thumb')` в тестах даёт URL без `thumb` — заменить последнюю проверку на `assertNotEmpty($response->json('data.variants.0.images.0.thumb'))`.

Run: `$T --filter=ProductCharacteristicsTranslationTest`
Expected: FAIL (у варианта нет `images`, характеристики — старый JSON).

- [ ] **Step 2: Ресурс**

`app/Http/Resources/ProductResource.php` (импорт `Spatie\MediaLibrary\MediaCollections\Models\Media`):

`imagePayload()` → через общий помощник:

```php
    private function imagePayload(): array
    {
        return $this->getMedia(Product::IMAGE_COLLECTION)
            ->map(fn (Media $media): array => self::imageUrls($media))
            ->values()
            ->all();
    }

    /**
     * @return array{thumb: string, medium: string, full: string}
     */
    private static function imageUrls(Media $media): array
    {
        return [
            'thumb' => $media->getUrl('thumb'),
            'medium' => $media->getUrl('card'),
            'full' => $media->getUrl('full'),
        ];
    }
```

В `variantsPayload()` — `$payload`:

```php
                $payload = [
                    'id' => $variant->id,
                    'external_id' => $variant->external_id,
                    'name' => $variant->name,
                    'characteristics' => $this->variantCharacteristics($variant),
                    'images' => $variant->images->map(fn (Media $media): array => self::imageUrls($media))->values()->all(),
                    'barcodes' => $variant->barcodes ?? [],
                ];
```

и метод:

```php
    /**
     * Structured characteristics in the request locale; a variant mirrored
     * from the ERP that has none keeps its legacy {"Цвет": "красный"} object.
     *
     * @return list<array{name: string, slug: string, value: string}>|array<string, mixed>
     */
    private function variantCharacteristics(ProductVariant $variant): array
    {
        $values = $variant->attributeValues->filter(fn ($value): bool => $value->attribute !== null);

        if ($values->isEmpty()) {
            return $variant->characteristics ?? [];
        }

        return $values
            ->map(fn ($value): array => [
                'name' => $value->attribute->name,
                'slug' => $value->attribute->slug,
                'value' => $value->value,
            ])
            ->values()
            ->all();
    }
```

(импорт `App\Models\ProductVariant`). Докблок `variantsPayload`: «Relies on `variants.attributeValues.attribute` and `variants.images` being eager-loaded».

- [ ] **Step 3: Eager loads**

- `app/Http/Controllers/Api/Public/ProductController.php:114`: в `loadMissing(...)` заменить `'variants'` на `'variants.attributeValues.attribute', 'variants.images'`.
- `app/Http/Controllers/Api/ProductController.php:116`: `$product->loadMissing('media', 'variants.attributeValues.attribute', 'variants.images');`

- [ ] **Step 4: Прогнать**

Run: `$T --filter='ProductCharacteristicsTranslationTest|ProductVariantTest|CatalogApiTest|PublicCatalogTest|StockVisibilityTest|UnapprovedCatalogTest'`
Expected: PASS.

- [ ] **Step 5: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app tests
git commit -m "feat(api): translated characteristics and variant photos in the product card"
```

---

### Task 6: Сортировка клиентов для выбора

**Files:**
- Modify: `app/Http/Controllers/Api/Admin/UserController.php`
- Modify: `tests/Feature/Admin/UserApiTest.php`

**Interfaces:**
- Produces: `GET /admin/users?sort=company_name|name|-company_name|-name`; без `sort` — новые сверху, как сейчас.

- [ ] **Step 1: Тесты (падают)**

В `tests/Feature/Admin/UserApiTest.php` (стиль и помощники — как у соседних тестов файла; фабрика `User::factory()->b2b()`):

```php
    #[Test]
    public function clients_can_be_listed_by_company_name(): void
    {
        $this->actingAsManager();
        User::factory()->b2b()->create(['company_name' => 'Яблоко']);
        User::factory()->b2b()->create(['company_name' => 'Арман']);

        $this->getJson('/api/admin/users?sort=company_name')
            ->assertOk()
            ->assertJsonPath('data.0.company_name', 'Арман')
            ->assertJsonPath('data.1.company_name', 'Яблоко');
    }

    #[Test]
    public function without_a_sort_the_newest_client_comes_first(): void
    {
        $this->actingAsManager();
        User::factory()->b2b()->create(['company_name' => 'Старый', 'created_at' => now()->subDay()]);
        User::factory()->b2b()->create(['company_name' => 'Новый']);

        $this->getJson('/api/admin/users')
            ->assertOk()
            ->assertJsonPath('data.0.company_name', 'Новый');
    }
```

Run: `$T --filter=UserApiTest`
Expected: первый FAIL (400 — сортировка не разрешена), второй PASS.

- [ ] **Step 2: Реализация**

В `UserController::index` заменить `->latest()` на:

```php
            // For the client picker; the clients screen sends no sort and
            // keeps the newest first.
            ->allowedSorts('company_name', 'name', 'created_at')
            ->defaultSort('-created_at')
```

(`latest()` нельзя оставить: он встал бы первым в ORDER BY и перебил бы `sort`.)

- [ ] **Step 3: Прогнать, pint, коммит**

Run: `$T --filter=UserApiTest` → PASS.

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Controllers/Api/Admin/UserController.php tests/Feature/Admin/UserApiTest.php
git commit -m "feat(api): sortable B2B client list for the client picker"
```

---

### Task 7: Админка — «+ Создать» в списках, шторки бренда и категории

**Files:**
- Modify: `admin/src/lib/catalogTypes.ts`, `admin/src/lib/text.ts`
- Modify: `admin/src/app/attributes/page.tsx` (временно: `ru(a.name)`; редизайн — задача 10)
- Modify: `admin/src/components/ui/SearchSelect.tsx`
- Create: `admin/src/components/catalog/BrandFormSheet.tsx`, `admin/src/components/catalog/CategoryFormSheet.tsx`
- Modify: `admin/src/components/products/form/CatalogCard.tsx`, `admin/src/components/products/form/ProductForm.tsx`
- Modify: `admin/e2e/product-form.spec.ts`

**Interfaces:**
- Consumes: `POST /admin/brands`, `POST /admin/categories` без slug (задача 2).
- Produces:
  - `type Attribute = { id: number; name: Translatable; slug: string; is_filterable: boolean; values_count?: number; variant_values_count?: number }`
  - `kk(value: Translatable): string`
  - `SearchSelect` — новые необязательные пропсы `onCreate?: (query: string) => void`, `autoFocus?: boolean`
  - `BrandFormSheet({ initialName, onSaved(brand: NamedOption), onClose })`, `CategoryFormSheet({ initialName, categories, onSaved(category: NamedOption), onClose })`
  - `CatalogCard` — новые пропсы `onCategoryCreated(c: NamedOption)`, `onBrandCreated(b: NamedOption)`

- [ ] **Step 1: Типы и помощник**

`admin/src/lib/catalogTypes.ts`:

```ts
import type { Translatable } from './text';

/** Атрибут из `/admin/attributes`: название на двух языках и сколько раз он используется. */
export type Attribute = {
  id: number;
  name: Translatable;
  slug: string;
  is_filterable: boolean;
  values_count?: number;
  variant_values_count?: number;
};
```

(`PriceType` остаётся как есть.)

`admin/src/lib/text.ts` — после `ru`:

```ts
/** Казахский текст переводимой колонки; '' — перевода нет. */
export const kk = (value: Translatable): string => (typeof value === 'string' ? '' : value?.kk ?? '');
```

`admin/src/app/attributes/page.tsx`: в колонке «Название» — `{ru(a.name)}`, в `toForm` — `name: ru(a?.name)` (импорт `ru` из `@/lib/text`); отправка пока строкой — страница полностью переписывается в задаче 10, до неё создание с этого экрана не работает (сервер ждёт `name.ru`). Это временно и в рамках ветки.

- [ ] **Step 2: `SearchSelect` — «+ Создать» и автофокус**

`admin/src/components/ui/SearchSelect.tsx`:
- `Props` дополнить:

```ts
  /**
   * «+ Создать „…“» последним пунктом, когда введённого текста нет среди
   * пунктов. Получает набранный текст, список закрывается.
   */
  onCreate?: (query: string) => void;
  /** Фокус при появлении — список сразу открыт (новая строка характеристики). */
  autoFocus?: boolean;
```

- над компонентом: `const CREATE = '\u0000create';` с комментарием «value пункта „+ Создать“ — не может совпасть с id записи».
- в теле вместо вычисления `visible`:

```ts
  const typed = query.trim();
  const filtered = needle ? all.filter((o) => o.value !== '' && o.label.toLocaleLowerCase('ru').includes(needle)) : all;
  const exact = options.some((o) => o.label.toLocaleLowerCase('ru') === needle);
  const visible = onCreate && typed !== '' && !exact ? [...filtered, { value: CREATE, label: `+ Создать «${typed}»` }] : filtered;
```

- `pick`:

```ts
  const pick = (option: SelectOption) => {
    if (option.value === CREATE) {
      onCreate?.(typed);
    } else {
      onChange(option.value);
    }
    close();
  };
```

- `<input … autoFocus={autoFocus}>`.
- в `className` пункта: `option.value === CREATE ? 'font-medium text-blue-700' : option.value === value ? 'font-medium text-blue-700' : 'text-zinc-800'` (выделение «+ Создать» — как у выбранного).
- в JSDoc компонента добавить абзац про `onCreate`.

- [ ] **Step 3: Шторки бренда и категории**

`admin/src/components/catalog/BrandFormSheet.tsx`:

```tsx
'use client';

import { z } from 'zod';
import type { NamedOption } from '@/components/products/form/formModel';
import CrudModal from '@/components/ui/CrudModal';
import TranslatableField from '@/components/ui/TranslatableField';
import api from '@/lib/api';
import { REQUIRED } from '@/lib/validation';

const LONG = 'Не длиннее 255 символов';

const schema = z.object({
  name: z.object({ ru: z.string().trim().min(1, REQUIRED).max(255, LONG), kk: z.string().max(255, LONG) }),
});

type Props = {
  /** Текст из поиска «+ Создать „…“». */
  initialName: string;
  onSaved: (brand: NamedOption) => void;
  onClose: () => void;
};

/** Новый бренд прямо из карточки товара: только название, slug сделает сервер. */
export default function BrandFormSheet({ initialName, onSaved, onClose }: Props) {
  return (
    <CrudModal
      title="Новый бренд"
      schema={schema}
      defaultValues={{ name: { ru: initialName, kk: '' } }}
      submitLabel="Создать"
      onSubmit={async (values) => {
        const res = await api.post('/admin/brands', { name: values.name, is_active: true });
        onSaved((res.data?.data ?? res.data) as NamedOption);
      }}
      onClose={onClose}
    >
      {(form) => <TranslatableField form={form} name="name" label="Название" required />}
    </CrudModal>
  );
}
```

`admin/src/components/catalog/CategoryFormSheet.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import { Controller } from 'react-hook-form';
import { z } from 'zod';
import { categoryOptions, type NamedOption } from '@/components/products/form/formModel';
import CrudModal from '@/components/ui/CrudModal';
import Field from '@/components/ui/Field';
import SearchSelect from '@/components/ui/SearchSelect';
import TranslatableField from '@/components/ui/TranslatableField';
import api from '@/lib/api';
import { REQUIRED } from '@/lib/validation';

const LONG = 'Не длиннее 255 символов';

const schema = z.object({
  name: z.object({ ru: z.string().trim().min(1, REQUIRED).max(255, LONG), kk: z.string().max(255, LONG) }),
  parent_id: z.string(),
});

type Props = {
  initialName: string;
  categories: NamedOption[];
  onSaved: (category: NamedOption) => void;
  onClose: () => void;
};

/**
 * Новая категория из карточки товара. Родитель выбирается без «+ Создать» —
 * шторка в шторке была бы уже лишней.
 */
export default function CategoryFormSheet({ initialName, categories, onSaved, onClose }: Props) {
  const parents = useMemo(() => categoryOptions(categories), [categories]);

  return (
    <CrudModal
      title="Новая категория"
      schema={schema}
      defaultValues={{ name: { ru: initialName, kk: '' }, parent_id: '' }}
      submitLabel="Создать"
      onSubmit={async (values) => {
        const res = await api.post('/admin/categories', {
          name: values.name,
          parent_id: values.parent_id === '' ? null : Number(values.parent_id),
          is_active: true,
        });
        onSaved((res.data?.data ?? res.data) as NamedOption);
      }}
      onClose={onClose}
    >
      {(form) => (
        <>
          <TranslatableField form={form} name="name" label="Название" required />
          <Field label="Родительская категория" htmlFor="category-parent" error={form.formState.errors.parent_id?.message}>
            <Controller
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <SearchSelect id="category-parent" options={parents} value={field.value} onChange={field.onChange} emptyLabel="Верхний уровень" />
              )}
            />
          </Field>
        </>
      )}
    </CrudModal>
  );
}
```

- [ ] **Step 4: `CatalogCard` и `ProductForm`**

`CatalogCard.tsx`: пропсы `onCategoryCreated: (category: NamedOption) => void; onBrandCreated: (brand: NamedOption) => void;`, состояние и шторки:

```tsx
  const [creating, setCreating] = useState<{ kind: 'category' | 'brand'; name: string } | null>(null);
```

В `SearchSelect` категории — `onCreate={(name) => setCreating({ kind: 'category', name })}`, бренда — `onCreate={(name) => setCreating({ kind: 'brand', name })}`. После `</Field>` бренда:

```tsx
      {creating?.kind === 'category' && (
        <CategoryFormSheet
          initialName={creating.name}
          categories={categories}
          onSaved={(category) => {
            onCategoryCreated(category);
            form.setValue('category_id', String(category.id), { shouldDirty: true, shouldValidate: true });
          }}
          onClose={() => setCreating(null)}
        />
      )}
      {creating?.kind === 'brand' && (
        <BrandFormSheet
          initialName={creating.name}
          onSaved={(brand) => {
            onBrandCreated(brand);
            form.setValue('brand_id', String(brand.id), { shouldDirty: true, shouldValidate: true });
          }}
          onClose={() => setCreating(null)}
        />
      )}
```

`ProductForm.tsx`:

```tsx
  const [categoryList, setCategoryList] = useState(categories);
  const [brandList, setBrandList] = useState(brands);
```

и `<CatalogCard form={form} categories={categoryList} brands={brandList} onCategoryCreated={(c) => setCategoryList((list) => [...list, c])} onBrandCreated={(b) => setBrandList((list) => [...list, b])} />`.

- [ ] **Step 5: Проверка типов и сборка**

Run (из `admin/`): `npx tsc --noEmit && npm run lint && npm run build`
Expected: без ошибок.

- [ ] **Step 6: e2e — бренд из карточки товара**

В `admin/e2e/product-form.spec.ts`: модульный `let createdBrands: number[] = [];`, сброс в `beforeEach`, в `afterEach` после товаров — `for (const id of createdBrands) await api.delete(\`/admin/brands/${id}\`);`. Тест:

```ts
test("бренд создаётся прямо из поля «Бренд»", async ({ page, request }) => {
  const product = await draftProduct(request);
  const brandName = `E2E бренд ${Date.now()}`;

  await page.goto(`/products/${product.id}`);
  await page.getByRole("combobox", { name: "Бренд" }).fill(brandName);
  await page.getByRole("option", { name: `+ Создать «${brandName}»` }).click();

  const dialog = page.getByRole("dialog", { name: "Новый бренд" });
  await expect(dialog.getByLabel("Название (RU) *")).toHaveValue(brandName);
  await dialog.getByLabel("Название (KK)").fill(`${brandName} kk`);
  await dialog.getByRole("button", { name: "Создать" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("combobox", { name: "Бренд" })).toHaveValue(brandName);

  await saveButton(page).click();
  await expect(page.getByText("Сохранено", { exact: true })).toBeVisible();

  const saved = await adminApi(request).get<{ data: { brand_id: number | null } }>(`/admin/products/${product.id}`);
  expect(saved?.data.brand_id).not.toBeNull();
  createdBrands.push(saved!.data.brand_id!);
});
```

Run: `npx playwright test --project=Desktop e2e/product-form.spec.ts` и `--project=Mobile`
Expected: PASS (тест «новый товар…» здесь ещё проверяет заблокированный блок «Характеристики» — меняется в задаче 8; сейчас он должен оставаться зелёным).

- [ ] **Step 7: Коммит**

```bash
git add admin/src admin/e2e/product-form.spec.ts
git commit -m "feat(admin): create a brand or a category from the product form"
```

---

### Task 8: Админка — характеристики в основной форме товара

**Files:**
- Create: `admin/src/components/catalog/attributeRows.ts`
- Create: `admin/src/components/catalog/AttributeFormSheet.tsx`
- Create: `admin/src/components/catalog/AttributeRows.tsx`
- Create: `admin/src/components/products/form/AttributesSection.tsx`
- Modify: `admin/src/components/products/form/formModel.ts`, `admin/src/components/products/form/ProductForm.tsx`, `admin/src/app/products/[id]/page.tsx`
- Modify: `admin/src/components/ui/CrudModal.tsx`, `admin/src/components/ui/useOverlay.ts`
- Delete: `admin/src/components/products/AttributeValuesTab.tsx`
- Modify: `admin/e2e/product-form.spec.ts`

**Interfaces:**
- Consumes: `SearchSelect` `onCreate`/`autoFocus` (задача 7); API товара с `attribute_values` (задача 3); `POST/PUT /admin/attributes` (задача 2).
- Produces:
  - `type AttributeRowValue = { attribute_id: string; value: { ru: string; kk: string } }`
  - `type ApiAttributeValue = { attribute_id: number; value: Translatable; attribute?: Pick<Attribute, 'id' | 'name' | 'slug'> }`
  - `attributeRowsSchema` (zod-массив с проверкой повторов), `toAttributeRows(values?: ApiAttributeValue[]): AttributeRowValue[]`, `attributeRowsPayload(rows): {attribute_id: number; value: {ru; kk}}[]`, `appendAttributeRows(data: FormData, rows): void`
  - `AttributeFormSheet({ attribute: Attribute | null, initialName?, onSaved(a: Attribute), onClose })`
  - `AttributeRows<T extends { attribute_values: AttributeRowValue[] }>({ form: UseFormReturn<T>, attributes: Attribute[], onAttributeCreated(a), locale: Locale })`
  - `ProductForm` — новый проп `attributes: Attribute[]`

- [ ] **Step 1: Модель строк**

`admin/src/components/catalog/attributeRows.ts`:

```ts
import { z } from 'zod';
import type { Attribute } from '@/lib/catalogTypes';
import { kk, ru, type Translatable } from '@/lib/text';
import { REQUIRED } from '@/lib/validation';

/**
 * Строки «атрибут → значение» у товара и у варианта: схема, перевод из API
 * и обратно. id атрибута — строкой, как значение поля выбора.
 */
export type AttributeRowValue = { attribute_id: string; value: { ru: string; kk: string } };

/** Значение, как его отдаёт API товара или варианта. */
export type ApiAttributeValue = { attribute_id: number; value: Translatable; attribute?: Pick<Attribute, 'id' | 'name' | 'slug'> };

const LONG = 'Не длиннее 255 символов';

export const attributeRowsSchema = z
  .array(
    z.object({
      attribute_id: z.string().min(1, 'Выберите атрибут'),
      value: z.object({ ru: z.string().trim().min(1, REQUIRED).max(255, LONG), kk: z.string().max(255, LONG) }),
    }),
  )
  .superRefine((rows, ctx) => {
    const seen = new Set<string>();

    rows.forEach((row, index) => {
      if (row.attribute_id !== '' && seen.has(row.attribute_id)) {
        ctx.addIssue({ code: 'custom', path: [index, 'attribute_id'], message: 'Этот атрибут уже есть' });
      }
      seen.add(row.attribute_id);
    });
  });

export const emptyAttributeRow = (): AttributeRowValue => ({ attribute_id: '', value: { ru: '', kk: '' } });

export const toAttributeRows = (values: ApiAttributeValue[] | undefined): AttributeRowValue[] =>
  (values ?? []).map((v) => ({ attribute_id: String(v.attribute_id), value: { ru: ru(v.value), kk: kk(v.value) } }));

/** Тело JSON-запроса (вариант). */
export const attributeRowsPayload = (rows: AttributeRowValue[]) =>
  rows.map((row) => ({ attribute_id: Number(row.attribute_id), value: row.value }));

/**
 * Тело multipart-запроса (товар). Пустой набор уходит пустой строкой: в
 * FormData нельзя положить пустой массив, а без ключа сервер оставил бы
 * характеристики как есть. '' сервер читает как «удалить все».
 */
export function appendAttributeRows(data: FormData, rows: AttributeRowValue[]): void {
  if (rows.length === 0) {
    data.append('attribute_values', '');

    return;
  }

  rows.forEach((row, index) => {
    data.append(`attribute_values[${index}][attribute_id]`, row.attribute_id);
    data.append(`attribute_values[${index}][value][ru]`, row.value.ru);
    data.append(`attribute_values[${index}][value][kk]`, row.value.kk);
  });
}
```

- [ ] **Step 2: Вложенные слои — `CrudModal` и `useOverlay`**

`admin/src/components/ui/CrudModal.tsx` — форма:

```tsx
      <form
        id={formId}
        // Шторка может открыться поверх другой (атрибут из окна варианта).
        // Портал не меняет дерево React: без остановки submit этой формы
        // дошёл бы до внешней и сохранил бы её раньше времени.
        onSubmit={(e) => {
          e.stopPropagation();
          void submit(e);
        }}
        noValidate
        className="space-y-4"
      >
```

и новый проп `submitDisabled?: boolean` («Кнопка отправки недоступна: например, ещё грузится фото») — в кнопке `disabled={form.formState.isSubmitting || submitDisabled}`.

`admin/src/components/ui/useOverlay.ts` — Esc только у верхнего слоя:

```ts
// Открытые слои по порядку: Escape закрывает только последний. Без этого
// Esc в шторке атрибута поверх окна варианта закрыл бы оба.
const stack: symbol[] = [];
```

и первый эффект:

```ts
  useEffect(() => {
    const token = Symbol('overlay');
    stack.push(token);

    const onKey = (e: KeyboardEvent) => {
      // defaultPrevented — Escape уже обработал вложенный элемент (закрыл список SearchSelect).
      if (e.key === 'Escape' && !e.defaultPrevented && stack[stack.length - 1] === token) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(token), 1);
    };
  }, [onClose]);
```

Докблок хука: дописать «Escape — только у верхнего открытого слоя».

- [ ] **Step 3: Шторка атрибута**

`admin/src/components/catalog/AttributeFormSheet.tsx`:

```tsx
'use client';

import { z } from 'zod';
import CrudModal from '@/components/ui/CrudModal';
import Field from '@/components/ui/Field';
import TranslatableField from '@/components/ui/TranslatableField';
import { inputClass } from '@/components/ui/styles';
import api from '@/lib/api';
import type { Attribute } from '@/lib/catalogTypes';
import { kk, ru } from '@/lib/text';
import { REQUIRED, SLUG_PATTERN } from '@/lib/validation';

const LONG = 'Не длиннее 255 символов';

const schema = z.object({
  name: z.object({ ru: z.string().trim().min(1, REQUIRED).max(255, LONG), kk: z.string().max(255, LONG) }),
  slug: z.string().refine((v) => v === '' || SLUG_PATTERN.test(v), 'Латиница в нижнем регистре, цифры и дефисы'),
  is_filterable: z.boolean(),
});

type Props = {
  /** null — новый атрибут. */
  attribute: Attribute | null;
  /** Текст из поиска «+ Создать „…“». */
  initialName?: string;
  onSaved: (attribute: Attribute) => void;
  onClose: () => void;
};

/**
 * Атрибут: создание (из карточки товара или с экрана «Атрибуты») и правка.
 * Slug спрятан под «Дополнительно»: пустой при создании — сервер сделает его
 * из русского названия.
 */
export default function AttributeFormSheet({ attribute, initialName = '', onSaved, onClose }: Props) {
  return (
    <CrudModal
      title={attribute ? 'Изменить атрибут' : 'Новый атрибут'}
      schema={schema}
      defaultValues={{
        name: { ru: attribute ? ru(attribute.name) : initialName, kk: attribute ? kk(attribute.name) : '' },
        slug: attribute?.slug ?? '',
        is_filterable: attribute?.is_filterable ?? false,
      }}
      submitLabel={attribute ? 'Сохранить' : 'Создать'}
      onSubmit={async (values) => {
        const payload = { name: values.name, is_filterable: values.is_filterable, ...(values.slug ? { slug: values.slug } : {}) };
        const res = attribute ? await api.put(`/admin/attributes/${attribute.id}`, payload) : await api.post('/admin/attributes', payload);
        onSaved(res.data.data as Attribute);
      }}
      onClose={onClose}
    >
      {(form) => (
        <>
          <TranslatableField form={form} name="name" label="Название" required />
          <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-700 md:min-h-0">
            <input type="checkbox" {...form.register('is_filterable')} />
            Показывать в фильтрах витрины
          </label>
          <details className="rounded-xl border border-zinc-200 px-3" open={Boolean(form.formState.errors.slug)}>
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-zinc-700 md:min-h-9">Дополнительно</summary>
            <div className="pb-3">
              <Field
                label="Slug"
                htmlFor="attribute-slug"
                hint={attribute ? 'Изменит ссылки фильтров на витрине' : 'Пусто — сделаем из названия'}
                error={form.formState.errors.slug?.message}
              >
                <input id="attribute-slug" className={inputClass} {...form.register('slug')} />
              </Field>
            </div>
          </details>
        </>
      )}
    </CrudModal>
  );
}
```

- [ ] **Step 4: `AttributeRows`**

`admin/src/components/catalog/AttributeRows.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Controller, useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';
import type { Locale } from '@/components/ui/LocaleSwitch';
import SearchSelect from '@/components/ui/SearchSelect';
import { buttonSecondary, inputClass } from '@/components/ui/styles';
import type { Attribute } from '@/lib/catalogTypes';
import { ru } from '@/lib/text';
import AttributeFormSheet from './AttributeFormSheet';
import { emptyAttributeRow, type AttributeRowValue } from './attributeRows';

type WithAttributeRows = { attribute_values: AttributeRowValue[] };

type Props<T extends WithAttributeRows> = {
  form: UseFormReturn<T>;
  attributes: Attribute[];
  onAttributeCreated: (attribute: Attribute) => void;
  /** Язык видимого поля значения; второй язык остаётся в форме. */
  locale: Locale;
};

/**
 * Строки «атрибут → значение» — у товара и у варианта. Атрибут выбирается
 * из справочника или создаётся тут же («+ Создать»); атрибуты, занятые
 * другими строками, в списке не предлагаются.
 */
export default function AttributeRows<T extends WithAttributeRows>({ form: typedForm, attributes, onAttributeCreated, locale }: Props<T>) {
  // Компонент одинаково работает с формой товара и варианта; пути RHF
  // типизируются на их общем срезе.
  const form = typedForm as unknown as UseFormReturn<WithAttributeRows>;
  const { control, register, setValue, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'attribute_values' });
  const rows = useWatch({ control, name: 'attribute_values' }) ?? [];
  const [creating, setCreating] = useState<{ index: number; name: string } | null>(null);
  const [addedIndex, setAddedIndex] = useState<number | null>(null);

  const options = useMemo(
    () => attributes.map((a) => ({ value: String(a.id), label: ru(a.name) || a.slug })).sort((a, b) => a.label.localeCompare(b.label, 'ru')),
    [attributes],
  );

  return (
    <div className="space-y-3">
      {fields.length === 0 && <p className="text-sm text-zinc-500">Характеристик пока нет.</p>}
      <ul className="space-y-3">
        {fields.map((field, index) => {
          const rowErrors = errors.attribute_values?.[index];
          const taken = new Set(rows.filter((_, i) => i !== index).map((r) => r.attribute_id));
          const selectId = `attribute-${field.id}`;
          const valueId = `attribute-value-${field.id}`;
          const message = rowErrors?.attribute_id?.message ?? rowErrors?.value?.ru?.message ?? rowErrors?.value?.kk?.message;

          return (
            <li key={field.id} className="grid grid-cols-[1fr_auto] gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] md:items-start">
              <div className="col-span-2 md:col-span-1">
                <label htmlFor={selectId} className="sr-only">Атрибут</label>
                <Controller
                  control={control}
                  name={`attribute_values.${index}.attribute_id`}
                  render={({ field: select }) => (
                    <SearchSelect
                      id={selectId}
                      options={options.filter((o) => !taken.has(o.value))}
                      value={select.value}
                      onChange={select.onChange}
                      emptyLabel="Выберите атрибут"
                      invalid={Boolean(rowErrors?.attribute_id)}
                      autoFocus={addedIndex === index}
                      onCreate={(name) => setCreating({ index, name })}
                    />
                  )}
                />
              </div>
              <div>
                <label htmlFor={valueId} className="sr-only">{`Значение (${locale.toUpperCase()})`}</label>
                <input
                  key={locale}
                  id={valueId}
                  className={inputClass}
                  placeholder={locale === 'kk' ? rows[index]?.value.ru || 'Қазақша' : 'Значение'}
                  aria-invalid={Boolean(rowErrors?.value?.[locale]) || undefined}
                  {...register(`attribute_values.${index}.value.${locale}`)}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label="Удалить характеристику"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-red-600 md:h-9 md:w-9"
              >
                ✕
              </button>
              {message && (
                <p role="alert" className="col-span-full text-xs text-red-600">
                  {message}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className={buttonSecondary}
        onClick={() => {
          setAddedIndex(fields.length);
          append(emptyAttributeRow(), { shouldFocus: false });
        }}
      >
        + Добавить характеристику
      </button>

      {creating && (
        <AttributeFormSheet
          attribute={null}
          initialName={creating.name}
          onSaved={(attribute) => {
            onAttributeCreated(attribute);
            setValue(`attribute_values.${creating.index}.attribute_id`, String(attribute.id), { shouldDirty: true, shouldValidate: true });
          }}
          onClose={() => setCreating(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Карточка «Характеристики»**

`admin/src/components/products/form/AttributesSection.tsx`:

```tsx
'use client';

import { useWatch, type UseFormReturn } from 'react-hook-form';
import AttributeRows from '@/components/catalog/AttributeRows';
import LocaleSwitch, { type Locale } from '@/components/ui/LocaleSwitch';
import type { Attribute } from '@/lib/catalogTypes';
import FormCard from './FormCard';
import type { ProductFormValues } from './formModel';

type Props = {
  form: UseFormReturn<ProductFormValues>;
  attributes: Attribute[];
  onAttributeCreated: (attribute: Attribute) => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  className?: string;
};

/** Характеристики товара — часть основной формы, сохраняются общей кнопкой. */
export default function AttributesSection({ form, attributes, onAttributeCreated, locale, onLocaleChange, className }: Props) {
  const rows = useWatch({ control: form.control, name: 'attribute_values' });
  const errors = form.formState.errors.attribute_values;
  const missingKk = rows.some((row) => row.value.ru.trim() !== '' && row.value.kk.trim() === '');
  const invalid = (locale: Locale) => rows.some((_, index) => Boolean(errors?.[index]?.value?.[locale]));

  return (
    <FormCard
      id="attributes"
      title="Характеристики"
      className={className}
      aside={<LocaleSwitch value={locale} onChange={onLocaleChange} missing={{ kk: missingKk }} invalid={{ ru: invalid('ru'), kk: invalid('kk') }} />}
    >
      <AttributeRows form={form} attributes={attributes} onAttributeCreated={onAttributeCreated} locale={locale} />
    </FormCard>
  );
}
```

- [ ] **Step 6: `formModel`**

`admin/src/components/products/form/formModel.ts`:
- импорт `import { appendAttributeRows, attributeRowsSchema, toAttributeRows, type ApiAttributeValue } from '@/components/catalog/attributeRows';`
- `ApiProduct`: `/** Характеристики; в ответах show/store/update. */ attribute_values?: ApiAttributeValue[];`
- `productSchema`: `attribute_values: attributeRowsSchema,`
- `emptyProductValues`: `attribute_values: [],`
- `toFormValues`: `attribute_values: toAttributeRows(p.attribute_values),`
- `toFormData`: перед `if (isUpdate)` — `appendAttributeRows(data, values.attribute_values);`
- `revealPlan`: тип результата `{ folds: string[]; basicLocale?: Locale; seoLocale?: Locale; attributesLocale?: Locale }`, в возвращаемый объект:

```ts
    attributesLocale: LOCALES.find((locale) => paths.some((p) => p.startsWith('attribute_values.') && p.endsWith(`.value.${locale}`))),
```

- [ ] **Step 7: `ProductForm` и страница**

`ProductForm.tsx`:
- удалить импорт `AttributeValuesTab` и строку `attributes` из `RELATIONS`; из `FOLDABLE` убрать `'attributes'` (в `SECTIONS` пункт «Характеристики» остаётся — теперь это карточка);
- `Props`: `attributes: Attribute[]` (импорт типа из `@/lib/catalogTypes`);
- состояние:

```tsx
  const [attributeList, setAttributeList] = useState(attributes);
  const [attributesLocale, setAttributesLocale] = useState<Locale>('ru');
```

- в `reveal`: `if (plan.attributesLocale) { setAttributesLocale(plan.attributesLocale); }`
- после `<PriceSection …/>`:

```tsx
        <AttributesSection
          form={form}
          attributes={attributeList}
          onAttributeCreated={(attribute) => setAttributeList((list) => [...list, attribute])}
          locale={attributesLocale}
          onLocaleChange={setAttributesLocale}
          className={LEFT}
        />
```

Число левых карточек не меняется (8), так что `lg:grid-rows-[repeat(7,auto)_1fr]` и `lg:row-span-8` остаются верными.

`admin/src/app/products/[id]/page.tsx`: `Loaded` — `attributes: Attribute[]`; в `Promise.all` добавить
`api.get('/admin/attributes').then((r) => ((r.data?.data ?? []) as Attribute[])).catch((): Attribute[] => [])`; передать `attributes={state.data.attributes}`.

Удалить `admin/src/components/products/AttributeValuesTab.tsx`.

- [ ] **Step 8: Проверка типов и сборка**

Run (из `admin/`): `npx tsc --noEmit && npm run lint && npm run build`
Expected: без ошибок. `grep -rn "AttributeValuesTab\|attribute-values" src` — пусто.

- [ ] **Step 9: e2e — характеристика у нового товара**

`admin/e2e/product-form.spec.ts`: модульный `let createdAttributes: number[] = [];` (сброс в `beforeEach`, в `afterEach` после товаров — `api.delete('/admin/attributes/' + id)`). В тесте «новый товар: одно нажатие — один товар…» заменить четыре строки про заблокированные «Характеристики» и строку `await expect(attributes).toBeEnabled();` на:

```ts
  const attributeName = `E2E размер ${Date.now()}`;
  await page.getByRole("button", { name: "+ Добавить характеристику" }).click();
  await page.getByRole("combobox", { name: "Атрибут" }).fill(attributeName);
  await page.getByRole("option", { name: `+ Создать «${attributeName}»` }).click();
  const sheet = page.getByRole("dialog", { name: "Новый атрибут" });
  await sheet.getByLabel("Название (KK)").fill(`${attributeName} kk`);
  await sheet.getByRole("button", { name: "Создать" }).click();
  await expect(sheet).toBeHidden();
  await page.getByLabel("Значение (RU)").fill("200x90 см");
```

после проверок сохранения:

```ts
  await page.reload();
  await expect(page.getByLabel("Значение (RU)")).toHaveValue("200x90 см");
  const attributes = await adminApi(request).get<{ data: { id: number; slug: string; name: { ru?: string } }[] }>("/admin/attributes");
  const created = attributes?.data.find((a) => a.name.ru === attributeName);
  expect(created).toBeTruthy();
  createdAttributes.push(created!.id);
```

(в сигнатуру теста добавить `request`). Атрибут удаляется в `afterEach` после товара: значения уходят каскадом вместе с товаром, и удаление атрибута не упирается в 422. Отдельный тест:

```ts
test("последняя характеристика удаляется", async ({ page, request }) => {
  const api = adminApi(request);
  const attribute = await api.create<{ data: { id: number } }>("/admin/attributes", { name: { ru: `E2E цвет ${Date.now()}` } });
  createdAttributes.push(attribute.data.id);
  const product = await draftProduct(request, { attribute_values: [{ attribute_id: attribute.data.id, value: { ru: "Серый" } }] });

  await page.goto(`/products/${product.id}`);
  await expect(page.getByLabel("Значение (RU)")).toHaveValue("Серый");
  await page.getByRole("button", { name: "Удалить характеристику" }).click();
  await saveButton(page).click();
  await expect(page.getByText("Сохранено", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Характеристик пока нет.")).toBeVisible();
});
```

Если `adminApi` не умеет `create` с произвольным телом — посмотреть его методы в `e2e/adminApi.ts` и использовать существующий.

Run: `npx playwright test --project=Desktop e2e/product-form.spec.ts` и `--project=Mobile`
Expected: PASS.

- [ ] **Step 10: Коммит**

```bash
git add -A admin/src admin/e2e/product-form.spec.ts
git commit -m "feat(admin): characteristics in the product form, attribute created in place"
```

---

### Task 9: Админка — варианты с характеристиками и фото

**Files:**
- Modify: `admin/src/lib/crud.ts` (тип `Resource<T>`)
- Modify: `admin/src/components/products/form/photos.ts`, `admin/src/components/products/form/PhotosSection.tsx`, `admin/src/components/products/form/ProductForm.tsx`
- Create: `admin/src/components/products/VariantPhotoPicker.tsx`
- Modify: `admin/src/components/products/VariantsTab.tsx` (переписать)
- Create: `admin/e2e/product-variants.spec.ts`

**Interfaces:**
- Consumes: `AttributeRows`, `attributeRowsSchema`, `toAttributeRows`, `attributeRowsPayload` (задача 8); API варианта с `attribute_values`, `media_ids`, `images` (задача 4); `CrudModal.submitDisabled` (задача 8).
- Produces:
  - `export type Resource<T extends { id: number }> = ReturnType<typeof useResource<T>>;`
  - `export type ProductImage = { id: number; file_name: string; url: string; thumb_url: string; order: number | null };`, `uploadPhoto(productId, file): Promise<ProductImage>`
  - `PhotosSection` — проп `images: Resource<ProductImage>` вместо своего запроса
  - `VariantsTab({ productId, onCount, images, attributes, onAttributeCreated })`

- [ ] **Step 1: Общие типы и загрузка фото**

`admin/src/lib/crud.ts` — в конце: 

```ts
/** Что возвращает useResource — для передачи одного списка нескольким компонентам. */
export type Resource<T extends { id: number }> = ReturnType<typeof useResource<T>>;
```

`photos.ts`:

```ts
/** Фото товара, как его отдаёт `/admin/products/{id}/media`. */
export type ProductImage = { id: number; file_name: string; url: string; thumb_url: string; order: number | null };
```

`uploadPhoto` → `Promise<ProductImage>`: `const res = await api.post<{ data: ProductImage }>(…); return res.data.data;` (докблок: «…Возвращает загруженное фото»).

- [ ] **Step 2: Один список фото на карточку**

`PhotosSection.tsx`: убрать локальный `type Image` и `useResource`; проп `images: Resource<ProductImage>`; `const path = productId ? \`/admin/products/${productId}/media\` : null;` остаётся для `order`. Остальной код работает с `images.items` / `images.reload()` / `images.remove()` как раньше. Докблок: «Список фото держит ProductForm — его же читает окно варианта».

`ProductForm.tsx`:

```tsx
  const images = useResource<ProductImage>(productId ? `/admin/products/${productId}/media` : null);
```

и `<PhotosSection … images={images} />`.

- [ ] **Step 3: Выбор фото варианта**

`admin/src/components/products/VariantPhotoPicker.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { PHOTO_ACCEPT, photoProblem, reportPhotoError, uploadPhoto, type ProductImage } from './form/photos';
import { toast } from '@/stores/toastStore';

type Props = {
  productId: number;
  /** Галерея товара. */
  images: ProductImage[];
  /** id фото варианта по порядку. */
  selected: number[];
  onToggle: (id: number) => void;
  /** Фото загружено в галерею — отметить его и обновить галерею. */
  onUploaded: (image: ProductImage) => void;
  onUploadingChange: (uploading: boolean) => void;
};

/**
 * Фото варианта — отметки на фото товара. Номер на плитке — порядок у
 * варианта. «+ Загрузить» кладёт файл в галерею товара и сразу отмечает.
 */
export default function VariantPhotoPicker({ productId, images, selected, onToggle, onUploaded, onUploadingChange }: Props) {
  const [uploading, setUploading] = useState(0);

  const upload = async (files: FileList | null) => {
    const accepted = Array.from(files ?? []).filter((file) => {
      const problem = photoProblem(file);
      if (problem) {
        toast.error(problem);
      }

      return problem === null;
    });

    if (accepted.length === 0) {
      return;
    }

    setUploading((n) => n + accepted.length);
    onUploadingChange(true);

    for (const file of accepted) {
      try {
        onUploaded(await uploadPhoto(productId, file));
      } catch (error) {
        reportPhotoError(file, error);
      } finally {
        setUploading((n) => {
          const left = n - 1;
          if (left === 0) {
            onUploadingChange(false);
          }

          return left;
        });
      }
    }
  };

  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {images.map((image) => {
        const position = selected.indexOf(image.id);
        const checked = position !== -1;

        return (
          <li key={image.id}>
            <button
              type="button"
              aria-pressed={checked}
              aria-label={`Фото ${image.file_name}${checked ? `, ${position + 1}-е у варианта` : ''}`}
              onClick={() => onToggle(image.id)}
              className={`relative block w-full overflow-hidden rounded-lg border-2 ${checked ? 'border-blue-600' : 'border-transparent'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.thumb_url} alt="" className={`aspect-square w-full object-cover ${checked ? '' : 'opacity-60'}`} />
              {checked && (
                <span className="absolute top-1 left-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
                  {position + 1}
                </span>
              )}
            </button>
          </li>
        );
      })}
      <li>
        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 p-2 text-center text-xs text-zinc-500 hover:bg-zinc-50 focus-within:border-blue-500">
          <span aria-hidden className="text-2xl leading-none">＋</span>
          <span>{uploading > 0 ? 'Загружаем…' : 'Загрузить'}</span>
          <input
            type="file"
            multiple
            accept={PHOTO_ACCEPT}
            className="sr-only"
            aria-label="Загрузить фото варианта"
            onChange={(e) => {
              void upload(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </li>
    </ul>
  );
}
```

- [ ] **Step 4: `VariantsTab`**

`admin/src/components/products/VariantsTab.tsx` — переписать целиком:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import AttributeRows from '@/components/catalog/AttributeRows';
import { attributeRowsPayload, attributeRowsSchema, toAttributeRows, type ApiAttributeValue } from '@/components/catalog/attributeRows';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import LocaleSwitch, { type Locale } from '@/components/ui/LocaleSwitch';
import MoneyInput from '@/components/ui/MoneyInput';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';
import type { Attribute } from '@/lib/catalogTypes';
import { useResource, type Resource } from '@/lib/crud';
import { formatTenge, TENGE_PATTERN, tiynToTenge } from '@/lib/money';
import { ru } from '@/lib/text';
import { REQUIRED } from '@/lib/validation';
import type { ProductImage } from './form/photos';
import VariantPhotoPicker from './VariantPhotoPicker';

type Variant = {
  id: number;
  name: string;
  code: string | null;
  retail_price: number | null;
  b2b_price: number | null;
  stock: string;
  barcodes: string[] | null;
  attribute_values: ApiAttributeValue[];
  images: ProductImage[];
};

const optionalTenge = z.string().refine((v) => v === '' || TENGE_PATTERN.test(v), 'Сумма в ₸, до двух знаков после точки');

const schema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  code: z.string().max(255),
  retail_price: optionalTenge,
  b2b_price: optionalTenge,
  barcodes: z.string(),
  attribute_values: attributeRowsSchema,
  media_ids: z.array(z.number()),
});

type VariantForm = z.infer<typeof schema>;

const toForm = (v: Variant | null): VariantForm => ({
  name: v?.name ?? '',
  code: v?.code ?? '',
  retail_price: tiynToTenge(v?.retail_price),
  b2b_price: tiynToTenge(v?.b2b_price),
  barcodes: (v?.barcodes ?? []).join('\n'),
  attribute_values: toAttributeRows(v?.attribute_values),
  media_ids: (v?.images ?? []).map((image) => image.id),
});

const toPayload = (f: VariantForm) => ({
  name: f.name,
  code: f.code,
  retail_price: f.retail_price,
  b2b_price: f.b2b_price,
  barcodes: f.barcodes.split('\n').map((s) => s.trim()).filter(Boolean),
  attribute_values: attributeRowsPayload(f.attribute_values),
  media_ids: f.media_ids,
});

/** «Серый · 200×90» — значения характеристик одной строкой. */
const summary = (v: Variant): string => v.attribute_values.map((a) => ru(a.value)).filter(Boolean).join(' · ');

type Props = {
  productId: number;
  onCount?: (count: number) => void;
  /** Галерея товара — из неё отмечаются фото варианта. */
  images: Resource<ProductImage>;
  attributes: Attribute[];
  onAttributeCreated: (attribute: Attribute) => void;
};

export default function VariantsTab({ productId, onCount, images, attributes, onAttributeCreated }: Props) {
  const variants = useResource<Variant>(`/admin/products/${productId}/variants`);
  const [editing, setEditing] = useState<Variant | null | undefined>(undefined);
  const [uploading, setUploading] = useState(false);

  // Счётчик для заголовка блока — только когда список уже загружен.
  useEffect(() => {
    if (!variants.loading) {
      onCount?.(variants.items.length);
    }
  }, [variants.loading, variants.items.length, onCount]);

  const columns: Column<Variant>[] = [
    {
      key: 'name',
      header: 'Вариант',
      mobile: 'title',
      render: (v) => (
        <div className="flex items-center gap-3">
          {v.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.images[0].thumb_url} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
          ) : (
            <span aria-hidden className="h-10 w-10 shrink-0 rounded-md bg-zinc-100" />
          )}
          <div className="min-w-0">
            <span className="font-medium text-zinc-900">{v.name}</span>
            {summary(v) && <span className="block truncate text-xs text-zinc-500">{summary(v)}</span>}
          </div>
        </div>
      ),
    },
    { key: 'code', header: 'Код', mobile: 'meta', render: (v) => v.code ?? '—' },
    { key: 'retail', header: 'Розница', render: (v) => formatTenge(v.retail_price) },
    { key: 'b2b', header: 'Опт', render: (v) => formatTenge(v.b2b_price) },
    { key: 'stock', header: 'Остаток', render: (v) => Number(v.stock) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      mobile: 'actions',
      render: (v) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(v)}>Изменить</button>
          <ConfirmButton onConfirm={() => variants.remove(v.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  const close = () => {
    setEditing(undefined);
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить вариант</button>
      <DataTable columns={columns} rows={variants.items} loading={variants.loading} emptyText="Вариантов нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить вариант' : 'Новый вариант'}
          schema={schema}
          defaultValues={toForm(editing)}
          submitDisabled={uploading}
          onSubmit={(f) => (editing ? variants.update(editing.id, toPayload(f)) : variants.create(toPayload(f)))}
          onClose={close}
        >
          {(form) => (
            <VariantFields
              form={form}
              productId={productId}
              images={images}
              attributes={attributes}
              onAttributeCreated={onAttributeCreated}
              onUploadingChange={setUploading}
            />
          )}
        </CrudModal>
      )}
    </div>
  );
}

type FieldsProps = {
  form: UseFormReturn<VariantForm>;
  productId: number;
  images: Resource<ProductImage>;
  attributes: Attribute[];
  onAttributeCreated: (attribute: Attribute) => void;
  onUploadingChange: (uploading: boolean) => void;
};

/** Поля окна варианта — отдельным компонентом, чтобы в нём работали хуки. */
function VariantFields({ form, productId, images, attributes, onAttributeCreated, onUploadingChange }: FieldsProps) {
  const [locale, setLocale] = useState<Locale>('ru');
  const selected = useWatch({ control: form.control, name: 'media_ids' });
  const { errors } = form.formState;

  const setPhotos = (ids: number[]) => form.setValue('media_ids', ids, { shouldDirty: true });

  return (
    <>
      <Field label="Название *" htmlFor="v-name" error={errors.name?.message}>
        <input id="v-name" className={inputClass} {...form.register('name')} />
      </Field>
      <Field label="Код" htmlFor="v-code" error={errors.code?.message}>
        <input id="v-code" className={inputClass} {...form.register('code')} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Розничная цена, ₸" htmlFor="v-retail" error={errors.retail_price?.message}>
          <MoneyInput id="v-retail" {...form.register('retail_price')} />
        </Field>
        <Field label="Оптовая цена, ₸" htmlFor="v-b2b" error={errors.b2b_price?.message}>
          <MoneyInput id="v-b2b" {...form.register('b2b_price')} />
        </Field>
      </div>

      <section aria-label="Характеристики варианта" className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-zinc-700">Характеристики</h3>
          <LocaleSwitch value={locale} onChange={setLocale} />
        </div>
        <AttributeRows form={form} attributes={attributes} onAttributeCreated={onAttributeCreated} locale={locale} />
      </section>

      <section aria-label="Фото варианта" className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-700">Фото</h3>
        <VariantPhotoPicker
          productId={productId}
          images={images.items}
          selected={selected}
          onToggle={(id) => {
            const current = form.getValues('media_ids');
            setPhotos(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
          }}
          onUploaded={(image) => {
            setPhotos([...form.getValues('media_ids'), image.id]);
            void images.reload();
          }}
          onUploadingChange={onUploadingChange}
        />
      </section>

      <details className="rounded-xl border border-zinc-200 px-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-zinc-700 md:min-h-9">Ещё</summary>
        <div className="pb-3">
          <Field label="Штрихкоды" htmlFor="v-barcodes" hint="По одному на строку" error={errors.barcodes?.message}>
            <textarea id="v-barcodes" rows={2} className={inputClass} {...form.register('barcodes')} />
          </Field>
        </div>
      </details>
      <p className="text-xs text-zinc-500">Остаток варианта здесь не меняется — только приёмками и заказами.</p>
    </>
  );
}
```

- [ ] **Step 5: Подключить в `ProductForm`**

- `RELATIONS` — только `prices` и `client-prices` (убрать `variants`).
- `countSetters` строить по `[...RELATIONS.map((r) => r.id), 'variants']`.
- Разметку блока вынести в функцию внутри компонента и отрисовать варианты отдельно:

```tsx
  const relationBlock = (id: string, title: string, forms: [string, string, string], content: ReactNode) => {
    const count = counts[id];

    return (
      <div key={id} className={LEFT}>
        <Collapsible
          id={id}
          title={title}
          note="Сохраняется сразу"
          summary={count === undefined ? null : count === 0 ? 'нет' : `${count} ${plural(count, forms)}`}
          open={open.has(id)}
          onToggle={toggle(id)}
          disabledHint={productId === null ? 'Доступно после сохранения товара' : undefined}
        >
          {productId !== null && content}
        </Collapsible>
      </div>
    );
  };
```

```tsx
        {RELATIONS.map(({ id, title, forms, Tab }) =>
          relationBlock(id, title, forms, productId !== null && <Tab productId={productId} onCount={countSetters[id]} />),
        )}
        {relationBlock(
          'variants',
          'Варианты',
          ['вариант', 'варианта', 'вариантов'],
          productId !== null && (
            <VariantsTab
              productId={productId}
              onCount={countSetters.variants}
              images={images}
              attributes={attributeList}
              onAttributeCreated={(attribute) => setAttributeList((list) => [...list, attribute])}
            />
          ),
        )}
```

(импорт `type ReactNode`; `ComponentType` остаётся для `RELATIONS`.) Число левых карточек не меняется.

- [ ] **Step 6: Проверка типов и сборка**

Run (из `admin/`): `npx tsc --noEmit && npm run lint && npm run build`
Expected: без ошибок.

- [ ] **Step 7: e2e вариантов**

`admin/e2e/product-variants.spec.ts`:

```ts
import path from "node:path";
import { test, expect } from "@playwright/test";
import { adminApi } from "./adminApi";
import { ADMIN_SESSION } from "./session";

/**
 * Вариант: характеристика из справочника (в том числе созданная прямо в окне
 * варианта) и фото, загруженное из окна варианта в галерею товара. Товар —
 * выключенный, свой; атрибуты — свои; всё удаляется в afterEach.
 */
test.use({ storageState: ADMIN_SESSION });

const PIXEL = path.join(__dirname, "assets/pixel.png");

let productIds: number[] = [];
let attributeIds: number[] = [];

test.beforeEach(({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  productIds = [];
  attributeIds = [];
});

test.afterEach(async ({ request }) => {
  const api = adminApi(request);

  for (const id of productIds) {
    await api.delete(`/admin/products/${id}`);
  }
  for (const id of attributeIds) {
    await api.delete(`/admin/attributes/${id}`);
  }
});

test("вариант: характеристика, созданная в окне, и фото загрузкой", async ({ page, request }) => {
  const api = adminApi(request);
  const stamp = Date.now();
  const product = await api.create<{ data: { id: number } }>("/admin/products", { name: { ru: `E2E вариант ${stamp}` }, is_active: false });
  productIds.push(product.data.id);
  const colorName = `E2E цвет ${stamp}`;

  await page.goto(`/products/${product.data.id}`);
  await page.getByRole("button", { name: /^Варианты/ }).click();
  await page.getByRole("button", { name: "Добавить вариант" }).click();

  const variant = page.getByRole("dialog", { name: "Новый вариант" });
  await variant.getByLabel("Название *").fill("Серый");
  await variant.getByRole("button", { name: "+ Добавить характеристику" }).click();
  await variant.getByRole("combobox", { name: "Атрибут" }).fill(colorName);
  await variant.getByRole("option", { name: `+ Создать «${colorName}»` }).click();

  // Шторка поверх окна варианта: «Создать» не сохраняет вариант, Esc закрывает только её.
  const sheet = page.getByRole("dialog", { name: "Новый атрибут" });
  await sheet.getByRole("button", { name: "Создать" }).click();
  await expect(sheet).toBeHidden();
  await expect(variant).toBeVisible();
  await variant.getByLabel("Значение (RU)").fill("Графит");

  await variant.getByRole("button", { name: "+ Добавить характеристику" }).click();
  await variant.getByRole("combobox", { name: "Атрибут" }).nth(1).fill(`${colorName} второй`);
  await variant.getByRole("option", { name: `+ Создать «${colorName} второй»` }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Новый атрибут" })).toBeHidden();
  await expect(variant).toBeVisible();
  await variant.getByRole("button", { name: "Удалить характеристику" }).nth(1).click();

  await variant.getByLabel("Загрузить фото варианта").setInputFiles(PIXEL);
  await expect(variant.getByRole("button", { name: /1-е у варианта/ })).toBeVisible();
  await variant.getByRole("button", { name: "Сохранить" }).click();
  await expect(variant).toBeHidden();

  // Строка варианта: название и характеристики одной строкой под ним.
  await expect(page.getByText("Графит", { exact: true })).toBeVisible();
  await expect(page.getByTestId("product-image")).toHaveCount(1);

  const attributes = await api.get<{ data: { id: number; name: { ru?: string } }[] }>("/admin/attributes");
  attributeIds.push(...(attributes?.data ?? []).filter((a) => a.name.ru?.startsWith(colorName)).map((a) => a.id));
  const variants = await api.get<{ data: { images: { id: number }[]; attribute_values: unknown[] }[] }>(`/admin/products/${product.data.id}/variants`);
  expect(variants?.data[0].images).toHaveLength(1);
  expect(variants?.data[0].attribute_values).toHaveLength(1);
});
```

Товар удаляется раньше атрибутов: значения варианта уходят каскадом с товаром, после чего атрибут удаляется без 422.

Run: `npx playwright test --project=Desktop e2e/product-variants.spec.ts` и `--project=Mobile`; затем `e2e/product-relations.spec.ts` (фото товара — общий список теперь в `ProductForm`).
Expected: PASS.

- [ ] **Step 8: Коммит**

```bash
git add -A admin/src admin/e2e/product-variants.spec.ts
git commit -m "feat(admin): variant characteristics and photos from the product gallery"
```

---

### Task 10: Админка — экран «Атрибуты»

**Files:**
- Create: `admin/src/components/catalog/attributeFilters.ts`
- Modify: `admin/src/app/attributes/page.tsx` (переписать)
- Modify: `admin/src/components/ui/ActionSheet.tsx` (неактивный пункт с пояснением)
- Modify: `admin/e2e/attributes.spec.ts` (переписать под новый экран)

**Interfaces:**
- Consumes: `AttributeFormSheet` (задача 8), `GET /admin/attributes` с `values_count`, `variant_values_count`; `PUT /admin/attributes/{id}`.
- Produces: `SheetAction` — необязательные `disabled?: boolean`, `hint?: string`; `attributeFilters.ts`: `type AttributeFilter = '' | 'filterable' | 'untranslated' | 'unused'`, `parseAttributeFilter(v: string | null)`, `usage(a)`, `matchesAttribute(a, filter, search)`, `usageText(a)`.

- [ ] **Step 1: Фильтры списка**

`admin/src/components/catalog/attributeFilters.ts`:

```ts
import type { Attribute } from '@/lib/catalogTypes';
import { kk, plural, ru } from '@/lib/text';

/** Чипы экрана «Атрибуты». Атрибутов десятки — фильтрация на клиенте. */
export type AttributeFilter = '' | 'filterable' | 'untranslated' | 'unused';

const FILTERS: AttributeFilter[] = ['', 'filterable', 'untranslated', 'unused'];

export const parseAttributeFilter = (value: string | null): AttributeFilter =>
  FILTERS.includes(value as AttributeFilter) ? (value as AttributeFilter) : '';

/** Сколько раз атрибут стоит у товаров и вариантов. */
export const usage = (a: Attribute): number => (a.values_count ?? 0) + (a.variant_values_count ?? 0);

export function matchesAttribute(a: Attribute, filter: AttributeFilter, search: string): boolean {
  if (filter === 'filterable' && !a.is_filterable) {
    return false;
  }
  if (filter === 'untranslated' && kk(a.name).trim() !== '') {
    return false;
  }
  if (filter === 'unused' && usage(a) > 0) {
    return false;
  }

  const needle = search.trim().toLocaleLowerCase('ru');

  return needle === '' || [ru(a.name), kk(a.name), a.slug].some((text) => text.toLocaleLowerCase('ru').includes(needle));
}

/** «в 12 товарах · 3 вариантах» или «не используется». */
export function usageText(a: Attribute): string {
  const products = a.values_count ?? 0;
  const variants = a.variant_values_count ?? 0;
  const parts = [
    products > 0 ? `${products} ${plural(products, ['товаре', 'товарах', 'товарах'])}` : null,
    variants > 0 ? `${variants} ${plural(variants, ['варианте', 'вариантах', 'вариантах'])}` : null,
  ].filter(Boolean);

  return parts.length === 0 ? 'не используется' : `в ${parts.join(' · ')}`;
}
```

- [ ] **Step 2: `ActionSheet` — неактивный пункт**

`SheetAction`: `/** Пункт виден, но не нажимается; `hint` — почему. */ disabled?: boolean; hint?: string;`. Кнопка: `disabled={action.disabled}`, класс дополнить `disabled:text-zinc-400`, внутри:

```tsx
              <span className="flex flex-col py-2">
                {action.label}
                {action.hint && <span className="text-xs text-zinc-500">{action.hint}</span>}
              </span>
```

- [ ] **Step 3: Экран**

`admin/src/app/attributes/page.tsx`:

```tsx
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AttributeFormSheet from '@/components/catalog/AttributeFormSheet';
import { matchesAttribute, parseAttributeFilter, usage, usageText } from '@/components/catalog/attributeFilters';
import ActionSheet from '@/components/ui/ActionSheet';
import ConfirmButton from '@/components/ui/ConfirmButton';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import FilterChips from '@/components/ui/FilterChips';
import PageHeader from '@/components/ui/PageHeader';
import Switch from '@/components/ui/Switch';
import { buttonDanger, buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';
import api from '@/lib/api';
import type { Attribute } from '@/lib/catalogTypes';
import { useResource } from '@/lib/crud';
import { serverMessage } from '@/lib/errors';
import { kk, ru } from '@/lib/text';
import { useIsDesktop } from '@/lib/useIsDesktop';
import { toast } from '@/stores/toastStore';

/** Поиск и чип живут в адресе: F5 и «назад» открывают тот же список. */
function AttributesView() {
  const params = useSearchParams();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const attributes = useResource<Attribute>('/admin/attributes');
  const [editing, setEditing] = useState<Attribute | null | undefined>(undefined);
  const [menuFor, setMenuFor] = useState<Attribute | null>(null);
  // Переключатель «В фильтрах» меняется сразу; при ошибке значение возвращается.
  const [pendingFilterable, setPendingFilterable] = useState<Record<number, boolean>>({});

  const filter = parseAttributeFilter(params.get('filter'));
  const search = params.get('q') ?? '';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    router.replace(`/attributes?${next.toString()}`, { scroll: false });
  };

  const rows = attributes.items.filter((a) => matchesAttribute(a, filter, search));
  const count = (f: Parameters<typeof matchesAttribute>[1]) => attributes.items.filter((a) => matchesAttribute(a, f, '')).length;

  const toggleFilterable = async (a: Attribute, next: boolean) => {
    setPendingFilterable((p) => ({ ...p, [a.id]: next }));

    try {
      await api.put(`/admin/attributes/${a.id}`, { name: { ru: ru(a.name), kk: kk(a.name) }, slug: a.slug, is_filterable: next });
      await attributes.reload();
      toast.success(next ? 'Показывается в фильтрах витрины' : 'Убран из фильтров витрины');
    } catch (error) {
      toast.error(serverMessage(error) ?? 'Не удалось сохранить');
    } finally {
      setPendingFilterable((pending) => {
        const next = { ...pending };
        delete next[a.id];

        return next;
      });
    }
  };

  const deleteHint = (a: Attribute) => (usage(a) > 0 ? `Используется ${usageText(a)} — сначала удалите значения` : undefined);

  const columns: Column<Attribute>[] = [
    {
      key: 'name',
      header: 'Название',
      mobile: 'title',
      render: (a) => (
        <div>
          <span className="font-medium text-zinc-900">{ru(a.name)}</span>
          {kk(a.name) ? (
            <span className="block text-xs text-zinc-500">{kk(a.name)}</span>
          ) : (
            <span className="block text-xs text-amber-700">нет перевода на казахский</span>
          )}
        </div>
      ),
    },
    { key: 'slug', header: 'Slug', mobile: 'meta', render: (a) => <span className="text-zinc-500">{a.slug}</span> },
    { key: 'usage', header: 'Используется', render: (a) => usageText(a) },
    {
      key: 'filterable',
      header: 'В фильтрах',
      render: (a) => (
        <Switch checked={pendingFilterable[a.id] ?? a.is_filterable} onChange={(next) => void toggleFilterable(a, next)} label="В фильтрах" />
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      mobile: 'actions',
      render: (a) =>
        isDesktop ? (
          <div className="flex justify-end gap-4">
            <button type="button" className={buttonLink} onClick={() => setEditing(a)}>Изменить</button>
            {usage(a) > 0 ? (
              <button type="button" disabled className={buttonDanger} title={deleteHint(a)}>Удалить</button>
            ) : (
              <ConfirmButton onConfirm={() => attributes.remove(a.id)}>Удалить</ConfirmButton>
            )}
          </div>
        ) : (
          <button type="button" aria-label={`Действия: ${ru(a.name)}`} className={buttonLink} onClick={() => setMenuFor(a)}>⋯ Действия</button>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Атрибуты"
        actions={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить атрибут</button>}
      />
      <input
        type="search"
        aria-label="Поиск атрибута"
        placeholder="Название или slug"
        className={`${inputClass} md:max-w-sm`}
        defaultValue={search}
        onChange={(e) => setParam('q', e.target.value)}
      />
      <FilterChips
        label="Показать"
        value={filter}
        onChange={(value) => setParam('filter', value)}
        options={[
          { value: '', label: 'Все', count: attributes.loading ? null : attributes.items.length },
          { value: 'filterable', label: 'В фильтрах витрины', count: attributes.loading ? null : count('filterable') },
          { value: 'untranslated', label: 'Без перевода', count: attributes.loading ? null : count('untranslated') },
          { value: 'unused', label: 'Не используются', count: attributes.loading ? null : count('unused') },
        ]}
      />
      <DataTable
        columns={columns}
        rows={rows}
        loading={attributes.loading}
        rowKey={(a) => a.id}
        empty={
          attributes.items.length === 0 ? (
            <EmptyState
              title="Атрибутов пока нет"
              hint="Создайте первый или добавьте прямо в карточке товара"
              action={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить атрибут</button>}
            />
          ) : (
            <EmptyState title="Ничего не найдено" hint="Измените поиск или фильтр" />
          )
        }
      />

      {editing !== undefined && (
        <AttributeFormSheet attribute={editing} onSaved={() => void attributes.reload()} onClose={() => setEditing(undefined)} />
      )}
      {menuFor && (
        <ActionSheet
          title={ru(menuFor.name)}
          onClose={() => setMenuFor(null)}
          actions={[
            { key: 'edit', label: 'Изменить', onSelect: () => setEditing(menuFor) },
            {
              key: 'delete',
              label: 'Удалить',
              destructive: true,
              disabled: usage(menuFor) > 0,
              hint: deleteHint(menuFor),
              onSelect: () => {
                if (window.confirm('Удалить? Это действие необратимо.')) {
                  void attributes.remove(menuFor.id);
                }
              },
            },
          ]}
        />
      )}
    </div>
  );
}

export default function AttributesPage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense fallback={null}>
      <AttributesView />
    </Suspense>
  );
}
```

Поиск пишется в адрес на каждое нажатие через `router.replace` — если на телефоне это заметно тормозит, отложить запись на 300 мс (`setTimeout` в обработчике со сбросом), не меняя поведения фильтрации.

- [ ] **Step 4: Проверка типов и сборка**

Run (из `admin/`): `npx tsc --noEmit && npm run lint && npm run build`
Expected: без ошибок.

- [ ] **Step 5: e2e экрана**

Переписать `admin/e2e/attributes.spec.ts` (страховочный `afterEach` оставить, но искать по `name.ru` с префиксом метки, т. к. slug теперь генерирует сервер). Тесты:

```ts
test("атрибут создаётся без slug, переводится, правится и удаляется", async ({ page }) => {
  const name = `E2E цвет ${Date.now()}`;
  createdNames.push(name);

  await page.goto("/attributes");
  await page.getByRole("button", { name: "Добавить атрибут" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Новый атрибут" });
  await dialog.getByLabel("Название (RU) *").fill(name);
  await dialog.getByRole("button", { name: "Создать" }).click();
  await expect(dialog).toBeHidden();

  await page.getByLabel("Поиск атрибута").fill(name);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByText("нет перевода на казахский")).toBeVisible();
  await expect(page.getByText("не используется")).toBeVisible();

  await page.getByRole("radio", { name: /Без перевода/ }).click();
  await expect(page).toHaveURL(/filter=untranslated/);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
});

test("переключатель «В фильтрах» сохраняется сразу", async ({ page, request }) => {
  const name = `E2E фильтр ${Date.now()}`;
  createdNames.push(name);
  await adminApi(request).create("/admin/attributes", { name: { ru: name } });

  await page.goto(`/attributes?q=${encodeURIComponent(name)}`);
  await page.getByRole("switch").first().click();
  await expect(page.getByText("Показывается в фильтрах витрины")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("switch").first()).toHaveAttribute("aria-checked", "true");
});

test("используемый атрибут удалить нельзя", async ({ page, request }) => {
  const api = adminApi(request);
  const name = `E2E занят ${Date.now()}`;
  createdNames.push(name);
  const attribute = await api.create<{ data: { id: number } }>("/admin/attributes", { name: { ru: name } });
  const product = await api.create<{ data: { id: number } }>("/admin/products", {
    name: { ru: `E2E товар ${Date.now()}` },
    is_active: false,
    attribute_values: [{ attribute_id: attribute.data.id, value: { ru: "Серый" } }],
  });
  createdProducts.push(product.data.id);

  await page.goto(`/attributes?q=${encodeURIComponent(name)}`);
  await expect(page.getByText("в 1 товаре")).toBeVisible();
  // ПК — неактивная кнопка, телефон — неактивный пункт шторки.
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    await expect(page.getByRole("button", { name: "Удалить" })).toBeDisabled();
  } else {
    await page.getByRole("button", { name: `Действия: ${name}` }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: /Удалить/ })).toBeDisabled();
  }
});
```

`createdProducts` удаляются в `afterEach` раньше атрибутов (каскад значений). Страховка ищет атрибуты по `a.name.ru` из `createdNames`.

Run: `npx playwright test --project=Desktop e2e/attributes.spec.ts` и `--project=Mobile`
Expected: PASS.

- [ ] **Step 6: Коммит**

```bash
git add -A admin/src admin/e2e/attributes.spec.ts
git commit -m "feat(admin): attributes screen with search, chips, translations and usage"
```

---

### Task 11: Админка — выбор B2B-клиента со списком сразу

**Files:**
- Modify: `admin/src/components/ui/EntityPicker.tsx` (переписать)
- Modify: `admin/src/lib/text.ts` (`ClientRef`)
- Modify: `admin/src/components/products/ClientPricesTab.tsx`
- Modify: `admin/e2e/product-relations.spec.ts`

**Interfaces:**
- Consumes: `GET /admin/users?sort=company_name` (задача 6).
- Produces: `EntityPicker` — новые необязательные пропсы `description?: (item: T) => ReactNode`, `sort?: string`, `allExcludedText?: string`; открывается по фокусу без ввода. `ClientRef` += `name: string | null; is_approved?: boolean`.

- [ ] **Step 1: `EntityPicker`**

```tsx
'use client';

import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import api from '@/lib/api';
import { inputClass } from './styles';

type Props<T extends { id: number }> = {
  searchPath: string;
  label: (item: T) => string;
  onPick: (item: T) => unknown;
  placeholder: string;
  excludeIds?: number[];
  /** Вторая строка пункта: имя, телефон, метка. */
  description?: (item: T) => ReactNode;
  /** `sort` Spatie Query Builder — порядок и без ввода, и с ним. */
  sort?: string;
  /** Когда всё найденное исключено через excludeIds. */
  allExcludedText?: string;
};

/**
 * Выбор записи из админского списка с `filter[search]`. При фокусе сразу
 * показывает первую страницу списка, ввод фильтрует (с паузой 300 мс);
 * стрелки, Enter и Escape — с клавиатуры. Пункт выбирается на mousedown с
 * preventDefault — иначе blur поля закрыл бы список раньше клика.
 */
export default function EntityPicker<T extends { id: number }>({
  searchPath,
  label,
  onPick,
  placeholder,
  excludeIds = [],
  description,
  sort,
  allExcludedText = 'Все уже выбраны',
}: Props<T>) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    const term = query.trim();

    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const res = await api.get(searchPath, { params: { ...(sort ? { sort } : {}), ...(term ? { 'filter[search]': term } : {}) } });

        if (!cancelled) {
          setResults((res.data?.data ?? res.data ?? []) as T[]);
          setActive(0);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, term ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, searchPath, sort]);

  const visible = results.filter((r) => !excludeIds.includes(r.id));

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = async (item: T) => {
    close();
    await onPick(item);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(visible.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && visible[active]) {
      e.preventDefault();
      void pick(visible[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  };

  const status = loading && results.length === 0
    ? 'Загрузка…'
    : visible.length === 0
      ? results.length > 0 ? allExcludedText : 'Ничего не найдено'
      : null;

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && visible[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={inputClass}
        placeholder={placeholder}
        aria-label={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {status ? (
            <li className="px-3 py-2 text-sm text-zinc-500">{status}</li>
          ) : (
            visible.map((item, index) => (
              <li
                key={item.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void pick(item);
                }}
                onMouseEnter={() => setActive(index)}
                className={`flex min-h-11 cursor-pointer flex-col justify-center px-3 py-1.5 text-sm md:min-h-9 ${index === active ? 'bg-zinc-100' : ''}`}
              >
                <span className="text-zinc-900">{label(item)}</span>
                {description && <span className="text-xs text-zinc-500">{description(item)}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Клиенты в ценах**

`admin/src/lib/text.ts`: `export type ClientRef = { id: number; company_name: string | null; name: string | null; email: string | null; phone: string | null; is_approved?: boolean };`

`ClientPricesTab.tsx` — `EntityPicker`:

```tsx
                  <EntityPicker<ClientRef>
                    searchPath="/admin/users"
                    sort="company_name"
                    placeholder="Найти B2B-клиента"
                    label={(c) => c.company_name || c.name || `Клиент #${c.id}`}
                    description={(c) => (
                      <>
                        {[c.company_name ? c.name : null, c.phone || c.email].filter(Boolean).join(' · ')}
                        {c.is_approved === false && <span className="ml-2 rounded bg-amber-100 px-1.5 text-amber-800">не одобрен</span>}
                      </>
                    )}
                    allExcludedText="Все клиенты уже с ценой"
                    excludeIds={prices.items.map((p) => p.user_id)}
                    onPick={(c) => {
                      setPicked(c);
                      form.setValue('user_id', String(c.id), { shouldValidate: true });
                    }}
                  />
```

Другие места `EntityPicker` (`grep -rn "EntityPicker" admin/src`) не меняются — получают список по фокусу автоматически. Проверить глазами в Step 4, что их списки по фокусу разумны (первая страница эндпоинта).

- [ ] **Step 3: Проверка типов и сборка**

Run (из `admin/`): `npx tsc --noEmit && npm run lint && npm run build`

- [ ] **Step 4: e2e**

В `admin/e2e/product-relations.spec.ts`:

```ts
test("цена клиента: список B2B-клиентов виден без ввода", async ({ page, request }) => {
  const clients = await adminApi(request).get<{ data: { id: number }[] }>("/admin/users");
  test.skip(!clients?.data?.length, "В базе нет B2B-клиентов");
  const product = await requireInStockProduct(request);

  await page.goto(`/products/${product.id}`);
  await page.getByRole("button", { name: /^Цены для клиентов B2B/ }).click();
  await page.getByRole("button", { name: "Добавить цену клиента" }).click();
  await page.getByRole("dialog").getByRole("combobox", { name: "Найти B2B-клиента" }).click();
  await expect(page.getByRole("dialog").getByRole("option").first()).toBeVisible();
});
```

(если `requireInStockProduct` в этом файле вызывается иначе — повторить его вызов из соседнего теста.) Тест ничего не сохраняет.

Run: `npx playwright test --project=Desktop e2e/product-relations.spec.ts` и `--project=Mobile`; плюс `e2e/catalog-groups.spec.ts` (там тоже `EntityPicker`).
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add admin/src admin/e2e/product-relations.spec.ts
git commit -m "fix(admin): client picker lists B2B clients on focus"
```

---

### Task 12: Витрина и B2B-портал — фасеты `{value, label}`, фото варианта

**Files:**
- Modify: `storefront/src/lib/types.ts`, `storefront/src/components/FilterSidebar.tsx`, `storefront/src/components/ActiveFilters.tsx`, `storefront/src/components/CatalogView.tsx`
- Create: `storefront/src/components/product/SelectedVariant.tsx`, `storefront/src/components/product/VariantGallery.tsx`
- Modify: `storefront/src/components/product/ProductInfo.tsx`, `storefront/src/app/[locale]/product/[slug]/page.tsx`
- Modify: `b2b-portal/src/lib/types.ts`, `b2b-portal/src/components/FilterSidebar.tsx`, `b2b-portal/src/components/ActiveFilters.tsx`, `b2b-portal/src/components/B2BCatalogView.tsx`

**Interfaces:**
- Consumes: фасеты `values: {value, label}[]` (задача 1); `variants[].images`, `variants[].characteristics` (задача 5).
- Produces: `FacetValue = { value: string; label: string }`; `SelectedVariantProvider({ initialVariantId, children })`, `useSelectedVariant(): { variantId, setVariantId }`, `initialVariantId(product: Product): number | null`; `VariantGallery({ product, alt })`; `ActiveFilters` — необязательный проп `facets?: Facets | null`.

- [ ] **Step 1: Типы (оба приложения)**

`storefront/src/lib/types.ts` и `b2b-portal/src/lib/types.ts`:

```ts
export interface FacetValue {
  /** ru-текст — ключ в адресе (`attr[color]=Серый`), одинаковый на обоих языках. */
  value: string;
  /** Подпись на языке запроса. */
  label: string;
}

export interface FacetAttribute {
  name: string;
  slug: string;
  values: FacetValue[];
}
```

В `ProductVariant` (storefront; и b2b-portal, если тип там есть):

```ts
  /** Структурированные характеристики или старый объект из ERP. */
  characteristics: ProductCharacteristic[] | Record<string, unknown>;
  /** Фото варианта; пусто — показывать фото товара. */
  images?: ProductImage[];
```

- [ ] **Step 2: Фильтры (оба приложения)**

`FilterSidebar.tsx` — список значений:

```tsx
              {attribute.values.map((option) => (
                <li key={option.value}>
                  <label className="flex cursor-pointer items-center gap-3 text-ink">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-line-strong text-zinc-900 focus:ring-zinc-900"
                      checked={selectedAttrs.get(attribute.slug)?.has(option.value) ?? false}
                      onChange={() => apply((params) => toggleSetParam(params, `attr[${attribute.slug}]`, option.value))}
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                </li>
              ))}
```

(в b2b-portal классы оставить свои — меняются только `value`/`label`.)

`ActiveFilters.tsx` — проп `facets?: Facets | null` (импорт типа из `@/lib/types`), ветка `attr[`:

```ts
        if (key.startsWith("attr[")) {
          const slug = key.slice("attr[".length, -1);
          const options = facets?.attributes.find((a) => a.slug === slug)?.values ?? [];
          // В адресе — ru-ключи; на экране — подписи на языке страницы.
          label = String(searchParams[key])
            .split(",")
            .map((value) => options.find((o) => o.value === value)?.label ?? value)
            .join(", ");
        }
```

`storefront/src/components/CatalogView.tsx:122` → `<ActiveFilters searchParams={searchParams} pathname={pathname} facets={facets} />`;
`b2b-portal/src/components/B2BCatalogView.tsx:130` → `… facets={facets} />`.

- [ ] **Step 3: Выбранный вариант — общий для галереи и покупки (витрина)**

`storefront/src/components/product/SelectedVariant.tsx`:

```tsx
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Product } from "@/lib/types";

type SelectedVariant = { variantId: number | null; setVariantId: (id: number | null) => void };

const SelectedVariantContext = createContext<SelectedVariant | null>(null);

/** Первый вариант, если он в наличии, — как раньше выбирал ProductInfo. */
export function initialVariantId(product: Product): number | null {
  const first = product.variants?.[0];

  return first && first.in_stock ? first.id : null;
}

/**
 * Выбранный вариант на странице товара. Галерея и блок покупки — соседи в
 * серверной разметке страницы, поэтому выбор живёт в контексте над ними.
 */
export function SelectedVariantProvider({ initialVariantId: initial, children }: { initialVariantId: number | null; children: ReactNode }) {
  const [variantId, setVariantId] = useState(initial);

  return <SelectedVariantContext.Provider value={{ variantId, setVariantId }}>{children}</SelectedVariantContext.Provider>;
}

export function useSelectedVariant(): SelectedVariant {
  const value = useContext(SelectedVariantContext);

  if (!value) {
    throw new Error("useSelectedVariant: нет SelectedVariantProvider выше");
  }

  return value;
}
```

`storefront/src/components/product/VariantGallery.tsx`:

```tsx
"use client";

import { ProductGallery } from "@/components/ProductGallery";
import type { Product } from "@/lib/types";
import { useSelectedVariant } from "./SelectedVariant";

/** Галерея товара; у выбранного варианта со своими фото — его фото. */
export function VariantGallery({ product, alt }: { product: Product; alt: string }) {
  const { variantId } = useSelectedVariant();
  const variantImages = product.variants?.find((v) => v.id === variantId)?.images ?? [];
  const ownImages = variantImages.length > 0;

  // key: при смене набора фото галерея начинает с первого, а не с индекса прошлого набора.
  return <ProductGallery key={ownImages ? `variant-${variantId}` : "product"} images={ownImages ? variantImages : product.images} alt={alt} />;
}
```

`ProductInfo.tsx`: вместо

```tsx
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    variants.length > 0 && variants[0].in_stock ? variants[0].id : null
  );
```

— `const { variantId: selectedVariantId, setVariantId: setSelectedVariantId } = useSelectedVariant();` (импорт из `./SelectedVariant`; `useState` оставить, если используется дальше).

`storefront/src/app/[locale]/product/[slug]/page.tsx`: обернуть блок «Hero block: Gallery + Sidebar» в `<SelectedVariantProvider initialVariantId={initialVariantId(product)}>…</SelectedVariantProvider>`; `<ProductGallery images={product.images} alt={…} />` заменить на `<VariantGallery product={product} alt={tValue(product.name, locale)} />`. Если `ProductInfo` рендерится вне этого блока — обёртка должна охватывать и его (найти его место на странице).

- [ ] **Step 4: Проверка**

Run: `cd storefront && npx tsc --noEmit && npm run build`; `cd b2b-portal && npx tsc --noEmit && npm run build`
Expected: без ошибок.

Ручная проверка (dev-сервер витрины): товар с вариантом, у которого отмечены фото (создать в админке), `/ru/product/<slug>` → выбор варианта меняет галерею; `/kk/...` — характеристики и фильтры каталога по-казахски, чипы активных фильтров — подписи, адрес — ru-ключ.

- [ ] **Step 5: Коммит**

```bash
git add storefront/src b2b-portal/src
git commit -m "feat(storefront): translated facet labels and variant photos in the product gallery"
```

---

### Task 13: Итоговая проверка

- [ ] **Step 1: Весь PHP-набор**

Run: `$T` (без фильтра). Если памяти не хватает — `php -d memory_limit=3G artisan test --compact` с теми же переменными.
Expected: всё зелёное, кроме известных skipped.

- [ ] **Step 2: Форматирование**

Run: `vendor/bin/pint --dirty --format agent` → без изменений (или закоммитить правки).

- [ ] **Step 3: Фронтенды**

Run: `cd admin && npx tsc --noEmit && npm run lint && npm run build`; `cd storefront && npx tsc --noEmit && npm run build`; `cd b2b-portal && npx tsc --noEmit && npm run build`.

- [ ] **Step 4: e2e админки по затронутым файлам**

Run (из `admin/`): `npx playwright test e2e/attributes.spec.ts e2e/product-form.spec.ts e2e/product-variants.spec.ts e2e/product-relations.spec.ts e2e/catalog-groups.spec.ts e2e/mobile`
Expected: PASS на Desktop и Mobile.

- [ ] **Step 5: Живая проверка на ширине телефона**

`preview_start` админки → `resize_window` mobile: новый товар с характеристикой и «+ Создать» атрибута/бренда/категории; вариант с фото (галочка из галереи и загрузка); экран атрибутов (поиск, чипы, переключатель, «⋯»); выбор клиента в ценах. Скриншоты — пользователю. Вернуть `resize_window` desktop.

- [ ] **Step 6: Документация проекта**

`CLAUDE.md` → раздел «Two admin panels»: в перечне экранов `admin/` у «attributes» добавить «(ru/kk)», у «variants» — «(characteristics, photos from the product gallery)». Коммит:

```bash
git add CLAUDE.md
git commit -m "docs: admin attributes and variants in CLAUDE.md"
```
