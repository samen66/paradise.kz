# Шоурумы: управление в админке и настоящие данные на витрине — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** менеджер ведёт шоурумы (склады типа `retail_point`) в `admin/`, витрина `shop.paradise.kz/showrooms` показывает их из API вместо заглушки.

**Architecture:** поля шоурума — новые колонки `stores` + коллекция медиа `showroom_photos` на модели `Store`. Админский API `/api/admin/showrooms*` работает только со складами `retail_point` и не трогает учётные поля (`is_active`, `is_default`, `type`). Публичный API `/api/public/showrooms*` отдаёт опубликованные шоурумы; товары на странице шоурума — существующий `/api/public/products?store_id=X&filter[in_stock]=1`. Витрина читает API с тегами кеша, админка после сохранения ставит `RevalidateStorefrontCacheJob`.

**Tech Stack:** Laravel 13, PHPUnit 12 (SQLite in-memory), Spatie Translatable / Media Library; Next.js 16 (admin: react-hook-form + zod 4; storefront: next-intl), Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-09-25-admin-showrooms-design.md`

## Global Constraints

- Шоурум на витрине ⇔ `type = 'retail_point' AND is_active AND show_on_site AND slug IS NOT NULL`, порядок `sort_order, name`.
- `weekly_hours` — ровно 7 элементов, индекс 0 = понедельник, элемент `{"open":"HH:MM","close":"HH:MM"}` или `null`.
- Услуги — только `pickup, consult, card, kids, cafe, assembly`.
- `whatsapp` — `^7\d{10}$`; `slug` — `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤ 100, уникален в `stores`.
- Фото: jpeg/png/webp, ≤ 10 МБ, не больше 20 на шоурум; конвертации `wide` 1920×1080 и `card` 800×600, webp, качество 82.
- Админский API шоурумов не принимает `type`, `code`, `is_active`, `is_default`.
- Теги кеша витрины: `showrooms` и `showroom:{slug}`.
- Коммиты — без `Co-Authored-By` и без «Generated with Claude Code» (личное правило пользователя).
- Команда тестов (далее **`TEST`**):
  `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact`
- Каждое изменение PHP — `vendor/bin/pint --dirty --format agent` перед коммитом.

## Review Focus

1. **Старый `retail_point` без новых полей** (`weekly_hours`/`services` = NULL) — админка должна открыть его: API отдаёт 7 `null` и `[]` (тест в Task 2).
2. **`PUT` с `show_on_site: true` без поля `slug`** — берётся сохранённый slug; если его нет — 422 на `show_on_site` (тест в Task 2).
3. **Смена slug** — сбрасываются теги и старого, и нового адреса, иначе старая страница живёт 300 с (тест в Task 2).
4. **Товар с остатком, но скрытый** (`is_active = false` или в группе каталога) — не входит ни в `products_count`, ни в превью (тест в Task 4).
5. **Склад выключили на «Места хранения»** при `show_on_site = true` — шоурум исчезает из публичного списка, а `ProductResource` отдаёт `store.slug = null` (тест в Task 4).

## Отклонения от спецификации (приняты при планировании)

- Slug при создании без slug генерирует **сервер** (`Str::slug` транслитерирует кириллицу, суффикс `-2`, `-3` при коллизии), а не клиент — тестируемо и одна реализация.
- `ShowroomAdminResource` отдаёт `cover_url`, а не список фото: фото раздел грузит сам через `/photos`.
- Товары на странице шоурума — существующая нумерованная `Pagination` (как в каталоге), а не «Показать ещё».
- Ссылка «на карте» — `https://2gis.kz/?m={lng}%2C{lat}%2F17` (работает без сегмента города).
- Фильтр по району на `/showrooms` удаляется (района в данных нет).

Спецификация правится в Task 1, шаг 1.

## Файлы

**API (Laravel)**
- Create `database/migrations/2026_09_25_000002_add_showroom_fields_to_stores_table.php`
- Modify `app/Models/Store.php` — переводы, медиа, касты, скоуп, константы, `isPublishedShowroom()`, `storefrontCacheTags()`
- Modify `database/factories/StoreFactory.php` — состояние `showroom()`
- Modify `app/Http/Controllers/Api/Public/StoreController.php` — починка
- Create `app/Http/Requests/Admin/ShowroomRequest.php`
- Create `app/Http/Resources/ShowroomAdminResource.php`
- Create `app/Http/Controllers/Api/Admin/ShowroomController.php`
- Create `app/Http/Controllers/Api/Admin/ShowroomPhotoController.php`
- Create `app/Http/Resources/PublicShowroomResource.php`
- Create `app/Http/Controllers/Api/Public/ShowroomController.php`
- Modify `app/Http/Resources/ProductResource.php` — `store.slug`
- Modify `routes/api.php`
- Tests: `tests/Feature/Admin/ShowroomApiTest.php`, `tests/Feature/Admin/ShowroomPhotoApiTest.php`, `tests/Feature/Public/ShowroomsTest.php`, `tests/Feature/Public/StoresTest.php` (modify), `tests/Feature/Inventory/StoreShowroomFieldsTest.php`

**Admin (`admin/src`)**
- Create `lib/showrooms.ts` — типы, схема формы, преобразования, 2ГИС
- Modify `components/shell/navConfig.ts`
- Modify `components/products/form/photos.ts`, `PhotosSection.tsx`, `ProductForm.tsx` — путь медиа вместо id товара
- Create `app/showrooms/page.tsx` — список
- Create `app/showrooms/[id]/page.tsx` — загрузка карточки
- Create `components/showrooms/ShowroomForm.tsx`, `components/showrooms/HoursCard.tsx`, `components/showrooms/MapCard.tsx`

**Storefront (`storefront/src`)**
- Create `lib/showrooms.ts`, `lib/use-now.ts`, `components/showrooms/OpenStatus.tsx`
- Modify `lib/types.ts`, `messages/ru.json`, `messages/kk.json`
- Rewrite `app/[locale]/showrooms/page.tsx`, `ShowroomsClient.tsx`, `[slug]/page.tsx`, `[slug]/ShowroomClient.tsx`
- Modify `components/product/ShowroomAvailability.tsx`
- Delete `lib/showroom-data.ts`

---

### Task 1: Колонки шоурума в `stores`, модель, фабрика, починка `/public/stores`

**Files:**
- Modify: `docs/superpowers/specs/2026-09-25-admin-showrooms-design.md`
- Create: `database/migrations/2026_09_25_000002_add_showroom_fields_to_stores_table.php`
- Modify: `app/Models/Store.php`, `database/factories/StoreFactory.php`, `app/Http/Controllers/Api/Public/StoreController.php`
- Test: `tests/Feature/Inventory/StoreShowroomFieldsTest.php`, `tests/Feature/Public/StoresTest.php`

**Interfaces:**
- Produces:
  - `Store::TYPE_RETAIL_POINT = 'retail_point'`, `Store::PHOTOS_COLLECTION = 'showroom_photos'`, `Store::SHOWROOM_SERVICES` (list<string>), `Store::MAX_PHOTOS = 20`
  - `Store::query()->publishedShowrooms()` (скоуп с порядком)
  - `$store->isPublishedShowroom(): bool`
  - `$store->storefrontCacheTags(?string $previousSlug = null): list<string>`
  - `Store::factory()->showroom()` — опубликованный заполненный шоурум
  - касты: `weekly_hours` array, `services` array, `lat`/`lng` float|null, `show_on_site`/`is_flagship` bool, `sort_order` int; переводимые `landmark`, `parking`, `description`

- [ ] **Step 0: Подготовка worktree** (один раз; если уже сделано — пропустить)

```bash
composer install --no-interaction
cp .env.example .env
# APP_KEY: перенести строку APP_KEY=… из /Users/samenuatkhan/PhpstormProjects/paradise.kz/.env в .env
cp /Users/samenuatkhan/PhpstormProjects/paradise.kz/vendor/laravel/reverb/src/Reverb.php vendor/laravel/reverb/src/Reverb.php
(cd admin && npm ci) && (cd storefront && npm ci)
STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact
```

Ожидается: зелёный сьют (кроме `Public/StoresTest`, который сейчас падает из-за несуществующих колонок — это чиним ниже). Если красное что-то ещё — записать базовую линию, не чинить.

- [ ] **Step 1: Поправить спецификацию под отклонения**

В `docs/superpowers/specs/2026-09-25-admin-showrooms-design.md`:
- в «Список `/showrooms`» заменить «Slug подставляется транслитом из названия, пока менеджер не правил его руками» на «Slug можно оставить пустым — сервер составит его из названия (транслит, суффикс при совпадении)»;
- в «API админки», строка `POST`: дописать «пустой `slug` → `Str::slug(name)` с суффиксом `-2`, `-3`…»;
- в «Ответ — `ShowroomAdminResource`» убрать `photos: [{id, url, thumb_url}]` (фото — через `/photos`);
- в «Витрина» `/showrooms/[slug]`: «с „Показать ещё“» → «с нумерованной `Pagination`, как в каталоге»; ссылки 2ГИС: карта — `https://2gis.kz/?m={lng}%2C{lat}%2F17`, маршрут — `https://2gis.kz/directions/points/%7C{lng}%2C{lat}%3B`;
- в «Витрина» `/showrooms`: дописать «фильтр по району удаляется».

- [ ] **Step 2: Написать падающие тесты**

`tests/Feature/Inventory/StoreShowroomFieldsTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StoreShowroomFieldsTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function showroom_fields_are_cast_and_translated(): void
    {
        $store = Store::factory()->create([
            'type' => Store::TYPE_RETAIL_POINT,
            'weekly_hours' => [['open' => '10:00', 'close' => '21:00'], null, null, null, null, null, null],
            'services' => ['pickup', 'cafe'],
            'lat' => 43.2735,
            'lng' => 76.943,
            'landmark' => ['ru' => 'У метро', 'kk' => 'Метро жанында'],
        ])->fresh();

        $this->assertSame('10:00', $store->weekly_hours[0]['open']);
        $this->assertNull($store->weekly_hours[1]);
        $this->assertSame(['pickup', 'cafe'], $store->services);
        $this->assertSame(43.2735, $store->lat);
        $this->assertSame('Метро жанында', $store->getTranslation('landmark', 'kk'));
        $this->assertFalse($store->show_on_site);
        $this->assertFalse($store->is_flagship);
        $this->assertSame(0, $store->sort_order);
    }

    #[Test]
    public function only_active_published_retail_points_with_a_slug_are_showrooms(): void
    {
        $published = Store::factory()->showroom()->create(['name' => 'Б', 'sort_order' => 1]);
        $first = Store::factory()->showroom()->create(['name' => 'А', 'sort_order' => 1]);
        $top = Store::factory()->showroom()->create(['name' => 'Я', 'sort_order' => 0]);
        Store::factory()->showroom()->create(['type' => 'warehouse']);
        Store::factory()->showroom()->create(['is_active' => false]);
        Store::factory()->showroom()->create(['show_on_site' => false]);
        Store::factory()->showroom()->create(['slug' => null]);

        $this->assertSame(
            [$top->id, $first->id, $published->id],
            Store::query()->publishedShowrooms()->pluck('id')->all(),
        );
        $this->assertTrue($published->isPublishedShowroom());
        $this->assertFalse(Store::factory()->showroom()->create(['show_on_site' => false])->isPublishedShowroom());
    }

    #[Test]
    public function cache_tags_cover_the_list_and_both_slugs(): void
    {
        $store = Store::factory()->showroom()->create(['slug' => 'esentai']);

        $this->assertSame(['showrooms', 'showroom:esentai'], $store->storefrontCacheTags());
        $this->assertSame(['showrooms', 'showroom:esentai', 'showroom:old'], $store->storefrontCacheTags('old'));
        $this->assertSame(['showrooms', 'showroom:esentai'], $store->storefrontCacheTags('esentai'));
    }
}
```

`tests/Feature/Public/StoresTest.php` — дописать в существующий класс:

```php
    #[Test]
    public function it_returns_only_public_fields(): void
    {
        Store::factory()->create(['name' => 'Склад', 'is_active' => true]);

        $this->getJson('/api/public/stores')
            ->assertOk()
            ->assertExactJsonStructure(['data' => [['id', 'name']]]);
    }
```

- [ ] **Step 3: Запустить — убедиться, что падают**

Run: `TEST --filter='StoreShowroomFieldsTest|StoresTest'`
Expected: FAIL — `Undefined constant App\Models\Store::TYPE_RETAIL_POINT`, `no such column: city` в `StoresTest`.

- [ ] **Step 4: Миграция**

`php artisan make:migration add_showroom_fields_to_stores_table --no-interaction`, затем переименовать файл в `2026_09_25_000002_add_showroom_fields_to_stores_table.php` и заменить содержимое:

```php
<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A retail point doubles as a showroom on the storefront. Its public card —
 * contacts, hours, services, map point — lives on the same row as the
 * warehouse it is, so stock "in this showroom" is simply this store's stock.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->string('slug', 100)->nullable()->unique();
            $table->boolean('show_on_site')->default(false);
            $table->string('city', 100)->nullable();
            $table->json('landmark')->nullable();
            $table->json('parking')->nullable();
            $table->json('description')->nullable();
            $table->string('phone', 32)->nullable();
            $table->string('whatsapp', 20)->nullable();
            $table->decimal('lat', 9, 6)->nullable();
            $table->decimal('lng', 9, 6)->nullable();
            $table->json('weekly_hours')->nullable();
            $table->json('services')->nullable();
            $table->string('area', 50)->nullable();
            $table->string('floors', 50)->nullable();
            $table->boolean('is_flagship')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn([
                'slug', 'show_on_site', 'city', 'landmark', 'parking', 'description', 'phone', 'whatsapp',
                'lat', 'lng', 'weekly_hours', 'services', 'area', 'floors', 'is_flagship', 'sort_order',
            ]);
        });
    }
};
```

- [ ] **Step 5: Модель `Store`**

Заменить `app/Models/Store.php` целиком (связи сохраняются как были):

```php
<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\StoreFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Image\Enums\Fit;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Spatie\Translatable\HasTranslations;

/**
 * A warehouse or a retail point. A retail point is also a showroom on the
 * storefront once it is active, marked `show_on_site` and has a slug; its
 * public card (contacts, hours, services, photos) lives on the same row.
 */
class Store extends Model implements HasMedia
{
    /** @use HasFactory<StoreFactory> */
    use HasFactory;

    use HasTranslations;
    use InteractsWithMedia;

    public const TYPE_RETAIL_POINT = 'retail_point';

    public const PHOTOS_COLLECTION = 'showroom_photos';

    public const MAX_PHOTOS = 20;

    /** Service keys a showroom may list; the front-ends own the labels. */
    public const SHOWROOM_SERVICES = ['pickup', 'consult', 'card', 'kids', 'cafe', 'assembly'];

    /** @var list<string> */
    public array $translatable = ['landmark', 'parking', 'description'];

    protected $fillable = [
        'source',
        'external_id',
        'name',
        'code',
        'type',
        'address',
        'is_default',
        'is_active',
        'slug',
        'show_on_site',
        'city',
        'landmark',
        'parking',
        'description',
        'phone',
        'whatsapp',
        'lat',
        'lng',
        'weekly_hours',
        'services',
        'area',
        'floors',
        'is_flagship',
        'sort_order',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'is_active' => 'boolean',
            'show_on_site' => 'boolean',
            'is_flagship' => 'boolean',
            'sort_order' => 'integer',
            'lat' => 'float',
            'lng' => 'float',
            'weekly_hours' => 'array',
            'services' => 'array',
        ];
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection(self::PHOTOS_COLLECTION)
            ->useDisk(config('media-library.disk_name'));
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('wide')
            ->fit(Fit::Max, 1920, 1080)
            ->format('webp')
            ->quality(82)
            ->performOnCollections(self::PHOTOS_COLLECTION);

        $this->addMediaConversion('card')
            ->fit(Fit::Max, 800, 600)
            ->format('webp')
            ->quality(82)
            ->performOnCollections(self::PHOTOS_COLLECTION);
    }

    /**
     * Showrooms the storefront lists, in display order.
     *
     * @param  Builder<Store>  $query
     */
    public function scopePublishedShowrooms(Builder $query): void
    {
        $query->where('type', self::TYPE_RETAIL_POINT)
            ->where('is_active', true)
            ->where('show_on_site', true)
            ->whereNotNull('slug')
            ->orderBy('sort_order')
            ->orderBy('name');
    }

    public function isPublishedShowroom(): bool
    {
        return $this->type === self::TYPE_RETAIL_POINT
            && $this->is_active
            && $this->show_on_site
            && filled($this->slug);
    }

    /**
     * Storefront cache tags to purge after this showroom changes; a renamed
     * slug purges the old page too.
     *
     * @return list<string>
     */
    public function storefrontCacheTags(?string $previousSlug = null): array
    {
        $tags = ['showrooms'];

        foreach ([$this->slug, $previousSlug] as $slug) {
            if (filled($slug)) {
                $tags[] = "showroom:{$slug}";
            }
        }

        return array_values(array_unique($tags));
    }

    /**
     * @return HasMany<ProductStoreStock, $this>
     */
    public function productStocks(): HasMany
    {
        return $this->hasMany(ProductStoreStock::class);
    }

    /**
     * @return HasMany<Batch, $this>
     */
    public function batches(): HasMany
    {
        return $this->hasMany(Batch::class);
    }

    /**
     * @return HasMany<StockMovement, $this>
     */
    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    /**
     * @return HasMany<Order, $this>
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
```

- [ ] **Step 6: Состояние фабрики**

В `database/factories/StoreFactory.php` после `inactive()`:

```php
    /** A filled-in retail point published on the storefront. */
    public function showroom(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => Store::TYPE_RETAIL_POINT,
            'slug' => Str::slug(fake()->unique()->words(3, true)),
            'show_on_site' => true,
            'city' => 'Алматы',
            'address' => 'пр. Аль-Фараби, 77/8',
            'landmark' => ['ru' => 'ТРЦ Esentai Mall, 3 этаж'],
            'phone' => '+7 (727) 355-11-05',
            'whatsapp' => '77001112233',
            'lat' => 43.2205,
            'lng' => 76.928,
            'weekly_hours' => array_fill(0, 7, ['open' => '10:00', 'close' => '21:00']),
            'services' => ['pickup', 'consult'],
        ]);
    }
```

- [ ] **Step 7: Починить `/api/public/stores`**

`app/Http/Controllers/Api/Public/StoreController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\StoreResource;
use App\Models\Store;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class StoreController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return StoreResource::collection(
            Store::query()->where('is_active', true)->orderByDesc('is_default')->orderBy('name')->get(),
        );
    }
}
```

- [ ] **Step 8: Запустить — зелёные**

Run: `TEST --filter='StoreShowroomFieldsTest|StoresTest|StoreApiTest|StoreAdminTest'`
Expected: PASS (включая существующие складские тесты — `Store` не сломан).

- [ ] **Step 9: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add database/migrations/2026_09_25_000002_add_showroom_fields_to_stores_table.php app/Models/Store.php database/factories/StoreFactory.php app/Http/Controllers/Api/Public/StoreController.php tests/Feature/Inventory/StoreShowroomFieldsTest.php tests/Feature/Public/StoresTest.php docs/superpowers/specs/2026-09-25-admin-showrooms-design.md
git commit -m "feat(api): showroom fields and photos on stores; fix public stores endpoint"
```

---

### Task 2: Админский API шоурумов (список, создание, карточка, правка)

**Files:**
- Create: `app/Http/Requests/Admin/ShowroomRequest.php`, `app/Http/Resources/ShowroomAdminResource.php`, `app/Http/Controllers/Api/Admin/ShowroomController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Admin/ShowroomApiTest.php`

**Interfaces:**
- Consumes: всё из Task 1.
- Produces (JSON, `data`):
  `{id, name, slug, address, city, is_active, show_on_site, landmark:{ru,kk}, parking:{ru,kk}, description:{ru,kk}, phone, whatsapp, lat, lng, weekly_hours: (null|{open,close})[7], services: string[], area, floors, is_flagship, sort_order, cover_url, public_url, products_in_stock?}` — `products_in_stock` только в `show`/`update`.
  Маршруты: `GET|POST /api/admin/showrooms`, `GET|PUT /api/admin/showrooms/{store}`.

- [ ] **Step 1: Написать падающие тесты**

`tests/Feature/Admin/ShowroomApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Jobs\RevalidateStorefrontCacheJob;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ShowroomApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        Queue::fake();
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Paradise Есентай',
            'slug' => 'esentai',
            'address' => 'пр. Аль-Фараби, 77/8',
            'city' => 'Алматы',
            'show_on_site' => true,
            'landmark' => ['ru' => 'ТРЦ Esentai Mall', 'kk' => ''],
            'parking' => ['ru' => 'Паркинг ТРЦ', 'kk' => 'СОО паркингі'],
            'description' => ['ru' => '', 'kk' => ''],
            'phone' => '+7 (727) 355-11-05',
            'whatsapp' => '77273551105',
            'lat' => 43.2205,
            'lng' => 76.928,
            'weekly_hours' => [
                ['open' => '10:00', 'close' => '22:00'], ['open' => '10:00', 'close' => '22:00'],
                ['open' => '10:00', 'close' => '22:00'], ['open' => '10:00', 'close' => '22:00'],
                ['open' => '10:00', 'close' => '22:00'], ['open' => '11:00', 'close' => '20:00'], null,
            ],
            'services' => ['consult', 'card', 'cafe'],
            'area' => '540 м²',
            'floors' => '1 этаж',
            'is_flagship' => true,
            'sort_order' => 3,
        ], $overrides);
    }

    #[Test]
    public function only_staff_may_manage_showrooms(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/showrooms');
    }

    #[Test]
    public function the_list_holds_only_retail_points(): void
    {
        $this->actingAsManager();
        $showroom = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT, 'name' => 'Шоурум']);
        Store::factory()->create(['type' => 'warehouse', 'name' => 'Склад']);

        $this->getJson('/api/admin/showrooms')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $showroom->id)
            ->assertJsonPath('data.0.cover_url', null);
    }

    #[Test]
    public function creating_makes_an_unpublished_active_retail_point(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/showrooms', ['name' => 'Paradise Mega', 'address' => 'Розыбакиева, 247а', 'show_on_site' => true])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'paradise-mega')
            ->assertJsonPath('data.show_on_site', false)
            ->json('data.id');

        $store = Store::findOrFail($id);
        $this->assertSame(Store::TYPE_RETAIL_POINT, $store->type);
        $this->assertTrue($store->is_active);
        $this->assertFalse($store->is_default);
    }

    #[Test]
    public function a_generated_slug_gets_a_suffix_on_collision(): void
    {
        $this->actingAsManager();
        Store::factory()->create(['slug' => 'paradise-mega']);

        $this->postJson('/api/admin/showrooms', ['name' => 'Paradise Mega'])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'paradise-mega-2');
    }

    #[Test]
    public function a_legacy_retail_point_opens_with_empty_hours_and_services(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT]);
        $product = Product::factory()->create();
        ProductStoreStock::factory()->for($product)->for($store)->create(['stock' => 3]);
        ProductStoreStock::factory()->for(Product::factory())->for($store)->create(['stock' => 0]);

        $this->getJson("/api/admin/showrooms/{$store->id}")
            ->assertOk()
            ->assertJsonPath('data.weekly_hours', [null, null, null, null, null, null, null])
            ->assertJsonPath('data.services', [])
            ->assertJsonPath('data.landmark', ['ru' => '', 'kk' => ''])
            ->assertJsonPath('data.products_in_stock', 1)
            ->assertJsonPath('data.public_url', null);
    }

    #[Test]
    public function a_warehouse_is_not_a_showroom(): void
    {
        $this->actingAsManager();
        $warehouse = Store::factory()->create(['type' => 'warehouse']);

        $this->getJson("/api/admin/showrooms/{$warehouse->id}")->assertNotFound();
        $this->putJson("/api/admin/showrooms/{$warehouse->id}", $this->payload())->assertNotFound();
    }

    #[Test]
    public function the_card_is_updated_and_the_storefront_purged(): void
    {
        $this->actingAsManager();
        config(['services.storefront.url' => 'https://shop.paradise.kz']);
        $store = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT, 'slug' => 'old-slug']);

        $this->putJson("/api/admin/showrooms/{$store->id}", $this->payload())
            ->assertOk()
            ->assertJsonPath('data.slug', 'esentai')
            ->assertJsonPath('data.landmark', ['ru' => 'ТРЦ Esentai Mall', 'kk' => ''])
            ->assertJsonPath('data.parking.kk', 'СОО паркингі')
            ->assertJsonPath('data.weekly_hours.5', ['open' => '11:00', 'close' => '20:00'])
            ->assertJsonPath('data.weekly_hours.6', null)
            ->assertJsonPath('data.lat', 43.2205)
            ->assertJsonPath('data.public_url', 'https://shop.paradise.kz/showrooms/esentai');

        $store->refresh();
        $this->assertSame(['consult', 'card', 'cafe'], $store->services);
        $this->assertTrue($store->is_flagship);
        $this->assertSame(3, $store->sort_order);

        Queue::assertPushed(
            RevalidateStorefrontCacheJob::class,
            fn (RevalidateStorefrontCacheJob $job): bool => (fn () => $this->tags)->call($job) === ['showrooms', 'showroom:esentai', 'showroom:old-slug'],
        );
    }

    #[Test]
    public function accounting_fields_are_not_changed_here(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT, 'is_active' => true, 'is_default' => false, 'code' => 'SR1']);

        $this->putJson("/api/admin/showrooms/{$store->id}", $this->payload([
            'is_active' => false, 'is_default' => true, 'type' => 'warehouse', 'code' => 'HACK',
        ]))->assertOk();

        $store->refresh();
        $this->assertTrue($store->is_active);
        $this->assertFalse($store->is_default);
        $this->assertSame(Store::TYPE_RETAIL_POINT, $store->type);
        $this->assertSame('SR1', $store->code);
    }

    #[Test]
    public function publishing_uses_the_saved_slug_when_none_is_sent(): void
    {
        $this->actingAsManager();
        $withSlug = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT, 'slug' => 'kept']);
        $withoutSlug = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT, 'slug' => null]);

        $this->putJson("/api/admin/showrooms/{$withSlug->id}", ['name' => 'X', 'show_on_site' => true])->assertOk();
        $this->assertTrue($withSlug->fresh()->show_on_site);

        $this->putJson("/api/admin/showrooms/{$withoutSlug->id}", ['name' => 'X', 'show_on_site' => true])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('show_on_site');
    }

    /**
     * @return array<string, array{array<string, mixed>, string}>
     */
    public static function invalidPayloads(): array
    {
        return [
            'slug with capitals' => [['slug' => 'Esentai'], 'slug'],
            'whatsapp with plus' => [['whatsapp' => '+77001112233'], 'whatsapp'],
            'lat without lng' => [['lng' => null], 'lng'],
            'lat out of range' => [['lat' => 91], 'lat'],
            'six days' => [['weekly_hours' => array_fill(0, 6, null)], 'weekly_hours'],
            'bad time' => [['weekly_hours' => [['open' => '9', 'close' => '21:00'], null, null, null, null, null, null]], 'weekly_hours.0'],
            'closes before opening' => [['weekly_hours' => [['open' => '21:00', 'close' => '10:00'], null, null, null, null, null, null]], 'weekly_hours.0'],
            'unknown service' => [['services' => ['spa']], 'services.0'],
            'duplicate service' => [['services' => ['cafe', 'cafe']], 'services.0'],
            'no name' => [['name' => ''], 'name'],
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    #[Test]
    #[DataProvider('invalidPayloads')]
    public function invalid_cards_are_rejected(array $overrides, string $field): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT]);

        $this->putJson("/api/admin/showrooms/{$store->id}", $this->payload($overrides))
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);
    }

    #[Test]
    public function a_slug_must_be_unique_among_stores(): void
    {
        $this->actingAsManager();
        Store::factory()->create(['slug' => 'esentai']);
        $store = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT]);

        $this->putJson("/api/admin/showrooms/{$store->id}", $this->payload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('slug');
    }
}
```

- [ ] **Step 2: Запустить — убедиться, что падают**

Run: `TEST tests/Feature/Admin/ShowroomApiTest.php`
Expected: FAIL — 404 на `/api/admin/showrooms` (маршрута нет).

- [ ] **Step 3: `ShowroomRequest`**

`php artisan make:request Admin/ShowroomRequest --no-interaction`, содержимое:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Models\Store;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * The public card of a showroom. Accounting fields (`type`, `code`,
 * `is_active`, `is_default`) belong to the warehouse screen and are not
 * accepted here.
 */
class ShowroomRequest extends FormRequest
{
    private const NULLABLE_STRINGS = ['address', 'slug', 'city', 'phone', 'whatsapp', 'area', 'floors', 'lat', 'lng'];

    private const TRANSLATABLE = ['landmark', 'parking', 'description'];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (self::NULLABLE_STRINGS as $field) {
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
        /** @var Store|null $store */
        $store = $this->route('store');

        return [
            'name' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'slug' => [
                'nullable', 'string', 'max:100', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('stores', 'slug')->ignore($store),
            ],
            'show_on_site' => ['sometimes', 'boolean'],
            'city' => ['nullable', 'string', 'max:100'],
            'landmark' => ['nullable', 'array'],
            'landmark.ru' => ['nullable', 'string', 'max:255'],
            'landmark.kk' => ['nullable', 'string', 'max:255'],
            'parking' => ['nullable', 'array'],
            'parking.ru' => ['nullable', 'string', 'max:255'],
            'parking.kk' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'array'],
            'description.ru' => ['nullable', 'string', 'max:5000'],
            'description.kk' => ['nullable', 'string', 'max:5000'],
            'phone' => ['nullable', 'string', 'max:32'],
            'whatsapp' => ['nullable', 'string', 'regex:/^7\d{10}$/'],
            'lat' => ['nullable', 'numeric', 'between:-90,90', 'required_with:lng'],
            'lng' => ['nullable', 'numeric', 'between:-180,180', 'required_with:lat'],
            'weekly_hours' => ['nullable', 'array', 'size:7'],
            'weekly_hours.*' => ['nullable', 'array'],
            'services' => ['nullable', 'array'],
            'services.*' => ['string', 'distinct', Rule::in(Store::SHOWROOM_SERVICES)],
            'area' => ['nullable', 'string', 'max:50'],
            'floors' => ['nullable', 'string', 'max:50'],
            'is_flagship' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $this->checkWeeklyHours($validator);
                $this->checkPublishable($validator);
            },
        ];
    }

    /**
     * Translations come back without empty locales; hours are reduced to
     * exactly `{open, close}` or null per day.
     *
     * @return array<string, mixed>
     */
    public function validated($key = null, $default = null): mixed
    {
        $validated = parent::validated();

        foreach (self::TRANSLATABLE as $field) {
            if (array_key_exists($field, $validated)) {
                $validated[$field] = array_filter(
                    $validated[$field] ?? [],
                    fn (?string $value): bool => $value !== null && $value !== '',
                );
            }
        }

        if (array_key_exists('weekly_hours', $validated) && $validated['weekly_hours'] !== null) {
            $validated['weekly_hours'] = array_map(
                fn (?array $day): ?array => $day === null ? null : ['open' => $day['open'], 'close' => $day['close']],
                array_values($validated['weekly_hours']),
            );
        }

        if (array_key_exists('services', $validated)) {
            $validated['services'] = array_values($validated['services'] ?? []);
        }

        return $key === null ? $validated : data_get($validated, $key, $default);
    }

    private function checkWeeklyHours(Validator $validator): void
    {
        $hours = $this->input('weekly_hours');

        if (! is_array($hours) || count($hours) !== 7) {
            return;
        }

        foreach (array_values($hours) as $index => $day) {
            if (! is_array($day)) {
                continue;
            }

            $open = $day['open'] ?? null;
            $close = $day['close'] ?? null;

            if (! $this->isTime($open) || ! $this->isTime($close)) {
                $validator->errors()->add("weekly_hours.{$index}", 'Время — в формате ЧЧ:ММ.');
            } elseif ($open >= $close) {
                $validator->errors()->add("weekly_hours.{$index}", 'Открытие должно быть раньше закрытия.');
            }
        }
    }

    /**
     * Publishing needs a page address: the one sent now, or the saved one.
     */
    private function checkPublishable(Validator $validator): void
    {
        if (! $this->boolean('show_on_site')) {
            return;
        }

        /** @var Store|null $store */
        $store = $this->route('store');
        $slug = $this->exists('slug') ? $this->input('slug') : $store?->slug;

        if (blank($slug) && $this->isMethod('PUT')) {
            $validator->errors()->add('show_on_site', 'Чтобы показать шоурум на сайте, заполните адрес страницы (slug).');
        }
    }

    private function isTime(mixed $value): bool
    {
        return is_string($value) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $value) === 1;
    }
}
```

- [ ] **Step 4: `ShowroomAdminResource`**

`php artisan make:resource ShowroomAdminResource --no-interaction`, содержимое:

```php
<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A showroom as the admin card edits it: translations as {ru, kk}, hours
 * always seven entries, and the storefront URL once it is published.
 *
 * @mixin Store
 */
class ShowroomAdminResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $hours = $this->weekly_hours;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'address' => $this->address,
            'city' => $this->city,
            'is_active' => $this->is_active,
            'show_on_site' => $this->show_on_site,
            'landmark' => $this->pair('landmark'),
            'parking' => $this->pair('parking'),
            'description' => $this->pair('description'),
            'phone' => $this->phone,
            'whatsapp' => $this->whatsapp,
            'lat' => $this->lat,
            'lng' => $this->lng,
            'weekly_hours' => is_array($hours) && count($hours) === 7 ? array_values($hours) : array_fill(0, 7, null),
            'services' => $this->services ?? [],
            'area' => $this->area,
            'floors' => $this->floors,
            'is_flagship' => $this->is_flagship,
            'sort_order' => $this->sort_order,
            'cover_url' => $this->getFirstMediaUrl(Store::PHOTOS_COLLECTION, 'card') ?: null,
            'public_url' => $this->resource->isPublishedShowroom()
                ? rtrim((string) config('services.storefront.url'), '/').'/showrooms/'.$this->slug
                : null,
            'products_in_stock' => $this->whenHas('products_in_stock'),
        ];
    }

    /**
     * @return array{ru: string, kk: string}
     */
    private function pair(string $key): array
    {
        return [
            'ru' => (string) $this->resource->getTranslation($key, 'ru', false),
            'kk' => (string) $this->resource->getTranslation($key, 'kk', false),
        ];
    }
}
```

- [ ] **Step 5: `ShowroomController`**

`php artisan make:controller Api/Admin/ShowroomController --no-interaction`, содержимое:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\SavesTranslations;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ShowroomRequest;
use App\Http\Resources\ShowroomAdminResource;
use App\Jobs\RevalidateStorefrontCacheJob;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

/**
 * Showrooms are retail-point stores; this controller edits their public
 * card only. Activity, the default flag and deletion stay on the warehouse
 * screen (Admin\StoreController) with its safety checks.
 */
class ShowroomController extends Controller
{
    use SavesTranslations;

    public function index(): AnonymousResourceCollection
    {
        $showrooms = Store::query()
            ->where('type', Store::TYPE_RETAIL_POINT)
            ->with('media')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return ShowroomAdminResource::collection($showrooms);
    }

    public function store(ShowroomRequest $request): JsonResponse
    {
        $data = Arr::except($request->validated(), ['show_on_site']);
        $data['slug'] ??= $this->uniqueSlug($data['name']);

        $store = new Store(['type' => Store::TYPE_RETAIL_POINT, 'is_active' => true, 'show_on_site' => false]);
        $this->saveWithTranslations($store, $data);

        return $this->present($store)->response()->setStatusCode(201);
    }

    public function show(Store $store): ShowroomAdminResource
    {
        $this->ensureShowroom($store);

        return $this->present($store);
    }

    public function update(ShowroomRequest $request, Store $store): ShowroomAdminResource
    {
        $this->ensureShowroom($store);

        $previousSlug = $store->slug;
        $this->saveWithTranslations($store, $request->validated());

        RevalidateStorefrontCacheJob::dispatch($store->storefrontCacheTags($previousSlug))->afterCommit();

        return $this->present($store);
    }

    private function ensureShowroom(Store $store): void
    {
        abort_unless($store->type === Store::TYPE_RETAIL_POINT, 404);
    }

    private function present(Store $store): ShowroomAdminResource
    {
        $store = $store->fresh('media');
        $store->setAttribute('products_in_stock', $store->productStocks()->where('stock', '>', 0)->count());

        return new ShowroomAdminResource($store);
    }

    /**
     * A page address from the name (Cyrillic transliterated), `-2`, `-3`…
     * appended while it is taken.
     */
    private function uniqueSlug(string $name): ?string
    {
        $base = rtrim(Str::limit(Str::slug($name), 90, ''), '-');

        if ($base === '') {
            return null;
        }

        $slug = $base;

        for ($suffix = 2; Store::query()->where('slug', $slug)->exists(); $suffix++) {
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }
}
```

Создание не сбрасывает кеш: новый шоурум — черновик, на витрине его нет.

- [ ] **Step 6: Маршруты**

В `routes/api.php` в блок `use` добавить:

```php
use App\Http\Controllers\Api\Admin\ShowroomController as AdminShowroomController;
```

и в группу `admin` сразу после `Route::apiResource('stores', AdminStoreController::class);`:

```php
        Route::apiResource('showrooms', AdminShowroomController::class)
            ->only(['index', 'store', 'show', 'update'])
            ->parameters(['showrooms' => 'store']);
```

- [ ] **Step 7: Запустить — зелёные**

Run: `php artisan route:clear && TEST tests/Feature/Admin/ShowroomApiTest.php`
Expected: PASS. Если `the_card_is_updated_and_the_storefront_purged` падает на чтении `$this->tags` — свойство `private readonly` в `RevalidateStorefrontCacheJob`; замыкание `->call($job)` читает его, менять job не нужно.

- [ ] **Step 8: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Requests/Admin/ShowroomRequest.php app/Http/Resources/ShowroomAdminResource.php app/Http/Controllers/Api/Admin/ShowroomController.php routes/api.php tests/Feature/Admin/ShowroomApiTest.php
git commit -m "feat(api): admin showrooms endpoints"
```

---

### Task 3: Фото шоурума в админском API

**Files:**
- Create: `app/Http/Controllers/Api/Admin/ShowroomPhotoController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Admin/ShowroomPhotoApiTest.php`

**Interfaces:**
- Consumes: `Store::PHOTOS_COLLECTION`, `Store::MAX_PHOTOS`, `storefrontCacheTags()`.
- Produces: `GET|POST /api/admin/showrooms/{store}/photos`, `PUT …/photos/order` (`ids: int[]`), `DELETE …/photos/{media}`; элемент `{id, file_name, url, thumb_url, order}` — та же форма, что у фото товара (её ждёт `PhotosSection`).

- [ ] **Step 1: Написать падающие тесты**

`tests/Feature/Admin/ShowroomPhotoApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Jobs\RevalidateStorefrontCacheJob;
use App\Models\Product;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ShowroomPhotoApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    private Store $showroom;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        Storage::fake(config('media-library.disk_name'));
        Queue::fake();
        $this->showroom = Store::factory()->showroom()->create();
    }

    private function upload(string $name = 'hall.jpg'): int
    {
        return $this->post(
            "/api/admin/showrooms/{$this->showroom->id}/photos",
            ['file' => UploadedFile::fake()->image($name)],
            ['Accept' => 'application/json'],
        )->assertCreated()->json('data.id');
    }

    #[Test]
    public function only_staff_may_manage_photos(): void
    {
        $this->assertStaffOnly('GET', "/api/admin/showrooms/{$this->showroom->id}/photos");
    }

    #[Test]
    public function photos_are_uploaded_listed_reordered_and_deleted(): void
    {
        $this->actingAsManager();
        $first = $this->upload('a.jpg');
        $second = $this->upload('b.jpg');

        $this->getJson("/api/admin/showrooms/{$this->showroom->id}/photos")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [['id', 'file_name', 'url', 'thumb_url', 'order']]]);

        $this->putJson("/api/admin/showrooms/{$this->showroom->id}/photos/order", ['ids' => [$second, $first]])
            ->assertOk()
            ->assertJsonPath('data.0.id', $second);

        $this->deleteJson("/api/admin/showrooms/{$this->showroom->id}/photos/{$first}")->assertNoContent();
        $this->assertCount(1, $this->showroom->fresh()->getMedia(Store::PHOTOS_COLLECTION));

        Queue::assertPushed(RevalidateStorefrontCacheJob::class, 4);
    }

    #[Test]
    public function the_order_must_list_exactly_the_showroom_photos(): void
    {
        $this->actingAsManager();
        $id = $this->upload();

        $this->putJson("/api/admin/showrooms/{$this->showroom->id}/photos/order", ['ids' => [$id, 999]])
            ->assertUnprocessable();
    }

    #[Test]
    public function only_images_within_the_size_limit_are_accepted(): void
    {
        $this->actingAsManager();

        $this->post("/api/admin/showrooms/{$this->showroom->id}/photos", [
            'file' => UploadedFile::fake()->create('plan.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');

        $this->post("/api/admin/showrooms/{$this->showroom->id}/photos", [
            'file' => UploadedFile::fake()->image('huge.jpg')->size(11_000),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');
    }

    #[Test]
    public function a_showroom_holds_at_most_twenty_photos(): void
    {
        $this->actingAsManager();

        for ($i = 0; $i < Store::MAX_PHOTOS; $i++) {
            $this->showroom->addMedia(UploadedFile::fake()->image("p{$i}.jpg"))->toMediaCollection(Store::PHOTOS_COLLECTION);
        }

        $this->post("/api/admin/showrooms/{$this->showroom->id}/photos", [
            'file' => UploadedFile::fake()->image('one-more.jpg'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');
    }

    #[Test]
    public function a_photo_of_something_else_is_not_found(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $foreign = $product->addMedia(UploadedFile::fake()->image('sofa.jpg'))->toMediaCollection(Product::IMAGE_COLLECTION);

        $this->deleteJson("/api/admin/showrooms/{$this->showroom->id}/photos/{$foreign->id}")->assertNotFound();
        $this->assertCount(1, $product->fresh()->getMedia(Product::IMAGE_COLLECTION));
    }

    #[Test]
    public function a_warehouse_has_no_showroom_photos(): void
    {
        $this->actingAsManager();
        $warehouse = Store::factory()->create(['type' => 'warehouse']);

        $this->getJson("/api/admin/showrooms/{$warehouse->id}/photos")->assertNotFound();
    }
}
```

- [ ] **Step 2: Запустить — убедиться, что падают**

Run: `TEST tests/Feature/Admin/ShowroomPhotoApiTest.php`
Expected: FAIL — 404/405 на `/photos`.

- [ ] **Step 3: Контроллер**

`php artisan make:controller Api/Admin/ShowroomPhotoController --no-interaction`, содержимое:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\RevalidateStorefrontCacheJob;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/**
 * Showroom photos, one at a time, same contract as product media: the first
 * one is the cover on the storefront.
 */
class ShowroomPhotoController extends Controller
{
    public function index(Store $store): JsonResponse
    {
        $this->ensureShowroom($store);

        return response()->json(['data' => $this->presentAll($store)]);
    }

    public function store(Request $request, Store $store): JsonResponse
    {
        $this->ensureShowroom($store);

        $request->validate([
            'file' => ['required', 'file', 'mimes:jpeg,png,webp', 'max:10240'],
        ]);

        if ($store->getMedia(Store::PHOTOS_COLLECTION)->count() >= Store::MAX_PHOTOS) {
            throw ValidationException::withMessages(['file' => 'У шоурума не больше '.Store::MAX_PHOTOS.' фото.']);
        }

        $media = $store->addMediaFromRequest('file')->toMediaCollection(Store::PHOTOS_COLLECTION);
        $this->purge($store);

        return response()->json(['data' => $this->present($media)], 201);
    }

    public function order(Request $request, Store $store): JsonResponse
    {
        $this->ensureShowroom($store);

        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'distinct'],
        ]);

        $ids = array_map('intval', $validated['ids']);
        $own = $store->getMedia(Store::PHOTOS_COLLECTION)->pluck('id')->all();

        sort($own);
        $sorted = $ids;
        sort($sorted);

        if ($sorted !== $own) {
            return response()->json(['message' => 'Порядок должен перечислять ровно все фото шоурума.'], 422);
        }

        Media::setNewOrder($ids);
        $this->purge($store);

        return response()->json(['data' => $this->presentAll($store->fresh())]);
    }

    public function destroy(Store $store, Media $media): JsonResponse
    {
        $this->ensureShowroom($store);

        if ($media->collection_name !== Store::PHOTOS_COLLECTION) {
            abort(404);
        }

        $media->delete();
        $this->purge($store);

        return response()->json(null, 204);
    }

    private function ensureShowroom(Store $store): void
    {
        abort_unless($store->type === Store::TYPE_RETAIL_POINT, 404);
    }

    private function purge(Store $store): void
    {
        RevalidateStorefrontCacheJob::dispatch($store->storefrontCacheTags())->afterCommit();
    }

    /**
     * @return array{id: int, file_name: string, url: string, thumb_url: string, order: int|null}
     */
    private function present(Media $media): array
    {
        return [
            'id' => $media->id,
            'file_name' => $media->file_name,
            'url' => $media->getUrl(),
            'thumb_url' => $media->hasGeneratedConversion('card') ? $media->getUrl('card') : $media->getUrl(),
            'order' => $media->order_column,
        ];
    }

    /**
     * @return list<array{id: int, file_name: string, url: string, thumb_url: string, order: int|null}>
     */
    private function presentAll(Store $store): array
    {
        return $store->getMedia(Store::PHOTOS_COLLECTION)
            ->map(fn (Media $media): array => $this->present($media))
            ->values()
            ->all();
    }
}
```

- [ ] **Step 4: Маршруты**

В `routes/api.php`: `use App\Http\Controllers\Api\Admin\ShowroomPhotoController;` и сразу после `apiResource('showrooms', …)`:

```php
        Route::get('showrooms/{store}/photos', [ShowroomPhotoController::class, 'index']);
        Route::post('showrooms/{store}/photos', [ShowroomPhotoController::class, 'store']);
        Route::put('showrooms/{store}/photos/order', [ShowroomPhotoController::class, 'order']);
        Route::delete('showrooms/{store}/photos/{media}', [ShowroomPhotoController::class, 'destroy'])->scopeBindings();
```

- [ ] **Step 5: Запустить — зелёные**

Run: `php artisan route:clear && TEST tests/Feature/Admin/ShowroomPhotoApiTest.php`
Expected: PASS.

- [ ] **Step 6: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Controllers/Api/Admin/ShowroomPhotoController.php routes/api.php tests/Feature/Admin/ShowroomPhotoApiTest.php
git commit -m "feat(api): showroom photos in the admin API"
```

---

### Task 4: Публичный API шоурумов и `store.slug` в товаре

**Files:**
- Create: `app/Http/Resources/PublicShowroomResource.php`, `app/Http/Controllers/Api/Public/ShowroomController.php`
- Modify: `app/Http/Resources/ProductResource.php` (блок `showrooms`), `routes/api.php`
- Test: `tests/Feature/Public/ShowroomsTest.php`

**Interfaces:**
- Consumes: `publishedShowrooms()`, `isPublishedShowroom()`, `VisibilityService::publicProductQuery()`.
- Produces: `GET /api/public/showrooms` → `{data: Showroom[]}`, `GET /api/public/showrooms/{slug}` → `{data: Showroom}`, где
  `Showroom = {id, slug, name, city, address, landmark, parking, description, phone, whatsapp, lat, lng, weekly_hours, services, area, floors, is_flagship, photos: {wide, card}[], products_count, products_preview: {id, slug, name, image}[]}`;
  `ProductResource.showrooms[].store.slug: string|null`.

- [ ] **Step 1: Написать падающие тесты**

`tests/Feature/Public/ShowroomsTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\CatalogGroup;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ShowroomsTest extends TestCase
{
    use RefreshDatabase;

    private function stock(Store $store, float $quantity, array $product = []): Product
    {
        $model = Product::factory()->create($product);
        ProductStoreStock::factory()->for($model)->for($store)->create(['stock' => $quantity]);

        return $model;
    }

    #[Test]
    public function only_published_showrooms_are_listed_in_order(): void
    {
        $second = Store::factory()->showroom()->create(['name' => 'Б', 'sort_order' => 2]);
        $first = Store::factory()->showroom()->create(['name' => 'А', 'sort_order' => 1]);
        Store::factory()->showroom()->create(['show_on_site' => false]);
        Store::factory()->showroom()->create(['is_active' => false]);
        Store::factory()->showroom()->create(['type' => 'warehouse']);
        Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT, 'slug' => null, 'show_on_site' => true]);

        $this->getJson('/api/public/showrooms')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $first->id)
            ->assertJsonPath('data.1.id', $second->id)
            ->assertJsonPath('data.0.weekly_hours.0', ['open' => '10:00', 'close' => '21:00'])
            ->assertJsonPath('data.0.services', ['pickup', 'consult'])
            ->assertJsonPath('data.0.photos', [])
            ->assertJsonMissingPath('data.0.is_default');
    }

    #[Test]
    public function counts_and_preview_take_only_visible_products_in_stock(): void
    {
        $showroom = Store::factory()->showroom()->create();
        $other = Store::factory()->showroom()->create();

        $most = $this->stock($showroom, 9);
        $this->stock($showroom, 2);
        $this->stock($showroom, 0);
        $this->stock($showroom, 5, ['is_active' => false]);
        $grouped = $this->stock($showroom, 7);
        $grouped->catalogGroups()->attach(CatalogGroup::factory()->create());
        $this->stock($other, 4);

        $this->getJson("/api/public/showrooms/{$showroom->slug}")
            ->assertOk()
            ->assertJsonPath('data.products_count', 2)
            ->assertJsonCount(2, 'data.products_preview')
            ->assertJsonPath('data.products_preview.0.id', $most->id)
            ->assertJsonStructure(['data' => ['products_preview' => [['id', 'slug', 'name', 'image']]]]);
    }

    #[Test]
    public function the_preview_holds_at_most_five_products(): void
    {
        $showroom = Store::factory()->showroom()->create();

        for ($i = 0; $i < 7; $i++) {
            $this->stock($showroom, 1);
        }

        $this->getJson('/api/public/showrooms')
            ->assertJsonPath('data.0.products_count', 7)
            ->assertJsonCount(5, 'data.0.products_preview');
    }

    #[Test]
    public function a_draft_or_unknown_showroom_is_not_found(): void
    {
        $draft = Store::factory()->showroom()->create(['show_on_site' => false]);

        $this->getJson("/api/public/showrooms/{$draft->slug}")->assertNotFound();
        $this->getJson('/api/public/showrooms/nope')->assertNotFound();
    }

    #[Test]
    public function translated_fields_follow_the_locale(): void
    {
        $showroom = Store::factory()->showroom()->create([
            'landmark' => ['ru' => 'У метро', 'kk' => 'Метро жанында'],
        ]);

        $this->getJson("/api/public/showrooms/{$showroom->slug}?locale=kk")
            ->assertJsonPath('data.landmark', 'Метро жанында');
        $this->getJson("/api/public/showrooms/{$showroom->slug}")
            ->assertJsonPath('data.landmark', 'У метро');
    }

    #[Test]
    public function a_product_links_only_published_showrooms(): void
    {
        $published = Store::factory()->showroom()->create(['slug' => 'esentai']);
        $switchedOff = Store::factory()->showroom()->create(['is_active' => false]);
        $warehouse = Store::factory()->create(['type' => 'warehouse']);
        $product = Product::factory()->create(['retail_price' => 100_000]);

        foreach ([$published, $switchedOff, $warehouse] as $store) {
            ProductStoreStock::factory()->for($product)->for($store)->create(['stock' => 3]);
        }

        $showrooms = collect($this->getJson("/api/public/products/{$product->id}")->assertOk()->json('data.showrooms'))
            ->keyBy('store.id');

        $this->assertSame('esentai', $showrooms[$published->id]['store']['slug']);
        $this->assertNull($showrooms[$switchedOff->id]['store']['slug']);
        $this->assertNull($showrooms[$warehouse->id]['store']['slug']);
    }
}
```

- [ ] **Step 2: Запустить — убедиться, что падают**

Run: `TEST tests/Feature/Public/ShowroomsTest.php`
Expected: FAIL — 404 на `/api/public/showrooms`; последний тест — `Undefined array key "slug"`.

- [ ] **Step 3: `PublicShowroomResource`**

`php artisan make:resource PublicShowroomResource --no-interaction`, содержимое:

```php
<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Product;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/**
 * A published showroom for the storefront. `products_count` and the
 * `previewProducts` relation are set by Public\ShowroomController.
 *
 * @mixin Store
 */
class PublicShowroomResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $hours = $this->weekly_hours;

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'city' => $this->city,
            'address' => $this->address,
            'landmark' => $this->landmark ?: null,
            'parking' => $this->parking ?: null,
            'description' => $this->description ?: null,
            'phone' => $this->phone,
            'whatsapp' => $this->whatsapp,
            'lat' => $this->lat,
            'lng' => $this->lng,
            'weekly_hours' => is_array($hours) && count($hours) === 7 ? array_values($hours) : array_fill(0, 7, null),
            'services' => $this->services ?? [],
            'area' => $this->area,
            'floors' => $this->floors,
            'is_flagship' => $this->is_flagship,
            'photos' => $this->getMedia(Store::PHOTOS_COLLECTION)
                ->map(fn (Media $media): array => ['wide' => $media->getUrl('wide'), 'card' => $media->getUrl('card')])
                ->values()
                ->all(),
            'products_count' => (int) ($this->resource->products_count ?? 0),
            'products_preview' => $this->resource->relationLoaded('previewProducts')
                ? $this->resource->getRelation('previewProducts')->map(fn (Product $product): array => [
                    'id' => $product->id,
                    'slug' => $product->slug,
                    'name' => $product->name,
                    'image' => $product->getFirstMediaUrl(Product::IMAGE_COLLECTION, 'thumb') ?: null,
                ])->values()->all()
                : [],
        ];
    }
}
```

- [ ] **Step 4: Публичный контроллер**

`php artisan make:controller Api/Public/ShowroomController --no-interaction`, содержимое:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicShowroomResource;
use App\Models\ProductStoreStock;
use App\Models\Store;
use App\Services\Catalog\VisibilityService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Published showrooms for the storefront. Stock "in the showroom" is its
 * store's own stock, filtered by the public catalog rules; the full product
 * list comes from /public/products?store_id=…&filter[in_stock]=1.
 */
class ShowroomController extends Controller
{
    private const PREVIEW_SIZE = 5;

    public function __construct(private readonly VisibilityService $visibility) {}

    public function index(): AnonymousResourceCollection
    {
        $showrooms = Store::query()->publishedShowrooms()->with('media')->get();
        $this->attachProducts($showrooms);

        return PublicShowroomResource::collection($showrooms);
    }

    public function show(string $slug): PublicShowroomResource
    {
        $showrooms = Store::query()->publishedShowrooms()->with('media')->where('slug', $slug)->get();
        abort_if($showrooms->isEmpty(), 404);
        $this->attachProducts($showrooms);

        return new PublicShowroomResource($showrooms->first());
    }

    /**
     * One grouped count query for all showrooms, one preview query per
     * showroom (there are a handful).
     *
     * @param  Collection<int, Store>  $showrooms
     */
    private function attachProducts(Collection $showrooms): void
    {
        if ($showrooms->isEmpty()) {
            return;
        }

        $counts = ProductStoreStock::query()
            ->whereIn('store_id', $showrooms->modelKeys())
            ->where('stock', '>', 0)
            ->whereIn('product_id', $this->visibility->publicProductQuery()->select('products.id'))
            ->selectRaw('store_id, count(*) as products_count')
            ->groupBy('store_id')
            ->pluck('products_count', 'store_id');

        foreach ($showrooms as $showroom) {
            $showroom->setAttribute('products_count', (int) ($counts[$showroom->id] ?? 0));
            $showroom->setRelation('previewProducts', $this->visibility->publicProductQuery()
                ->with('media')
                ->join('product_store_stock', 'product_store_stock.product_id', '=', 'products.id')
                ->where('product_store_stock.store_id', $showroom->id)
                ->where('product_store_stock.stock', '>', 0)
                ->orderByDesc('product_store_stock.stock')
                ->orderBy('products.id')
                ->limit(self::PREVIEW_SIZE)
                ->get(['products.*']));
        }
    }
}
```

- [ ] **Step 5: Маршруты**

В `routes/api.php`: `use App\Http\Controllers\Api\Public\ShowroomController as PublicShowroomController;` и в группу `public` после `Route::get('/stores', …)`:

```php
    Route::get('/showrooms', [PublicShowroomController::class, 'index']);
    Route::get('/showrooms/{slug}', [PublicShowroomController::class, 'show']);
```

- [ ] **Step 6: `store.slug` в `ProductResource`**

В `app/Http/Resources/ProductResource.php` в блоке `'showrooms'` заменить массив `'store' => [...]` на:

```php
                    'store' => [
                        'id' => $s->store->id,
                        'name' => $s->store->name,
                        'address' => $s->store->address,
                        // Only a published showroom has a storefront page to link to.
                        'slug' => $s->store->isPublishedShowroom() ? $s->store->slug : null,
                    ],
```

- [ ] **Step 7: Запустить — зелёные, плюс соседние**

Run: `php artisan route:clear && TEST --filter='ShowroomsTest|UnapprovedCatalogTest|PublicCatalogTest|StockVisibilityTest|ProductSlugTest'`
Expected: PASS.

- [ ] **Step 8: Pint и коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Resources/PublicShowroomResource.php app/Http/Controllers/Api/Public/ShowroomController.php app/Http/Resources/ProductResource.php routes/api.php tests/Feature/Public/ShowroomsTest.php
git commit -m "feat(api): public showrooms endpoints and showroom slug on product availability"
```

---

### Task 5: Админка — модель данных шоурума, меню, список, общий раздел фото

**Files:**
- Create: `admin/src/lib/showrooms.ts`, `admin/src/app/showrooms/page.tsx`
- Modify: `admin/src/components/shell/navConfig.ts`, `admin/src/components/products/form/photos.ts`, `admin/src/components/products/form/PhotosSection.tsx`, `admin/src/components/products/form/ProductForm.tsx`

**Interfaces:**
- Consumes: админский API из Tasks 2–3.
- Produces (`@/lib/showrooms`):
  - `type Showroom`, `type ShowroomFormValues`, `showroomSchema`, `toShowroomForm(s)`, `toShowroomPayload(v)`
  - `SHOWROOM_SERVICES: { key: string; label: string }[]`, `DAY_LABELS: string[]`
  - `showroomStatus(s): 'published' | 'draft' | 'inactive'`, `STATUS_CHIP: Record<status, {label, className}>`
  - `coordsFrom2gis(link: string): { lat: number; lng: number } | null`, `twoGisUrl(lat: string, lng: string): string`
- Produces (photos): `uploadPhoto(mediaPath: string, file: File)`; `PhotosSection` prop `mediaPath: string | null` вместо `productId`.

- [ ] **Step 1: `admin/src/lib/showrooms.ts`**

```ts
import { z } from 'zod';
import { REQUIRED, SLUG_PATTERN } from '@/lib/validation';

export type ShowroomDay = { open: string; close: string } | null;

type Pair = { ru: string; kk: string };

/** Шоурум, как его отдаёт /admin/showrooms. */
export type Showroom = {
  id: number;
  name: string;
  slug: string | null;
  address: string | null;
  city: string | null;
  is_active: boolean;
  show_on_site: boolean;
  landmark: Pair;
  parking: Pair;
  description: Pair;
  phone: string | null;
  whatsapp: string | null;
  lat: number | null;
  lng: number | null;
  weekly_hours: ShowroomDay[];
  services: string[];
  area: string | null;
  floors: string | null;
  is_flagship: boolean;
  sort_order: number;
  cover_url: string | null;
  public_url: string | null;
  products_in_stock?: number;
};

export const SHOWROOM_SERVICES = [
  { key: 'pickup', label: 'Самовывоз' },
  { key: 'consult', label: 'Консультация в зале' },
  { key: 'card', label: 'Оплата картой' },
  { key: 'kids', label: 'Детская зона' },
  { key: 'cafe', label: 'Кофе-зона' },
  { key: 'assembly', label: 'Заказ сборки' },
];

export const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export type ShowroomStatus = 'published' | 'draft' | 'inactive';

/** Как на витрине: выключенный склад не виден, без адреса страницы — черновик. */
export const showroomStatus = (s: Pick<Showroom, 'is_active' | 'show_on_site' | 'slug'>): ShowroomStatus =>
  !s.is_active ? 'inactive' : s.show_on_site && s.slug ? 'published' : 'draft';

export const STATUS_CHIP: Record<ShowroomStatus, { label: string; className: string }> = {
  published: { label: 'На сайте', className: 'bg-green-100 text-green-800' },
  draft: { label: 'Черновик', className: 'bg-zinc-200 text-zinc-700' },
  inactive: { label: 'Склад выключен', className: 'bg-amber-100 text-amber-800' },
};

/**
 * Координаты из ссылки 2ГИС. 2ГИС пишет «долгота,широта»: `?m=76.93,43.22/17`
 * или `…/geo/…/76.93,43.22`. Нет пары чисел в допустимых пределах — null.
 */
export function coordsFrom2gis(link: string): { lat: number; lng: number } | null {
  let text = link.trim();

  try {
    text = decodeURIComponent(text);
  } catch {
    // Битая %-последовательность — ищем в исходной строке.
  }

  const match = text.match(/[?&]m=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ?? text.match(/\/(-?\d+\.\d+),(-?\d+\.\d+)(?=[/?#]|$)/);

  if (!match) {
    return null;
  }

  const lng = Number(match[1]);
  const lat = Number(match[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  return { lat, lng };
}

export const twoGisUrl = (lat: string, lng: string): string => `https://2gis.kz/?m=${lng}%2C${lat}%2F17`;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const pair = (max: number) => z.object({ ru: z.string().max(max), kk: z.string().max(max) });

const coordinate = (limit: number) =>
  z.string().refine((v) => v === '' || (Number.isFinite(Number(v)) && Math.abs(Number(v)) <= limit), `Число от −${limit} до ${limit}`);

export const showroomSchema = z
  .object({
    name: z.string().min(1, REQUIRED).max(255),
    slug: z.string().max(100).refine((v) => v === '' || SLUG_PATTERN.test(v), 'Только строчная латиница, цифры и дефис'),
    city: z.string().max(100),
    address: z.string().max(255),
    area: z.string().max(50),
    floors: z.string().max(50),
    sort_order: z.string().regex(/^\d*$/, 'Целое число от 0'),
    is_flagship: z.boolean(),
    show_on_site: z.boolean(),
    landmark: pair(255),
    parking: pair(255),
    description: pair(5000),
    phone: z.string().max(32),
    whatsapp: z.string().refine((v) => v === '' || /^7\d{10}$/.test(v), 'Номер с 7, 11 цифр, без плюса и пробелов'),
    lat: coordinate(90),
    lng: coordinate(180),
    weekly_hours: z.array(z.object({ enabled: z.boolean(), open: z.string(), close: z.string() })).length(7),
    services: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.show_on_site && v.slug === '') {
      ctx.addIssue({ code: 'custom', path: ['show_on_site'], message: 'Сначала заполните адрес страницы (slug)' });
    }
    if ((v.lat === '') !== (v.lng === '')) {
      ctx.addIssue({ code: 'custom', path: [v.lat === '' ? 'lat' : 'lng'], message: 'Нужны обе координаты' });
    }
    v.weekly_hours.forEach((day, index) => {
      if (!day.enabled) {
        return;
      }
      if (!TIME.test(day.open) || !TIME.test(day.close)) {
        ctx.addIssue({ code: 'custom', path: ['weekly_hours', index], message: 'Укажите время открытия и закрытия' });
      } else if (day.open >= day.close) {
        ctx.addIssue({ code: 'custom', path: ['weekly_hours', index], message: 'Открытие должно быть раньше закрытия' });
      }
    });
  });

export type ShowroomFormValues = z.infer<typeof showroomSchema>;

export function toShowroomForm(s: Showroom): ShowroomFormValues {
  return {
    name: s.name,
    slug: s.slug ?? '',
    city: s.city ?? '',
    address: s.address ?? '',
    area: s.area ?? '',
    floors: s.floors ?? '',
    sort_order: String(s.sort_order),
    is_flagship: s.is_flagship,
    show_on_site: s.show_on_site,
    landmark: { ...s.landmark },
    parking: { ...s.parking },
    description: { ...s.description },
    phone: s.phone ?? '',
    whatsapp: s.whatsapp ?? '',
    lat: s.lat === null ? '' : String(s.lat),
    lng: s.lng === null ? '' : String(s.lng),
    weekly_hours: s.weekly_hours.map((day) =>
      day ? { enabled: true, open: day.open, close: day.close } : { enabled: false, open: '10:00', close: '20:00' },
    ),
    services: [...s.services],
  };
}

/** Тело PUT /admin/showrooms/{id}. Пустые строки сервер сам превращает в null. */
export function toShowroomPayload(v: ShowroomFormValues) {
  return {
    ...v,
    sort_order: v.sort_order === '' ? 0 : Number(v.sort_order),
    lat: v.lat === '' ? null : Number(v.lat),
    lng: v.lng === '' ? null : Number(v.lng),
    weekly_hours: v.weekly_hours.map((day) => (day.enabled ? { open: day.open, close: day.close } : null)),
  };
}
```

- [ ] **Step 2: Пункт меню**

В `admin/src/components/shell/navConfig.ts` группа «Контент»:

```ts
  {
    title: 'Контент',
    links: [
      { href: '/banners', label: 'Баннеры' },
      { href: '/b2b-home', label: 'B2B-главная' },
      { href: '/showrooms', label: 'Шоурумы' },
    ],
  },
```

- [ ] **Step 3: Раздел фото принимает путь API**

`admin/src/components/products/form/photos.ts` — `uploadPhoto` берёт путь коллекции:

```ts
/** Загружает одно фото в коллекцию (`/admin/products/{id}/media`, `/admin/showrooms/{id}/photos`). */
export async function uploadPhoto(mediaPath: string, file: File): Promise<void> {
  const body = new FormData();
  body.append('file', file);

  try {
    await api.post(mediaPath, body, { headers: { 'Content-Type': 'multipart/form-data' } });
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const reported = isAxiosError(error) && (status === undefined || status >= 500 || status === 403);

    throw new PhotoUploadError(serverMessage(error) ?? 'не загрузилось', reported);
  }
}
```

`PhotosSection.tsx`:
- в `Props` заменить `productId: number | null;` на
  ```ts
  /** Путь коллекции фото в API; null — запись ещё не сохранена, файлы копятся в очереди. */
  mediaPath: string | null;
  ```
- сигнатура: `export default function PhotosSection({ mediaPath, queue, onQueueChange, busy, className }: Props)`;
- удалить строку `const path = productId ? … : null;` и заменить `useResource<Image>(path)` на `useResource<Image>(mediaPath)`;
- `const saved = mediaPath !== null ? images.items : [];`
- все `productId === null` → `mediaPath === null`, `productId !== null` → `mediaPath !== null`;
- `await uploadPhoto(productId, file)` и `await uploadPhoto(productId, photo.file)` → `await uploadPhoto(mediaPath, file)` / `await uploadPhoto(mediaPath, photo.file)` (внутри веток, где `mediaPath !== null` уже проверен; в `retry` ранний `return` при `mediaPath === null` остаётся);
- в `moveSaved` `${path}/order` → `${mediaPath}/order`;
- в комментарии компонента «Фото товара» → «Фото товара или шоурума».

`ProductForm.tsx`:
- в `uploadQueue`: `await uploadPhoto(\`/admin/products/${id}/media\`, photo.file);`
- в разметке: `<PhotosSection mediaPath={productId === null ? null : \`/admin/products/${productId}/media\`} queue={queue} onQueueChange={setQueue} busy={saving} className={LEFT} />`

- [ ] **Step 4: Список `/showrooms`**

`admin/src/app/showrooms/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { z } from 'zod';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';
import { useResource } from '@/lib/crud';
import { STATUS_CHIP, showroomStatus, type Showroom } from '@/lib/showrooms';
import { REQUIRED, SLUG_PATTERN } from '@/lib/validation';

const createSchema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  address: z.string().max(255),
  slug: z.string().max(100).refine((v) => v === '' || SLUG_PATTERN.test(v), 'Только строчная латиница, цифры и дефис'),
});

/** Шоурумы — места хранения с типом «Точка выдачи / шоурум». */
export default function ShowroomsPage() {
  const router = useRouter();
  const showrooms = useResource<Showroom>('/admin/showrooms');
  const [creating, setCreating] = useState(false);

  const addButton = (
    <button type="button" className={buttonPrimary} onClick={() => setCreating(true)}>
      Добавить шоурум
    </button>
  );

  const columns: Column<Showroom>[] = [
    {
      key: 'cover',
      header: '',
      mobile: 'hidden',
      className: 'w-16',
      render: (s) =>
        s.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.cover_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-zinc-100" />
        ),
    },
    {
      key: 'name',
      header: 'Шоурум',
      mobile: 'title',
      render: (s) => (
        <Link href={`/showrooms/${s.id}`} className="font-medium text-zinc-900 hover:text-blue-700">
          {s.name}
        </Link>
      ),
    },
    { key: 'place', header: 'Адрес', mobile: 'meta', render: (s) => [s.city, s.address].filter(Boolean).join(' · ') || '—' },
    {
      key: 'status',
      header: 'Статус',
      mobile: 'badge',
      render: (s) => {
        const chip = STATUS_CHIP[showroomStatus(s)];
        return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${chip.className}`}>{chip.label}</span>;
      },
    },
    {
      key: 'actions',
      header: '',
      mobile: 'actions',
      className: 'text-right',
      render: (s) => (
        <Link href={`/showrooms/${s.id}`} className={buttonLink}>
          Открыть
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Шоурумы" actions={addButton} />
      <p className="mb-4 text-sm text-zinc-500">
        Шоурум — место хранения с типом «Точка выдачи / шоурум»: на сайте видны его адрес, часы и товары из его остатков.
        Включить или выключить склад можно в разделе «Склад → Места хранения».
      </p>
      <DataTable
        columns={columns}
        rows={showrooms.items}
        loading={showrooms.loading}
        empty={
          <EmptyState
            title="Шоурумов нет"
            hint="Шоурум — это место хранения с типом «Точка выдачи / шоурум» — его остатки показываются на сайте."
            action={addButton}
          />
        }
      />

      {creating && (
        <CrudModal
          title="Новый шоурум"
          schema={createSchema}
          defaultValues={{ name: '', address: '', slug: '' }}
          onSubmit={async (values) => {
            const created = await showrooms.create(values);
            router.push(`/showrooms/${created.id}`);
          }}
          onClose={() => setCreating(false)}
        >
          {(form) => {
            const { errors } = form.formState;
            return (
              <>
                <Field label="Название *" htmlFor="showroom-name" error={errors.name?.message}>
                  <input id="showroom-name" className={inputClass} {...form.register('name')} />
                </Field>
                <Field label="Адрес" htmlFor="showroom-address" error={errors.address?.message}>
                  <input id="showroom-address" className={inputClass} {...form.register('address')} />
                </Field>
                <Field
                  label="Адрес страницы (slug)"
                  htmlFor="showroom-slug"
                  error={errors.slug?.message}
                  hint="Можно оставить пустым — составим из названия"
                >
                  <input id="showroom-slug" className={inputClass} {...form.register('slug')} />
                </Field>
              </>
            );
          }}
        </CrudModal>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Проверка типов и сборка**

Run: `cd admin && npx tsc --noEmit && npm run lint && npm run build`
Expected: без ошибок. (Страницы `/showrooms/[id]` ещё нет — ссылки на неё просто ведут на 404 до Task 6.)

- [ ] **Step 6: Коммит**

```bash
git add admin/src/lib/showrooms.ts admin/src/app/showrooms/page.tsx admin/src/components/shell/navConfig.ts admin/src/components/products/form/photos.ts admin/src/components/products/form/PhotosSection.tsx admin/src/components/products/form/ProductForm.tsx
git commit -m "feat(admin): showrooms list and a photo section keyed by API path"
```

---

### Task 6: Админка — карточка шоурума `/showrooms/[id]`

**Files:**
- Create: `admin/src/app/showrooms/[id]/page.tsx`, `admin/src/components/showrooms/ShowroomForm.tsx`, `admin/src/components/showrooms/HoursCard.tsx`, `admin/src/components/showrooms/MapCard.tsx`

**Interfaces:**
- Consumes: `@/lib/showrooms` (Task 5), `PhotosSection` с `mediaPath`, `FormCard`, `SaveBar`, `SectionNav`, `TranslatableField`, `Switch`, `useUnsavedGuard`, `applyServerErrors`.
- Produces: `<ShowroomForm initial={Showroom} />`, `<HoursCard form />`, `<MapCard form />`.

- [ ] **Step 1: `HoursCard.tsx`**

```tsx
'use client';

import { Controller, get, type UseFormReturn } from 'react-hook-form';
import FormCard from '@/components/products/form/FormCard';
import Switch from '@/components/ui/Switch';
import { buttonLink, inputClass } from '@/components/ui/styles';
import { DAY_LABELS, type ShowroomFormValues } from '@/lib/showrooms';

/** Часы работы: семь строк Пн→Вс, у каждой «работает» и время. */
export default function HoursCard({ form, className }: { form: UseFormReturn<ShowroomFormValues>; className?: string }) {
  const { control, register, getValues, setValue, watch, formState } = form;
  const days = watch('weekly_hours');

  const copyMonday = () => {
    const monday = getValues('weekly_hours.0');
    DAY_LABELS.forEach((_, index) => {
      if (index > 0) {
        setValue(`weekly_hours.${index}`, { ...monday }, { shouldDirty: true, shouldValidate: formState.isSubmitted });
      }
    });
  };

  return (
    <FormCard
      id="hours"
      title="Часы работы"
      className={className}
      aside={
        <button type="button" className={buttonLink} onClick={copyMonday}>
          Как в понедельник — на все дни
        </button>
      }
    >
      <ul className="divide-y divide-zinc-100">
        {DAY_LABELS.map((label, index) => {
          const error = get(formState.errors, `weekly_hours.${index}`)?.message as string | undefined;
          const enabled = days[index]?.enabled ?? false;

          return (
            <li key={label} className="py-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-8 text-sm font-medium text-zinc-700">{label}</span>
                <Controller
                  control={control}
                  name={`weekly_hours.${index}.enabled`}
                  render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label={field.value ? 'Работает' : 'Выходной'} />}
                />
                {enabled && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${label}: открытие`}
                      aria-invalid={error ? 'true' : undefined}
                      className={`${inputClass} w-28`}
                      {...register(`weekly_hours.${index}.open`)}
                    />
                    <span className="text-zinc-400">—</span>
                    <input
                      type="time"
                      aria-label={`${label}: закрытие`}
                      aria-invalid={error ? 'true' : undefined}
                      className={`${inputClass} w-28`}
                      {...register(`weekly_hours.${index}.close`)}
                    />
                  </div>
                )}
              </div>
              {error && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </FormCard>
  );
}
```

- [ ] **Step 2: `MapCard.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import FormCard from '@/components/products/form/FormCard';
import Field from '@/components/ui/Field';
import { buttonSecondary, inputClass } from '@/components/ui/styles';
import { coordsFrom2gis, twoGisUrl, type ShowroomFormValues } from '@/lib/showrooms';

/** Точка на карте: вставить ссылку из 2ГИС или ввести координаты руками. */
export default function MapCard({ form, className }: { form: UseFormReturn<ShowroomFormValues>; className?: string }) {
  const { register, setValue, watch, formState } = form;
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const lat = watch('lat');
  const lng = watch('lng');

  const applyLink = (value: string) => {
    setLink(value);

    if (value.trim() === '') {
      setLinkError(null);
      return;
    }

    const coords = coordsFrom2gis(value);

    if (!coords) {
      setLinkError('Не нашли координаты в ссылке — откройте точку в 2ГИС и скопируйте адрес страницы');
      return;
    }

    setLinkError(null);
    setValue('lat', String(coords.lat), { shouldDirty: true, shouldValidate: true });
    setValue('lng', String(coords.lng), { shouldDirty: true, shouldValidate: true });
  };

  return (
    <FormCard id="map" title="Карта" className={className}>
      <Field label="Ссылка из 2ГИС" htmlFor="showroom-2gis" error={linkError ?? undefined} hint="Координаты подставятся сами">
        <input id="showroom-2gis" className={inputClass} value={link} onChange={(e) => applyLink(e.target.value)} placeholder="https://2gis.kz/almaty/geo/…" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Широта" htmlFor="showroom-lat" error={formState.errors.lat?.message}>
          <input id="showroom-lat" inputMode="decimal" className={inputClass} aria-invalid={formState.errors.lat ? 'true' : undefined} {...register('lat')} />
        </Field>
        <Field label="Долгота" htmlFor="showroom-lng" error={formState.errors.lng?.message}>
          <input id="showroom-lng" inputMode="decimal" className={inputClass} aria-invalid={formState.errors.lng ? 'true' : undefined} {...register('lng')} />
        </Field>
      </div>
      {lat !== '' && lng !== '' && (
        <a href={twoGisUrl(lat, lng)} target="_blank" rel="noopener noreferrer" className={buttonSecondary}>
          Открыть в 2ГИС ↗
        </a>
      )}
    </FormCard>
  );
}
```

- [ ] **Step 3: `ShowroomForm.tsx`**

```tsx
'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import FormCard from '@/components/products/form/FormCard';
import PhotosSection from '@/components/products/form/PhotosSection';
import type { QueuedPhoto } from '@/components/products/form/photos';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import SaveBar from '@/components/ui/SaveBar';
import SectionNav from '@/components/ui/SectionNav';
import Switch from '@/components/ui/Switch';
import TranslatableField from '@/components/ui/TranslatableField';
import { buttonLink, buttonSecondary, inputClass } from '@/components/ui/styles';
import api from '@/lib/api';
import { applyServerErrors } from '@/lib/errors';
import {
  SHOWROOM_SERVICES,
  STATUS_CHIP,
  showroomSchema,
  showroomStatus,
  toShowroomForm,
  toShowroomPayload,
  type Showroom,
  type ShowroomFormValues,
} from '@/lib/showrooms';
import { plural } from '@/lib/text';
import { useUnsavedGuard } from '@/lib/useUnsavedGuard';
import { toast } from '@/stores/toastStore';
import HoursCard from './HoursCard';
import MapCard from './MapCard';

const SECTIONS = [
  { id: 'basic', label: 'Основное' },
  { id: 'about', label: 'Описание' },
  { id: 'contacts', label: 'Контакты' },
  { id: 'hours', label: 'Часы' },
  { id: 'services', label: 'Услуги' },
  { id: 'map', label: 'Карта' },
  { id: 'photos', label: 'Фото' },
];

const LEFT = 'lg:col-span-2 lg:col-start-1';

/**
 * Карточка шоурума. Поля — одна форма и один PUT по кнопке нижней панели;
 * фото загружаются сразу, мимо неё (раздел фото общий с товаром).
 */
export default function ShowroomForm({ initial }: { initial: Showroom }) {
  const [showroom, setShowroom] = useState(initial);
  const rootRef = useRef<HTMLDivElement>(null);
  // Очереди у шоурума не бывает: он создан до открытия карточки.
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [saving, setSaving] = useState(false);

  const form = useForm<ShowroomFormValues>({
    resolver: zodResolver(showroomSchema) as unknown as Resolver<ShowroomFormValues>,
    defaultValues: toShowroomForm(initial),
  });
  const { register, control, formState, watch } = form;
  const { errors, isDirty } = formState;
  const slug = watch('slug');

  useUnsavedGuard(isDirty && !saving);

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const revealFirstError = () =>
    requestAnimationFrame(() =>
      rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    );

  const onValid = async (values: ShowroomFormValues) => {
    try {
      const res = await api.put<{ data: Showroom }>(`/admin/showrooms/${showroom.id}`, toShowroomPayload(values));
      setShowroom(res.data.data);
      form.reset(toShowroomForm(res.data.data));
      toast.success('Сохранено');
    } catch (error) {
      const message = applyServerErrors(error, form.setError);
      if (message) {
        toast.error(message);
      }
      revealFirstError();
    }
  };

  const save = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      await form.handleSubmit(onValid, revealFirstError)();
    } finally {
      setSaving(false);
    }
  };

  const chip = STATUS_CHIP[showroomStatus(showroom)];
  const inStock = showroom.products_in_stock ?? 0;

  return (
    <div ref={rootRef} className="pb-24 lg:pb-0">
      <PageHeader
        title={showroom.name}
        back="/showrooms"
        below={<SectionNav sections={SECTIONS} onJump={jump} />}
        actions={
          <>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${chip.className}`}>{chip.label}</span>
            {showroom.public_url && (
              <a href={showroom.public_url} target="_blank" rel="noopener noreferrer" className={buttonSecondary}>
                Открыть на сайте ↗
              </a>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-x-6 lg:gap-y-4">
        <FormCard id="basic" title="Основное" className={LEFT}>
          <Field label="Название *" htmlFor="sr-name" error={errors.name?.message}>
            <input id="sr-name" className={inputClass} aria-invalid={errors.name ? 'true' : undefined} {...register('name')} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Адрес страницы (slug)" htmlFor="sr-slug" error={errors.slug?.message} hint={slug ? `/showrooms/${slug}` : 'Нужен, чтобы показать на сайте'}>
              <input id="sr-slug" className={inputClass} aria-invalid={errors.slug ? 'true' : undefined} {...register('slug')} />
            </Field>
            <Field label="Город" htmlFor="sr-city" error={errors.city?.message}>
              <input id="sr-city" className={inputClass} {...register('city')} />
            </Field>
          </div>
          <Field label="Адрес" htmlFor="sr-address" error={errors.address?.message}>
            <input id="sr-address" className={inputClass} {...register('address')} />
          </Field>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Площадь" htmlFor="sr-area" error={errors.area?.message}>
              <input id="sr-area" className={inputClass} placeholder="780 м²" {...register('area')} />
            </Field>
            <Field label="Этажность" htmlFor="sr-floors" error={errors.floors?.message}>
              <input id="sr-floors" className={inputClass} placeholder="2 этажа" {...register('floors')} />
            </Field>
            <Field label="Порядок" htmlFor="sr-sort" error={errors.sort_order?.message}>
              <input id="sr-sort" inputMode="numeric" className={inputClass} {...register('sort_order')} />
            </Field>
          </div>
        </FormCard>

        <div className="flex flex-col gap-4 lg:col-start-3 lg:row-span-7 lg:row-start-1">
          <FormCard id="status" title="Публикация">
            <Controller
              control={control}
              name="show_on_site"
              render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Показывать на сайте" />}
            />
            {errors.show_on_site?.message && (
              <p role="alert" className="text-xs text-red-600">
                {errors.show_on_site.message}
              </p>
            )}
            <Controller
              control={control}
              name="is_flagship"
              render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Флагман" />}
            />
            {!showroom.is_active && (
              <p className="text-xs text-amber-700">
                Склад выключен — на сайте шоурума не будет. Включается в{' '}
                <Link href="/warehouse/stores" className={buttonLink}>
                  «Места хранения»
                </Link>
                .
              </p>
            )}
          </FormCard>
          <FormCard id="stock" title="Наличие">
            <p className="text-sm text-zinc-700">
              В остатке {inStock} {plural(inStock, ['товар', 'товара', 'товаров'])}
            </p>
            <Link href={`/warehouse/stock?store_id=${showroom.id}`} className={buttonLink}>
              Остатки этого склада →
            </Link>
          </FormCard>
        </div>

        <FormCard id="about" title="Описание" className={LEFT}>
          <TranslatableField form={form} name="landmark" label="Ориентир" />
          <TranslatableField form={form} name="parking" label="Парковка" />
          <TranslatableField form={form} name="description" label="О шоуруме" multiline />
        </FormCard>

        <FormCard id="contacts" title="Контакты" className={LEFT}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Телефон" htmlFor="sr-phone" error={errors.phone?.message}>
              <input id="sr-phone" type="tel" className={inputClass} placeholder="+7 (727) 355-11-00" {...register('phone')} />
            </Field>
            <Field label="WhatsApp" htmlFor="sr-wa" error={errors.whatsapp?.message} hint="Номер с 7, без плюса: 77001112233">
              <input id="sr-wa" inputMode="numeric" className={inputClass} aria-invalid={errors.whatsapp ? 'true' : undefined} {...register('whatsapp')} />
            </Field>
          </div>
          {/^7\d{10}$/.test(watch('whatsapp')) && (
            <a href={`https://wa.me/${watch('whatsapp')}`} target="_blank" rel="noopener noreferrer" className={buttonLink}>
              Проверить WhatsApp ↗
            </a>
          )}
        </FormCard>

        <HoursCard form={form} className={LEFT} />

        <FormCard id="services" title="Услуги" className={LEFT}>
          <Controller
            control={control}
            name="services"
            render={({ field }) => (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SHOWROOM_SERVICES.map((service) => (
                  <label key={service.key} className="flex min-h-11 items-center gap-2 text-sm text-zinc-700 md:min-h-0">
                    <input
                      type="checkbox"
                      checked={field.value.includes(service.key)}
                      onChange={(e) =>
                        field.onChange(e.target.checked ? [...field.value, service.key] : field.value.filter((key) => key !== service.key))
                      }
                    />
                    {service.label}
                  </label>
                ))}
              </div>
            )}
          />
        </FormCard>

        <MapCard form={form} className={LEFT} />

        <PhotosSection mediaPath={`/admin/showrooms/${showroom.id}/photos`} queue={queue} onQueueChange={setQueue} busy={saving} className={LEFT} />
      </div>

      <SaveBar dirty={isDirty} canSave={isDirty} saving={saving} onSave={() => void save()} onReset={() => form.reset()} />
    </div>
  );
}
```

Примечание: фото сохраняются сразу, поэтому обложка в списке обновится после перехода назад (список перезагружается при монтировании).

- [ ] **Step 4: Страница `/showrooms/[id]`**

`admin/src/app/showrooms/[id]/page.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { isAxiosError } from 'axios';
import ShowroomForm from '@/components/showrooms/ShowroomForm';
import { buttonLink, buttonSecondary } from '@/components/ui/styles';
import api from '@/lib/api';
import type { Showroom } from '@/lib/showrooms';

type State = { status: 'loading' } | { status: 'ready'; showroom: Showroom } | { status: 'missing' } | { status: 'failed' };

export default function ShowroomPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });

    try {
      const res = await api.get<{ data: Showroom }>(`/admin/showrooms/${id}`);
      setState({ status: 'ready', showroom: res.data.data });
    } catch (error) {
      setState({ status: isAxiosError(error) && error.response?.status === 404 ? 'missing' : 'failed' });
    }
  }, [id]);

  useEffect(() => {
    // Загрузка при открытии — синхронизация с API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <div role="status" aria-busy="true" aria-label="Загрузка шоурума" className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-xl bg-zinc-200/70" />
        <div className="h-48 animate-pulse rounded-xl bg-zinc-200/70" />
        <div className="h-36 animate-pulse rounded-xl bg-zinc-200/70" />
      </div>
    );
  }

  if (state.status !== 'ready') {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-lg font-semibold text-zinc-900">{state.status === 'missing' ? 'Шоурум не найден' : 'Не удалось загрузить шоурум'}</p>
        <div className="flex justify-center gap-4">
          {state.status === 'failed' && (
            <button type="button" className={buttonSecondary} onClick={() => void load()}>
              Повторить
            </button>
          )}
          <Link href="/showrooms" className={buttonLink}>
            К списку шоурумов
          </Link>
        </div>
      </div>
    );
  }

  return <ShowroomForm initial={state.showroom} />;
}
```

- [ ] **Step 5: Проверка типов, линт, сборка**

Run: `cd admin && npx tsc --noEmit && npm run lint && npm run build`
Expected: без ошибок. Если tsc ругается на путь `weekly_hours.${index}` в `setValue`/`register` — привести шаблон к `` `weekly_hours.${index}` as const ``.

- [ ] **Step 6: Коммит**

```bash
git add admin/src/app/showrooms admin/src/components/showrooms
git commit -m "feat(admin): showroom card with hours, services, map and photos"
```

---

### Task 7: Витрина — типы, утилиты, переводы, страница списка

**Files:**
- Create: `storefront/src/lib/showrooms.ts`, `storefront/src/lib/use-now.ts`, `storefront/src/components/showrooms/OpenStatus.tsx`
- Modify: `storefront/src/lib/types.ts`, `storefront/src/messages/ru.json`, `storefront/src/messages/kk.json`
- Rewrite: `storefront/src/app/[locale]/showrooms/page.tsx`, `storefront/src/app/[locale]/showrooms/ShowroomsClient.tsx`

**Interfaces:**
- Consumes: `GET /public/showrooms`, `GET /public/settings` (контакты для пустого состояния).
- Produces:
  - `types.ts`: `ShowroomDay`, `ShowroomService`, `Showroom`, `ShowroomPhoto`, `ShowroomProductPreview`; `ProductShowroom.store.slug: string | null`
  - `lib/showrooms.ts`: `DAY_KEYS`, `dayIndex(date)`, `openState(hours, now): OpenState`, `scheduleRows(hours): ScheduleRow[]`, `mapUrl(point)`, `routeUrl(point)`, `whatsappUrl(number)`, `telHref(phone)`
  - `lib/use-now.ts`: `useNow(): Date | null`
  - `components/showrooms/OpenStatus.tsx`: `<OpenBadge hours size? />`, `<TodayLine hours />`

- [ ] **Step 1: Типы**

В `storefront/src/lib/types.ts`: у `ProductShowroom.store` добавить `slug: string | null;`, и в конец файла:

```ts
/** One day of `weekly_hours` (index 0 = Monday); null = day off. */
export type ShowroomDay = { open: string; close: string } | null;

export type ShowroomService = "pickup" | "consult" | "card" | "kids" | "cafe" | "assembly";

export interface ShowroomPhoto {
  wide: string;
  card: string;
}

export interface ShowroomProductPreview {
  id: number;
  slug: string | null;
  name: string;
  image: string | null;
}

export interface Showroom {
  id: number;
  slug: string;
  name: string;
  city: string | null;
  address: string | null;
  landmark: string | null;
  parking: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  lat: number | null;
  lng: number | null;
  weekly_hours: ShowroomDay[];
  services: ShowroomService[];
  area: string | null;
  floors: string | null;
  is_flagship: boolean;
  photos: ShowroomPhoto[];
  products_count: number;
  products_preview: ShowroomProductPreview[];
}
```

- [ ] **Step 2: `lib/showrooms.ts`**

```ts
import type { ShowroomDay } from "./types";

/** Message keys of `showrooms.days`, index 0 = Monday like `weekly_hours`. */
export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export function dayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function minutes(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

export type OpenState =
  | { kind: "open"; until: string }
  | { kind: "opens-today"; at: string }
  | { kind: "opens-later"; day: number; at: string }
  | { kind: "closed" };

/** Open/closed by the visitor's clock (the showrooms are local to them). */
export function openState(hours: ShowroomDay[], now: Date): OpenState {
  const today = dayIndex(now);
  const current = now.getHours() * 60 + now.getMinutes();
  const todayHours = hours[today];

  if (todayHours && current >= minutes(todayHours.open) && current < minutes(todayHours.close)) {
    return { kind: "open", until: todayHours.close };
  }
  if (todayHours && current < minutes(todayHours.open)) {
    return { kind: "opens-today", at: todayHours.open };
  }
  for (let offset = 1; offset <= 7; offset++) {
    const day = (today + offset) % 7;
    const next = hours[day];
    if (next) {
      return { kind: "opens-later", day, at: next.open };
    }
  }

  return { kind: "closed" };
}

export type ScheduleRow = { from: number; to: number; hours: ShowroomDay };

/** Consecutive days with equal hours collapse into one row ("Пн–Пт 10:00–21:00"). */
export function scheduleRows(hours: ShowroomDay[]): ScheduleRow[] {
  const key = (day: ShowroomDay) => (day ? `${day.open}-${day.close}` : "off");
  const rows: ScheduleRow[] = [];

  hours.forEach((day, index) => {
    const last = rows[rows.length - 1];
    if (last && key(last.hours) === key(day)) {
      last.to = index;
    } else {
      rows.push({ from: index, to: index, hours: day });
    }
  });

  return rows;
}

type Point = { lat: number | null; lng: number | null };

/** 2GIS writes "lng,lat". */
export function mapUrl({ lat, lng }: Point): string | null {
  return lat === null || lng === null ? null : `https://2gis.kz/?m=${lng}%2C${lat}%2F17`;
}

export function routeUrl({ lat, lng }: Point): string | null {
  return lat === null || lng === null ? null : `https://2gis.kz/directions/points/%7C${lng}%2C${lat}%3B`;
}

export function whatsappUrl(whatsapp: string | null): string | null {
  return whatsapp ? `https://wa.me/${whatsapp}` : null;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
```

- [ ] **Step 3: `lib/use-now.ts`**

```ts
"use client";

import { useEffect, useState } from "react";

/**
 * The visitor's clock, ticking every minute. null during SSR and the first
 * client render, so "open now" never differs between server and browser.
 */
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return now;
}
```

- [ ] **Step 4: `components/showrooms/OpenStatus.tsx`**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { DAY_KEYS, dayIndex, openState } from "@/lib/showrooms";
import type { ShowroomDay } from "@/lib/types";
import { useNow } from "@/lib/use-now";

/**
 * Open/closed state and its caption ("до 21:00", "откроется в Пн в 10:00").
 * null until the client knows the time — SSR and hydration render nothing.
 */
function useOpenInfo(hours: ShowroomDay[]) {
  const t = useTranslations("showrooms");
  const now = useNow();

  if (!now) {
    return null;
  }

  const state = openState(hours, now);
  let caption = "";

  if (state.kind === "open") {
    caption = t("until", { time: state.until });
  } else if (state.kind === "opens-today") {
    caption = t("opensToday", { time: state.at });
  } else if (state.kind === "opens-later") {
    caption = t("opensOn", { day: t(`days.${DAY_KEYS[state.day]}`), time: state.at });
  }

  return { now, open: state.kind === "open", caption };
}

/** "Открыто · до 21:00" chip. */
export function OpenBadge({ hours, withSubtitle = false }: { hours: ShowroomDay[]; withSubtitle?: boolean }) {
  const t = useTranslations("showrooms");
  const info = useOpenInfo(hours);

  if (!info) {
    return null;
  }

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] py-1.5 text-xs font-bold"
      style={{ backgroundColor: info.open ? "#e3f3ea" : "#f0eee9", color: info.open ? "#1d6b4f" : "#8a8477" }}
    >
      <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: info.open ? "#2f9e6f" : "#c2bcb1" }} />
      {info.open ? t("open") : t("closed")}
      {withSubtitle && info.caption && ` · ${info.caption}`}
    </span>
  );
}

/** "До 21:00 · сегодня 10:00–21:00". */
export function TodayLine({ hours }: { hours: ShowroomDay[] }) {
  const t = useTranslations("showrooms");
  const info = useOpenInfo(hours);

  if (!info) {
    return null;
  }

  const today = hours[dayIndex(info.now)];
  const todayText = t("todayHours", { hours: today ? `${today.open}–${today.close}` : t("dayOff").toLowerCase() });
  const caption = info.caption.charAt(0).toUpperCase() + info.caption.slice(1);

  return <span>{[caption, todayText].filter(Boolean).join(" · ")}</span>;
}
```

- [ ] **Step 5: Переводы**

В `storefront/src/messages/ru.json` добавить верхнеуровневый ключ `"showrooms"` (после `"tracking"`):

```json
  "showrooms": {
    "title": "Шоурумы Paradise.kz",
    "breadcrumb": "Шоурумы",
    "lead": "Приходите посмотреть и потрогать мебель вживую. Наличие указано для каждой точки, маршрут — в один клик.",
    "count": "{count, plural, one {шоурум} few {шоурума} other {шоурумов}}",
    "cities": "{count, plural, one {город} few {города} other {городов}}",
    "found": "Найдено {count, plural, one {# шоурум} few {# шоурума} other {# шоурумов}}",
    "allCities": "Все города",
    "city": "Город",
    "empty": "Шоурумы скоро появятся на сайте. А пока звоните нам:",
    "open": "Открыто",
    "closed": "Закрыто",
    "until": "до {time}",
    "opensToday": "откроется сегодня в {time}",
    "opensOn": "откроется в {day} в {time}",
    "todayHours": "сегодня {hours}",
    "dayOff": "Выходной",
    "today": "сегодня",
    "route": "Построить маршрут",
    "onMap": "На карте 2ГИС",
    "openIn2gis": "Открыть в 2ГИС",
    "whatsapp": "WhatsApp",
    "hours": "Часы работы",
    "flagship": "Флагман",
    "flagshipLong": "Флагманский шоурум",
    "productsHere": "В этой точке — {count, plural, one {# товар} few {# товара} other {# товаров}}",
    "seeAll": "Смотреть все →",
    "productsTitle": "Товары в этом шоуруме",
    "productsHint": "Наличие указано для этой точки. Нажмите на товар, чтобы открыть карточку.",
    "noProducts": "Сейчас в этой точке нет товаров в наличии.",
    "allShowrooms": "← Все шоурумы Paradise.kz",
    "days": { "mon": "Пн", "tue": "Вт", "wed": "Ср", "thu": "Чт", "fri": "Пт", "sat": "Сб", "sun": "Вс" },
    "services": {
      "pickup": "Самовывоз",
      "consult": "Консультация в зале",
      "card": "Оплата картой",
      "kids": "Детская зона",
      "cafe": "Кофе-зона",
      "assembly": "Заказ сборки"
    }
  }
```

В `storefront/src/messages/kk.json` — тот же набор ключей:

```json
  "showrooms": {
    "title": "Paradise.kz шоурумдары",
    "breadcrumb": "Шоурумдар",
    "lead": "Жиһазды тікелей көріп, ұстап көруге келіңіз. Әр нүктедегі қолжетімділік көрсетілген, бағдар — бір рет басумен.",
    "count": "{count, plural, other {шоурум}}",
    "cities": "{count, plural, other {қала}}",
    "found": "{count, plural, other {# шоурум}} табылды",
    "allCities": "Барлық қалалар",
    "city": "Қала",
    "empty": "Шоурумдар сайтта жақында пайда болады. Әзірге бізге қоңырау шалыңыз:",
    "open": "Ашық",
    "closed": "Жабық",
    "until": "{time} дейін",
    "opensToday": "бүгін {time} ашылады",
    "opensOn": "{day} {time} ашылады",
    "todayHours": "бүгін {hours}",
    "dayOff": "Демалыс күні",
    "today": "бүгін",
    "route": "Бағдар салу",
    "onMap": "2ГИС картасында",
    "openIn2gis": "2ГИС-те ашу",
    "whatsapp": "WhatsApp",
    "hours": "Жұмыс уақыты",
    "flagship": "Флагман",
    "flagshipLong": "Флагмандық шоурум",
    "productsHere": "Бұл нүктеде — {count, plural, other {# тауар}}",
    "seeAll": "Барлығын көру →",
    "productsTitle": "Осы шоурумдағы тауарлар",
    "productsHint": "Қолжетімділік осы нүкте үшін көрсетілген. Карточканы ашу үшін тауарды басыңыз.",
    "noProducts": "Қазір бұл нүктеде қолда бар тауар жоқ.",
    "allShowrooms": "← Paradise.kz барлық шоурумдары",
    "days": { "mon": "Дс", "tue": "Сс", "wed": "Ср", "thu": "Бс", "fri": "Жм", "sat": "Сб", "sun": "Жс" },
    "services": {
      "pickup": "Өзі алып кету",
      "consult": "Залда кеңес беру",
      "card": "Картамен төлеу",
      "kids": "Балалар аймағы",
      "cafe": "Кофе аймағы",
      "assembly": "Құрастыруға тапсырыс"
    }
  }
```

Проверка валидности: `node -e "JSON.parse(require('fs').readFileSync('storefront/src/messages/ru.json'));JSON.parse(require('fs').readFileSync('storefront/src/messages/kk.json'))"`.

- [ ] **Step 6: Страница списка (сервер)**

`storefront/src/app/[locale]/showrooms/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { apiGet } from "@/lib/api";
import type { Settings, Showroom } from "@/lib/types";
import { ShowroomsClient } from "./ShowroomsClient";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "showrooms" });

  return { title: t("title"), description: t("lead") };
}

export default async function ShowroomsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("showrooms");

  const [showrooms, settings] = await Promise.all([
    apiGet<{ data: Showroom[] }>("/public/showrooms", { locale, tags: ["showrooms"] }),
    apiGet<{ data: Settings }>("/public/settings", { locale }),
  ]);

  return (
    <div className="min-h-screen bg-surface font-sans">
      <div className="mx-auto max-w-[1360px] px-4 pt-5 sm:px-8">
        <Breadcrumbs items={[{ label: t("breadcrumb") }]} />
      </div>
      <ShowroomsClient showrooms={showrooms.data} contactPhone={settings.data.contacts.phone} />
    </div>
  );
}
```

- [ ] **Step 7: `ShowroomsClient.tsx` (переписать целиком)**

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { OpenBadge, TodayLine } from "@/components/showrooms/OpenStatus";
import { mapUrl, routeUrl, telHref, whatsappUrl } from "@/lib/showrooms";
import type { Showroom } from "@/lib/types";

const PREVIEW = 5;

export function ShowroomsClient({ showrooms, contactPhone }: { showrooms: Showroom[]; contactPhone: string | null }) {
  const t = useTranslations("showrooms");
  const [city, setCity] = useState<string | null>(null);

  const cities = Array.from(new Set(showrooms.map((s) => s.city).filter((c): c is string => Boolean(c))));
  const list = city ? showrooms.filter((s) => s.city === city) : showrooms;

  const chip = (active: boolean) =>
    `inline-flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-full border px-4 py-2 font-sans text-sm font-semibold transition-colors ${
      active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/80 hover:border-ink/30"
    }`;

  return (
    <>
      <div className="mx-auto max-w-[1360px] px-4 pt-[18px] sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="m-0 font-display text-[28px] font-extrabold tracking-tight text-ink sm:text-[34px]">{t("title")}</h1>
            <p className="mt-2 max-w-[560px] text-[15px] leading-relaxed text-muted">{t("lead")}</p>
          </div>
          {showrooms.length > 0 && (
            <div className="flex shrink-0 gap-[26px]">
              <div>
                <div className="font-display text-[26px] font-bold text-ink">{showrooms.length}</div>
                <div className="text-[13px] text-muted">{t("count", { count: showrooms.length })}</div>
              </div>
              {cities.length > 0 && (
                <div>
                  <div className="font-display text-[26px] font-bold text-ink">{cities.length}</div>
                  <div className="text-[13px] text-muted">{t("cities", { count: cities.length })}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {cities.length > 1 && (
          <div className="mt-[22px] flex flex-wrap items-center gap-2">
            <span className="mr-0.5 text-[13px] font-semibold text-muted">{t("city")}</span>
            <button type="button" onClick={() => setCity(null)} className={chip(city === null)}>
              {t("allCities")}
              <span className="text-[12px] font-semibold opacity-65">{showrooms.length}</span>
            </button>
            {cities.map((c) => (
              <button key={c} type="button" onClick={() => setCity(c)} className={chip(city === c)}>
                {c}
                <span className="text-[12px] font-semibold opacity-65">{showrooms.filter((s) => s.city === c).length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-[1360px] px-4 pb-16 pt-[22px] sm:px-8">
        {showrooms.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white p-12 text-center text-muted">
            {t("empty")}{" "}
            {contactPhone && (
              <a href={telHref(contactPhone)} className="font-semibold text-ink">
                {contactPhone}
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-muted">{t("found", { count: list.length })}</div>
            <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
              {list.map((s) => (
                <ShowroomCard key={s.id} showroom={s} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ShowroomCard({ showroom: s }: { showroom: Showroom }) {
  const t = useTranslations("showrooms");
  const detailHref = `/showrooms/${s.slug}`;
  const route = routeUrl(s);
  const map = mapUrl(s);
  const whatsapp = whatsappUrl(s.whatsapp);
  const more = Math.max(0, s.products_count - s.products_preview.length);

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-colors hover:border-ink/20">
      <div className="grid grid-cols-1 sm:grid-cols-[188px_1fr]">
        <Link
          href={detailHref}
          className="relative block min-h-[180px] bg-card bg-cover bg-center no-underline"
          style={s.photos[0] ? { backgroundImage: `url(${s.photos[0].card})` } : undefined}
        >
          {s.is_flagship && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-ink/80 px-[9px] py-1 text-[11px] font-bold text-white">
              {t("flagship")}
            </span>
          )}
        </Link>

        <div className="flex min-w-0 flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={detailHref} className="no-underline">
                <h2 className="m-0 font-display text-[19px] font-bold leading-tight tracking-tight text-ink">{s.name}</h2>
              </Link>
              {s.city && <div className="mt-1 text-[13px] text-muted">{s.city}</div>}
            </div>
            <OpenBadge hours={s.weekly_hours} />
          </div>

          <div className="flex flex-col gap-1.5 text-[13.5px] text-ink/80">
            {s.address && (
              <div>
                {s.address}
                {s.landmark && <span className="text-muted"> · {s.landmark}</span>}
              </div>
            )}
            <TodayLine hours={s.weekly_hours} />
          </div>

          {s.services.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {s.services.slice(0, 3).map((service) => (
                <span key={service} className="rounded-full bg-surface px-2.5 py-1 text-xs text-ink/80">
                  {t(`services.${service}`)}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {route && (
              <a href={route} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full bg-ink px-[15px] py-[9px] text-[13px] font-semibold text-white no-underline hover:bg-ink/90">
                {t("route")}
              </a>
            )}
            {s.phone && (
              <a href={telHref(s.phone)} className="inline-flex items-center rounded-full border border-line bg-white px-[15px] py-[9px] text-[13px] font-semibold text-ink no-underline hover:border-ink/30">
                {s.phone}
              </a>
            )}
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-line bg-white px-[13px] py-[9px] text-[13px] font-semibold text-[#1d6b4f] no-underline hover:border-ink/30">
                {t("whatsapp")}
              </a>
            )}
            {map && (
              <a href={map} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-[9px] text-[13px] font-semibold text-red-600 no-underline hover:text-red-700">
                {t("onMap")}
              </a>
            )}
          </div>

          {s.products_count > 0 && (
            <div className="mt-1.5 border-t border-line pt-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-ink">{t("productsHere", { count: s.products_count })}</span>
                <Link href={detailHref} className="whitespace-nowrap text-[13px] font-semibold text-red-600 no-underline hover:text-red-700">
                  {t("seeAll")}
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-[9px]">
                {s.products_preview.slice(0, PREVIEW).map((p) => (
                  <Link
                    key={p.id}
                    href={`/product/${p.slug ?? p.id}`}
                    title={p.name}
                    className="block h-[58px] w-[58px] shrink-0 overflow-hidden rounded-xl border border-line bg-card bg-cover bg-center no-underline"
                    style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}
                  />
                ))}
                {more > 0 && (
                  <Link
                    href={detailHref}
                    className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-xl border border-dashed border-line bg-surface text-[13px] font-bold text-muted no-underline hover:border-ink/30 hover:text-ink"
                  >
                    +{more}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 8: Проверка типов** (страница `[slug]` и `ShowroomAvailability` ещё на заглушке — они в Task 8; `tsc` должен пройти, т. к. `showroom-data.ts` пока на месте)

Run: `cd storefront && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 9: Коммит**

```bash
git add storefront/src/lib/types.ts storefront/src/lib/showrooms.ts storefront/src/lib/use-now.ts storefront/src/components/showrooms storefront/src/messages/ru.json storefront/src/messages/kk.json "storefront/src/app/[locale]/showrooms/page.tsx" "storefront/src/app/[locale]/showrooms/ShowroomsClient.tsx"
git commit -m "feat(storefront): showrooms list from the API"
```

---

### Task 8: Витрина — страница шоурума, ссылки из карточки товара, удаление заглушки

**Files:**
- Rewrite: `storefront/src/app/[locale]/showrooms/[slug]/page.tsx`, `storefront/src/app/[locale]/showrooms/[slug]/ShowroomClient.tsx`
- Modify: `storefront/src/components/product/ShowroomAvailability.tsx`
- Delete: `storefront/src/lib/showroom-data.ts`

**Interfaces:**
- Consumes: `GET /public/showrooms/{slug}`, `GET /public/products?store_id&filter[in_stock]=1&page`, всё из Task 7, `ProductCard`, `AddToCartButton`, `Pagination`, `Breadcrumbs`.

- [ ] **Step 1: Страница (сервер)**

`storefront/src/app/[locale]/showrooms/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AddToCartButton } from "@/components/AddToCartButton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Pagination } from "@/components/Pagination";
import { ProductCard } from "@/components/ProductCard";
import { Link } from "@/i18n/navigation";
import { ApiError, apiGet } from "@/lib/api";
import type { Paginated, Product, Showroom } from "@/lib/types";
import { ShowroomClient } from "./ShowroomClient";

type Params = Promise<{ locale: string; slug: string }>;

async function fetchShowroom(slug: string, locale: string): Promise<Showroom | null> {
  try {
    const response = await apiGet<{ data: Showroom }>(`/public/showrooms/${encodeURIComponent(slug)}`, {
      locale,
      tags: ["showrooms", `showroom:${slug}`],
    });
    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const showroom = await fetchShowroom(slug, locale);

  return showroom ? { title: showroom.name, description: showroom.address ?? undefined } : {};
}

export default async function ShowroomPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("showrooms");

  const showroom = await fetchShowroom(slug, locale);
  if (!showroom) {
    notFound();
  }

  const { page } = await searchParams;
  const products = await apiGet<Paginated<Product>>("/public/products", {
    locale,
    tags: ["products", `showroom:${slug}`],
    searchParams: { store_id: showroom.id, "filter[in_stock]": 1, page },
  });

  return (
    <div className="min-h-screen bg-surface font-sans">
      <div className="mx-auto max-w-[1360px] px-4 pt-5 sm:px-8">
        <Breadcrumbs items={[{ label: t("breadcrumb"), href: "/showrooms" }, { label: showroom.name }]} />
      </div>

      <ShowroomClient showroom={showroom} />

      <section className="mx-auto max-w-[1360px] px-4 pb-14 sm:px-8">
        <h2 className="m-0 mb-1.5 font-display text-2xl font-bold tracking-tight text-ink">
          {t("productsTitle")} <span className="text-base font-medium text-muted">· {products.meta.total}</span>
        </h2>
        <p className="m-0 mb-5 text-sm text-muted">{t("productsHint")}</p>

        {products.data.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white p-10 text-center text-muted">{t("noProducts")}</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] items-start gap-[22px]">
            {products.data.map((product) => (
              <div key={product.id} className="flex flex-col gap-2">
                <ProductCard product={product} showOverlay={false} showAddToCart={false} />
                <AddToCartButton product={product} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-9 flex flex-col items-center gap-6">
          <Pagination meta={products.meta} pathname={`/showrooms/${slug}`} searchParams={{ page }} />
          <Link href="/showrooms" className="inline-flex items-center rounded-xl border border-line bg-white px-[22px] py-3 text-sm font-semibold text-ink no-underline hover:border-ink/30">
            {t("allShowrooms")}
          </Link>
        </div>
      </section>
    </div>
  );
}
```

Проверить, что `AddToCartButton` экспортируется именованно (`grep -n "export" storefront/src/components/AddToCartButton.tsx`); если по умолчанию — поправить импорт.

- [ ] **Step 2: `ShowroomClient.tsx` (переписать целиком)**

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { OpenBadge } from "@/components/showrooms/OpenStatus";
import { DAY_KEYS, dayIndex, mapUrl, routeUrl, scheduleRows, telHref, whatsappUrl } from "@/lib/showrooms";
import type { Showroom } from "@/lib/types";
import { useNow } from "@/lib/use-now";

export function ShowroomClient({ showroom: s }: { showroom: Showroom }) {
  const t = useTranslations("showrooms");
  const now = useNow();
  const [photo, setPhoto] = useState(0);

  const today = now ? dayIndex(now) : -1;
  const route = routeUrl(s);
  const map = mapUrl(s);
  const whatsapp = whatsappUrl(s.whatsapp);
  const facts = [s.area, s.floors, s.parking].filter(Boolean).join(" · ");
  const dayLabel = (index: number) => t(`days.${DAY_KEYS[index]}`);

  return (
    <div className="mx-auto max-w-[1360px] px-4 pb-10 pt-[18px] sm:px-8">
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <div
            className="relative overflow-hidden rounded-2xl border border-line bg-card bg-cover bg-center"
            style={{ aspectRatio: "16/10", ...(s.photos[photo] ? { backgroundImage: `url(${s.photos[photo].wide})` } : {}) }}
          >
            {s.is_flagship && (
              <span className="absolute left-3.5 top-3.5 inline-flex items-center rounded-full bg-ink/80 px-3 py-1.5 text-xs font-bold text-white">
                {t("flagshipLong")}
              </span>
            )}
          </div>
          {s.photos.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {s.photos.map((p, i) => (
                <button
                  key={p.card}
                  type="button"
                  aria-label={`${i + 1}`}
                  onClick={() => setPhoto(i)}
                  className={`cursor-pointer overflow-hidden rounded-xl border-2 bg-card bg-cover bg-center p-0 ${i === photo ? "border-red-600" : "border-transparent"}`}
                  style={{ aspectRatio: "1/1", backgroundImage: `url(${p.card})` }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-7">
            <div className="mb-1.5 flex items-start justify-between gap-3">
              <h1 className="m-0 font-display text-[26px] font-bold leading-tight tracking-tight text-ink">{s.name}</h1>
              <OpenBadge hours={s.weekly_hours} withSubtitle />
            </div>
            {s.city && <div className="mb-4 text-[13px] text-muted">{s.city}</div>}

            <div className="flex flex-col gap-2.5 border-b border-line pb-4 text-sm text-ink/80">
              {s.address && (
                <div>
                  <b className="font-semibold text-ink">{s.address}</b>
                  {s.landmark && <div className="text-muted">{s.landmark}</div>}
                </div>
              )}
              {facts && <div>{facts}</div>}
              {s.phone && (
                <a href={telHref(s.phone)} className="font-semibold text-ink no-underline">
                  {s.phone}
                </a>
              )}
            </div>

            <div className="my-4 flex flex-wrap gap-2.5">
              {route && (
                <a href={route} target="_blank" rel="noopener noreferrer" className="flex min-w-[180px] flex-1 items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white no-underline hover:bg-red-700">
                  {t("route")}
                </a>
              )}
              {map && (
                <a href={map} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink no-underline hover:border-ink/30">
                  {t("openIn2gis")}
                </a>
              )}
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-[#1d6b4f] no-underline hover:border-ink/30">
                  {t("whatsapp")}
                </a>
              )}
            </div>

            {s.services.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {s.services.map((service) => (
                  <span key={service} className="inline-flex items-center rounded-full bg-surface px-[11px] py-1 text-[12.5px] text-ink/80">
                    ✓ {t(`services.${service}`)}
                  </span>
                ))}
              </div>
            )}

            {s.description && <p className="mb-0 mt-4 whitespace-pre-line text-sm leading-relaxed text-ink/80">{s.description}</p>}
          </div>

          <div className="rounded-2xl border border-line bg-white px-6 py-5 shadow-sm sm:px-7">
            <h2 className="m-0 mb-3.5 font-display text-base font-bold text-ink">{t("hours")}</h2>
            {scheduleRows(s.weekly_hours).map((row) => {
              const isToday = today >= row.from && today <= row.to;
              const range = row.from === row.to ? dayLabel(row.from) : `${dayLabel(row.from)}–${dayLabel(row.to)}`;
              return (
                <div
                  key={row.from}
                  className={`flex items-center justify-between gap-3 border-b border-dashed border-line py-2 text-sm last:border-0 ${row.hours ? "text-ink" : "text-muted"} ${isToday ? "font-bold" : ""}`}
                >
                  <span>
                    {range}
                    {isToday && <span className="ml-2 rounded-full bg-red-600/10 px-2 py-0.5 text-[11px] font-bold text-red-600">{t("today")}</span>}
                  </span>
                  <span>{row.hours ? `${row.hours.open}–${row.hours.close}` : t("dayOff")}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Ссылки из карточки товара**

В `storefront/src/components/product/ShowroomAvailability.tsx` три места со ссылкой `href={\`/showrooms/${…store.id}\`}`:
- у названия (строка ~66): заменить `<Link …>{sr.store.name}</Link>` на
  ```tsx
  {sr.store.slug ? (
    <Link href={`/showrooms/${sr.store.slug}`} className="text-[15px] font-semibold text-ink decoration-2 hover:underline">
      {sr.store.name}
    </Link>
  ) : (
    <span className="text-[15px] font-semibold text-ink">{sr.store.name}</span>
  )}
  ```
- кнопку «Подробнее» (строка ~106) обернуть: `{sr.store.slug && (<Link href={\`/showrooms/${sr.store.slug}\`} …>Подробнее</Link>)}`;
- «Страница шоурума» в окне карты (строка ~196) обернуть так же: `{mapSr.store.slug && (<Link href={\`/showrooms/${mapSr.store.slug}\`} …>Страница шоурума</Link>)}`.

- [ ] **Step 4: Удалить заглушку и убедиться, что на неё никто не ссылается**

```bash
git rm storefront/src/lib/showroom-data.ts
grep -rn "showroom-data" storefront/src || echo "no references"
```

Expected: `no references`.

- [ ] **Step 5: Проверка типов и сборка**

Run: `cd storefront && npx tsc --noEmit && npm run build`
Expected: без ошибок. Если сборка падает на запросе к API при пререндере — страницы шоурумов уже динамические (`searchParams`), список — ISR с `revalidate: 300`; при недоступном API в CI сборка каталога ведёт себя так же, как соседние страницы (`/promotions`), ничего особого не делать.

- [ ] **Step 6: Коммит**

```bash
git add -A "storefront/src/app/[locale]/showrooms" storefront/src/components/product/ShowroomAvailability.tsx storefront/src/lib/showroom-data.ts
git commit -m "feat(storefront): showroom page from the API, product availability links by slug, mock data removed"
```

---

### Task 9: Полная проверка и проверка в браузере

**Files:** —

- [ ] **Step 1: Весь PHP-сьют и Pint**

```bash
vendor/bin/pint --dirty --format agent
STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact
```

Expected: зелёный (минус базовые падения, записанные в Task 1, Step 0 — они не должны прибавиться).

- [ ] **Step 2: Front-ends**

```bash
(cd admin && npx tsc --noEmit && npm run lint && npm run build)
(cd storefront && npx tsc --noEmit && npm run build)
```

- [ ] **Step 3: Данные для ручной проверки**

Локальная база — `paradise` (MySQL из docker-compose). `php artisan migrate` (только новая миграция; **не** `migrate:fresh`). Создать шоурум через админку (Step 4), а не tinker.

- [ ] **Step 4: Админка в браузере** (`preview_start` для `admin`, ширина телефона 375×812, затем desktop)

1. Меню «Ещё» → «Шоурумы» открывается, пустое состояние с кнопкой.
2. «Добавить шоурум»: «Paradise Есентай», slug пустой → открылась карточка, slug `paradise-esentai`, статус «Черновик».
3. Заполнить город, ориентир, телефон, WhatsApp `77001112233`, часы (кнопка «Как в понедельник»), выключить воскресенье, 3 услуги; вставить ссылку 2ГИС `https://2gis.kz/almaty/geo/70000001018542498/76.928,43.2205` — координаты подставились; включить «Показывать на сайте»; «Сохранить» → тост «Сохранено», статус «На сайте», кнопка «Открыть на сайте».
4. Ошибки: часы 21:00–10:00 → подсветка строки; WhatsApp `+7700` → ошибка у поля; очистить slug при включённой публикации → ошибка у переключателя.
5. Загрузить 2 фото, поменять порядок стрелками, удалить одно.
6. `read_console_messages` — без ошибок.

- [ ] **Step 5: Витрина в браузере** (`preview_start` для `storefront`)

1. `/ru/showrooms` — карточка шоурума, статус «Открыто/Закрыто» появляется после загрузки, без hydration-предупреждений в консоли.
2. Клик → `/ru/showrooms/paradise-esentai`: фото, часы с пометкой «сегодня», кнопки 2ГИС открывают правильную точку (проверить обе ссылки — карта и маршрут; если маршрут без сегмента города не строится, вернуть `/{city}` в `routeUrl` нельзя — города-слага нет; тогда заменить маршрут на `https://2gis.kz/directions/points/%7C{lng}%2C{lat}` и перепроверить).
3. `/kk/showrooms` — тексты на казахском.
4. Карточка товара с остатком на этом складе → блок «Где посмотреть вживую» ведёт на страницу шоурума; у обычного склада ссылки нет.
5. Несуществующий `/ru/showrooms/nope` → 404.
6. Скриншоты админки (телефон) и витрины — показать пользователю.

- [ ] **Step 6: Итоговый коммит (если были правки по результатам проверки)**

```bash
git status --short
git add -A && git commit -m "fix: showroom follow-ups from browser check"
```

Перед любым `git push`/PR — `git log -5 --format=%B` без трейлеров `Co-Authored-By`.
