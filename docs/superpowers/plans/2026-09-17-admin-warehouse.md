# Склад в `admin/` — план реализации (этап 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** менеджер ведёт склады и поставщиков, оформляет и проводит приёмки и списания и смотрит движения в `admin/`, не заходя в Filament.

**Architecture:** REST-контроллеры в `app/Http/Controllers/Api/Admin` + `FormRequest`, новый документ `WriteOff` с `WriteOffService` поверх `FifoInventoryService::issue`, блокировка строки документа при проведении. В `admin/` экраны собираются из общих компонентов этапа 1 (`src/components/ui`, `useResource`).

**Tech Stack:** Laravel 13, PHPUnit 12, Spatie Query Builder; Next.js 16, React 19, TypeScript, Tailwind 4, react-hook-form, zod, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-admin-warehouse-design.md`

## Global Constraints

- Ветка `feat/admin-warehouse` от `main`. Коммиты **без** `Co-Authored-By` и без «Generated with Claude Code». В рабочем дереве есть чужие незакоммиченные файлы (`storefront/`, `b2b-portal/`) — `git add` только явными путями.
- Все новые маршруты — внутри группы `Route::prefix('admin')->middleware(['auth:sanctum', 'role:admin|manager'])` в `routes/api.php`.
- Деньги: клиент шлёт ₸ (до 2 знаков), БД хранит тиын (int); перевод — трейт `App\Http\Requests\Admin\Concerns\ConvertsTengeToTiyn` (объявить `priceFields()`).
- Количество: > 0, до 3 знаков после точки (`decimal:0,3`), максимум `9999999.999`.
- Ответы: запись — `{data: …}`; справочники (склады, поставщики) и позиции документа — `{data: [...]}` без пагинации; журналы (приёмки, списания, движения) — пагинатор Laravel; удаление — 204; запрет — 422 `{message}`; чужая позиция — 404 (scoped bindings).
- Частичное обновление (`PUT`) не сбрасывает пропущенные поля: правила `sometimes` на обновлении, `validated()` не добавляет отсутствующих ключей.
- Остатки меняет только `FifoInventoryService`. `source` / `external_id` складов не принимаются и не отдаются админке.
- Проведённый документ (`status = posted`) не редактируется и не удаляется, его позиции тоже: 422 `«Документ проведён — изменить нельзя.»`.
- PHP: `declare(strict_types=1);`, типы возврата, фигурные скобки; после правок — `vendor/bin/pint --dirty --format agent`.
- Прогон PHP-тестов (далее `$TEST`), `.env` не трогать:
  `STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact`
  Если тесты лезут в MySQL — `php artisan config:clear` (устаревший `bootstrap/cache/config.php`); если маршруты «не видны» — `php artisan route:clear`.
- Проверка `admin/`: `cd admin && npx tsc --noEmit && npm run build`; `npx eslint` на изменённых файлах — 0 ошибок.
- UI — по-русски, стиль zinc/blue, общие компоненты этапа 1: `useResource`, `DataTable`, `CrudModal` (`schema: ZodType<T, T>`), `Field`, `MoneyInput`, `EntityPicker`, `ConfirmButton`, `PageHeader`, `Tabs`, `styles.ts`; `toast` из `@/stores/toastStore`; `serverMessage`, `applyServerErrors` из `@/lib/errors`; `formatTenge`, `tiynToTenge`, `TENGE_PATTERN` из `@/lib/money`; `ru`, `productLabel`, `ProductRef` из `@/lib/text`.
- Не запускать `php artisan mvp:acceptance` (стирает базу разработки).

## Файловая карта

**Backend — создать**
- `database/migrations/2026_09_17_000001_create_write_offs_tables.php`
- `app/Models/WriteOff.php`, `app/Models/WriteOffItem.php`, `database/factories/WriteOffFactory.php`, `database/factories/WriteOffItemFactory.php`
- `app/Services/Inventory/WriteOffService.php` + `tests/Feature/Inventory/WriteOffServiceTest.php`
- `app/Http/Controllers/Api/Admin/SupplierController.php` + `app/Http/Requests/Admin/SupplierRequest.php` + `tests/Feature/Admin/SupplierApiTest.php`
- `…/StoreController.php` + `StoreRequest.php` + `StoreApiTest.php`
- `…/GoodsReceiptController.php`, `GoodsReceiptItemController.php` + `GoodsReceiptRequest.php`, `GoodsReceiptItemRequest.php` + `GoodsReceiptApiTest.php`, `GoodsReceiptItemApiTest.php`
- `…/WriteOffController.php`, `WriteOffItemController.php` + `WriteOffRequest.php`, `WriteOffItemRequest.php` + `WriteOffApiTest.php`, `WriteOffItemApiTest.php`
- `…/StockMovementController.php` + `StockMovementApiTest.php`
- `app/Http/Controllers/Api/Admin/Concerns/RefusesPostedDocuments.php`

**Backend — изменить**
- `app/Services/Inventory/GoodsReceiptService.php` (блокировка) + `tests/Feature/Inventory/GoodsReceiptServiceTest.php`
- `app/Models/Product.php` (`writeOffItems()`), `app/Http/Controllers/Api/Admin/ProductController.php` (`destroy`) + `tests/Feature/Admin/ProductCrudTest.php`
- `routes/api.php`

**Frontend — создать** (`admin/src/…`)
- `lib/warehouse.ts` — типы и подписи
- `app/stores/page.tsx`, `app/suppliers/page.tsx`
- `app/goods-receipts/page.tsx`, `app/goods-receipts/[id]/page.tsx`
- `app/write-offs/page.tsx`, `app/write-offs/[id]/page.tsx`
- `app/stock-movements/page.tsx`
- `components/warehouse/DocumentStatusBadge.tsx`, `components/warehouse/StoreSelect.tsx`, `components/warehouse/GoodsReceiptForm.tsx`, `components/warehouse/WriteOffForm.tsx`, `components/warehouse/QuantityForm.ts`
- `e2e/warehouse.spec.ts`

**Frontend — изменить**
- `components/Sidebar.tsx`, `components/NoActiveStoreWarning.tsx`, `app/stock/page.tsx`, `e2e/adminApi.ts`

---

### Task 1: Документ «Списание»: миграция, модели, сервис

**Files:**
- Create: `database/migrations/2026_09_17_000001_create_write_offs_tables.php`
- Create: `app/Models/WriteOff.php`, `app/Models/WriteOffItem.php`
- Create: `database/factories/WriteOffFactory.php`, `database/factories/WriteOffItemFactory.php`
- Create: `app/Services/Inventory/WriteOffService.php`
- Modify: `app/Models/Product.php` (связь `writeOffItems()`)
- Modify: `app/Http/Controllers/Api/Admin/ProductController.php` (`destroy`)
- Test: `tests/Feature/Inventory/WriteOffServiceTest.php`, `tests/Feature/Admin/ProductCrudTest.php`

**Interfaces:**
- Produces:
  - `App\Models\WriteOff`: константы `STATUS_DRAFT = 'draft'`, `STATUS_POSTED = 'posted'`, `REASONS = ['damaged', 'lost', 'regrading', 'other']`; `isPosted(): bool`; `label(): string` (`«Списание №<id>»`); связи `store()`, `user()`, `items()`; fillable `store_id, reason, note, status, posted_at, user_id`.
  - `App\Models\WriteOffItem`: fillable `write_off_id, product_id, quantity`; каст `quantity => decimal:3`; связи `writeOff()`, `product()`.
  - Фабрики: `WriteOff::factory()` (черновик, `reason = damaged`), состояние `posted()`; `WriteOffItem::factory()`.
  - `App\Services\Inventory\WriteOffService::post(WriteOff $writeOff, ?User $user = null): WriteOff` — бросает `RuntimeException` («Списание уже проведено.», «Нельзя провести пустое списание.») и `InsufficientStockException` (всё откатывается). После успеха переданный экземпляр тоже отражает `status = posted`.
  - `Product::writeOffItems(): HasMany`. `DELETE /api/admin/products/{product}` при позициях списаний → 422.

- [ ] **Step 1: Ветка**

```bash
git switch -c feat/admin-warehouse
```

- [ ] **Step 2: Падающий тест сервиса**

`tests/Feature/Inventory/WriteOffServiceTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\User;
use App\Models\WriteOff;
use App\Models\WriteOffItem;
use App\Services\Inventory\FifoInventoryService;
use App\Services\Inventory\InsufficientStockException;
use App\Services\Inventory\WriteOffService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Tests\TestCase;

class WriteOffServiceTest extends TestCase
{
    use RefreshDatabase;

    private WriteOffService $service;

    private FifoInventoryService $inventory;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(WriteOffService::class);
        $this->inventory = app(FifoInventoryService::class);
    }

    #[Test]
    public function posting_issues_stock_oldest_layer_first_and_marks_the_document(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->create();
        $user = User::factory()->create();

        $this->inventory->receive($product, $store, 2, 10_000);
        $this->inventory->receive($product, $store, 3, 20_000);

        $writeOff = WriteOff::factory()->for($store, 'store')->create();
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create(['product_id' => $product->id, 'quantity' => 4]);

        $this->service->post($writeOff, $user);

        $this->assertTrue($writeOff->isPosted());
        $fresh = $writeOff->fresh();
        $this->assertTrue($fresh->isPosted());
        $this->assertNotNull($fresh->posted_at);
        $this->assertSame($user->id, $fresh->user_id);

        $movements = StockMovement::query()
            ->where('type', StockMovement::TYPE_WRITE_OFF)
            ->where('documentable_type', WriteOff::class)
            ->where('documentable_id', $writeOff->id)
            ->orderBy('id')
            ->get();

        $this->assertCount(2, $movements);
        $this->assertEqualsWithDelta(-2.0, (float) $movements[0]->qty_delta, 0.001);
        $this->assertSame(10_000, (int) $movements[0]->unit_cost);
        $this->assertEqualsWithDelta(-2.0, (float) $movements[1]->qty_delta, 0.001);
        $this->assertSame(20_000, (int) $movements[1]->unit_cost);
        $this->assertSame($user->id, $movements[0]->user_id);

        $this->assertEqualsWithDelta(1.0, $this->inventory->onHand($product, $store), 0.001);
    }

    #[Test]
    public function a_shortage_on_any_line_rolls_back_every_line(): void
    {
        $store = Store::factory()->create();
        $enough = Product::factory()->create();
        $short = Product::factory()->create();

        $this->inventory->receive($enough, $store, 5, 10_000);
        $this->inventory->receive($short, $store, 1, 10_000);

        $writeOff = WriteOff::factory()->for($store, 'store')->create();
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create(['product_id' => $enough->id, 'quantity' => 2]);
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create(['product_id' => $short->id, 'quantity' => 3]);

        try {
            $this->service->post($writeOff);
            $this->fail('Expected InsufficientStockException');
        } catch (InsufficientStockException $exception) {
            $this->assertSame($short->id, $exception->product->id);
            $this->assertEqualsWithDelta(1.0, $exception->available, 0.001);
        }

        $this->assertFalse($writeOff->fresh()->isPosted());
        $this->assertEqualsWithDelta(5.0, $this->inventory->onHand($enough, $store), 0.001);
        $this->assertSame(0, StockMovement::query()->where('type', StockMovement::TYPE_WRITE_OFF)->count());
    }

    #[Test]
    public function a_posted_write_off_cannot_be_posted_again_even_from_a_stale_copy(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->create();
        $this->inventory->receive($product, $store, 5, 10_000);

        $writeOff = WriteOff::factory()->for($store, 'store')->create();
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create(['product_id' => $product->id, 'quantity' => 1]);
        $stale = WriteOff::findOrFail($writeOff->id);

        $this->service->post($writeOff);

        $this->expectException(RuntimeException::class);

        try {
            $this->service->post($stale);
        } finally {
            $this->assertEqualsWithDelta(4.0, $this->inventory->onHand($product, $store), 0.001);
        }
    }

    #[Test]
    public function an_empty_write_off_cannot_be_posted(): void
    {
        $writeOff = WriteOff::factory()->create();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Нельзя провести пустое списание.');

        $this->service->post($writeOff);
    }
}
```

- [ ] **Step 3: Убедиться, что падает**

Run: `$TEST tests/Feature/Inventory/WriteOffServiceTest.php`
Expected: FAIL — класс `App\Models\WriteOff` не найден.

- [ ] **Step 4: Миграция**

`database/migrations/2026_09_17_000001_create_write_offs_tables.php`:

```php
<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('write_offs', function (Blueprint $table): void {
            $table->id();
            // Restrict, not cascade: a warehouse with posted write-offs has history.
            $table->foreignId('store_id')->constrained()->restrictOnDelete();
            // damaged | lost | regrading | other
            $table->string('reason');
            $table->text('note')->nullable();
            // draft | posted
            $table->string('status')->default('draft')->index();
            $table->timestamp('posted_at')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('write_off_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('write_off_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 12, 3);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('write_off_items');
        Schema::dropIfExists('write_offs');
    }
};
```

- [ ] **Step 5: Модели и фабрики**

`app/Models/WriteOff.php`:

```php
<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A write-off document: goods leaving a warehouse without a sale (damaged,
 * lost, regraded). A draft is edited freely; posting it through
 * {@see \App\Services\Inventory\WriteOffService} issues the lines from the
 * FIFO layers as `write_off` movements and freezes the document.
 */
class WriteOff extends Model
{
    use HasFactory;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_POSTED = 'posted';

    /**
     * @var list<string>
     */
    public const REASONS = ['damaged', 'lost', 'regrading', 'other'];

    protected $fillable = [
        'store_id',
        'reason',
        'note',
        'status',
        'posted_at',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'posted_at' => 'datetime',
        ];
    }

    public function isPosted(): bool
    {
        return $this->status === self::STATUS_POSTED;
    }

    public function label(): string
    {
        return 'Списание №'.$this->id;
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(WriteOffItem::class);
    }
}
```

`app/Models/WriteOffItem.php`:

```php
<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WriteOffItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'write_off_id',
        'product_id',
        'quantity',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
        ];
    }

    public function writeOff(): BelongsTo
    {
        return $this->belongsTo(WriteOff::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
```

`database/factories/WriteOffFactory.php`:

```php
<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Store;
use App\Models\WriteOff;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WriteOff>
 */
class WriteOffFactory extends Factory
{
    public function definition(): array
    {
        return [
            'store_id' => Store::factory(),
            'reason' => 'damaged',
            'note' => null,
            'status' => WriteOff::STATUS_DRAFT,
            'posted_at' => null,
            'user_id' => null,
        ];
    }

    public function posted(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => WriteOff::STATUS_POSTED,
            'posted_at' => now(),
        ]);
    }
}
```

`database/factories/WriteOffItemFactory.php`:

```php
<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Product;
use App\Models\WriteOff;
use App\Models\WriteOffItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WriteOffItem>
 */
class WriteOffItemFactory extends Factory
{
    public function definition(): array
    {
        return [
            'write_off_id' => WriteOff::factory(),
            'product_id' => Product::factory(),
            'quantity' => fake()->randomFloat(3, 1, 5),
        ];
    }
}
```

- [ ] **Step 6: Сервис**

`app/Services/Inventory/WriteOffService.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Models\StockMovement;
use App\Models\User;
use App\Models\WriteOff;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Posts a write-off: every line leaves the warehouse through the FIFO layers
 * as a `write_off` movement, all lines or none.
 */
class WriteOffService
{
    public function __construct(private readonly FifoInventoryService $inventory) {}

    /**
     * @throws RuntimeException When the write-off is already posted or has no lines.
     * @throws InsufficientStockException When a line exceeds on-hand stock (nothing is written).
     */
    public function post(WriteOff $writeOff, ?User $user = null): WriteOff
    {
        $posted = DB::transaction(function () use ($writeOff, $user): WriteOff {
            // Re-read under a row lock: two concurrent "post" clicks must not
            // both see a draft and issue the stock twice.
            $locked = WriteOff::query()->lockForUpdate()->findOrFail($writeOff->id);

            if ($locked->isPosted()) {
                throw new RuntimeException('Списание уже проведено.');
            }

            $locked->load('items.product', 'store');

            if ($locked->items->isEmpty()) {
                throw new RuntimeException('Нельзя провести пустое списание.');
            }

            foreach ($locked->items as $item) {
                $this->inventory->issue(
                    product: $item->product,
                    store: $locked->store,
                    quantity: (float) $item->quantity,
                    type: StockMovement::TYPE_WRITE_OFF,
                    document: $locked,
                    user: $user,
                );
            }

            $locked->forceFill([
                'status' => WriteOff::STATUS_POSTED,
                'posted_at' => now(),
                'user_id' => $locked->user_id ?? $user?->id,
            ])->save();

            return $locked;
        });

        $writeOff->setRawAttributes($posted->getAttributes(), true);

        return $writeOff;
    }
}
```

- [ ] **Step 7: Сервис зелёный**

Run: `$TEST tests/Feature/Inventory/WriteOffServiceTest.php`
Expected: PASS (4 tests).

- [ ] **Step 8: Товар со списаниями не удаляется**

В `app/Models/Product.php` рядом с `goodsReceiptItems()`:

```php
    public function writeOffItems(): HasMany
    {
        return $this->hasMany(WriteOffItem::class);
    }
```

В `tests/Feature/Admin/ProductCrudTest.php` (импорт `App\Models\WriteOffItem`) добавить:

```php
    #[Test]
    public function a_product_on_a_write_off_cannot_be_deleted(): void
    {
        $item = WriteOffItem::factory()->create();

        $this->deleteJson("/api/admin/products/{$item->product_id}")
            ->assertUnprocessable()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseHas('products', ['id' => $item->product_id]);
    }
```

Run: `$TEST tests/Feature/Admin/ProductCrudTest.php --filter=write_off` — Expected: FAIL (500 от внешнего ключа или 204).

В `ProductController::destroy` после проверки `goodsReceiptItems()`:

```php
        if ($product->writeOffItems()->exists()) {
            return response()->json(['message' => 'Товар есть в списаниях — удалить нельзя, выключите его.'], 422);
        }
```

Run: `$TEST tests/Feature/Admin/ProductCrudTest.php` — Expected: PASS.

- [ ] **Step 9: Коммит**

```bash
vendor/bin/pint --dirty --format agent
git add database/migrations/2026_09_17_000001_create_write_offs_tables.php app/Models/WriteOff.php app/Models/WriteOffItem.php app/Models/Product.php database/factories/WriteOffFactory.php database/factories/WriteOffItemFactory.php app/Services/Inventory/WriteOffService.php app/Http/Controllers/Api/Admin/ProductController.php tests/Feature/Inventory/WriteOffServiceTest.php tests/Feature/Admin/ProductCrudTest.php
git commit -m "feat(inventory): write-off document posted through FIFO"
```

---

### Task 2: Блокировка при проведении приёмки

**Files:**
- Modify: `app/Services/Inventory/GoodsReceiptService.php`
- Test: `tests/Feature/Inventory/GoodsReceiptServiceTest.php`

**Interfaces:**
- Produces: `GoodsReceiptService::post(GoodsReceipt $receipt, ?User $user = null): GoodsReceipt` — сигнатура и сообщения исключений прежние; проверка статуса повторяется под `lockForUpdate()` внутри транзакции; переданный экземпляр после успеха отражает `posted`.

- [ ] **Step 1: Падающий тест**

В `tests/Feature/Inventory/GoodsReceiptServiceTest.php` добавить:

```php
    #[Test]
    public function a_stale_copy_cannot_post_the_receipt_a_second_time(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->create();

        $receipt = GoodsReceipt::factory()->for($store, 'store')->create();
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create([
            'product_id' => $product->id, 'quantity' => 5, 'unit_cost' => 10_000,
        ]);
        // Loaded before posting — as a second browser tab or Filament would hold it.
        $stale = GoodsReceipt::findOrFail($receipt->id);

        $this->service->post($receipt);

        try {
            $this->service->post($stale);
            $this->fail('Expected RuntimeException');
        } catch (RuntimeException $exception) {
            $this->assertSame('Приёмка уже проведена.', $exception->getMessage());
        }

        $this->assertEqualsWithDelta(5.0, $this->inventory->onHand($product, $store), 0.001);
        $this->assertSame(1, StockMovement::query()->where('documentable_id', $receipt->id)->where('documentable_type', GoodsReceipt::class)->count());
    }
```

- [ ] **Step 2: Убедиться, что падает**

Run: `$TEST tests/Feature/Inventory/GoodsReceiptServiceTest.php --filter=stale_copy`
Expected: FAIL — остаток 10 (устаревшая копия провела приёмку повторно).

- [ ] **Step 3: Реализация**

Заменить метод `post` в `app/Services/Inventory/GoodsReceiptService.php` (docblock класса и конструктор не менять):

```php
    /**
     * @throws RuntimeException When the receipt is already posted or has no lines.
     */
    public function post(GoodsReceipt $receipt, ?User $user = null): GoodsReceipt
    {
        $posted = DB::transaction(function () use ($receipt, $user): GoodsReceipt {
            // Re-read under a row lock: a second tab (or Filament next to the
            // admin app) holding a stale draft must not receive the stock twice.
            $locked = GoodsReceipt::query()->lockForUpdate()->findOrFail($receipt->id);

            if ($locked->isPosted()) {
                throw new RuntimeException('Приёмка уже проведена.');
            }

            $locked->load('items.product', 'store');

            if ($locked->items->isEmpty()) {
                throw new RuntimeException('Нельзя провести пустую приёмку.');
            }

            foreach ($locked->items as $item) {
                $this->inventory->receive(
                    product: $item->product,
                    store: $locked->store,
                    quantity: (float) $item->quantity,
                    unitCost: (int) $item->unit_cost,
                    document: $locked,
                    user: $user,
                );
            }

            $locked->forceFill([
                'status' => GoodsReceipt::STATUS_POSTED,
                'received_at' => $locked->received_at ?? now(),
                'posted_at' => now(),
                'user_id' => $locked->user_id ?? $user?->id,
            ])->save();

            return $locked;
        });

        $receipt->setRawAttributes($posted->getAttributes(), true);

        return $receipt;
    }
```

- [ ] **Step 4: Тесты зелёные**

Run: `$TEST tests/Feature/Inventory tests/Feature/Admin/GoodsReceiptAdminTest.php`
Expected: PASS (включая существующий Filament-тест приёмок).

- [ ] **Step 5: Коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Services/Inventory/GoodsReceiptService.php tests/Feature/Inventory/GoodsReceiptServiceTest.php
git commit -m "fix(inventory): lock a goods receipt while posting it"
```

---

### Task 3: API поставщиков

**Files:**
- Create: `app/Http/Requests/Admin/SupplierRequest.php`, `app/Http/Controllers/Api/Admin/SupplierController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Admin/SupplierApiTest.php`

**Interfaces:**
- Consumes: `Tests\Feature\Admin\Concerns\ActsAsStaff` (`setUpStaff()`, `actingAsManager()`, `assertStaffOnly()`).
- Produces: `GET /api/admin/suppliers` (`filter[search]` по `name`/`bin`, сортировка по `name`) → `{data: Supplier[]}`; `POST`, `GET/PUT/DELETE /api/admin/suppliers/{supplier}`; поставщик с приёмками → 422. Поля: `id, name, bin, phone, email, note, is_active`.

- [ ] **Step 1: Падающий тест**

`tests/Feature/Admin/SupplierApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class SupplierApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_suppliers(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/suppliers');
    }

    #[Test]
    public function it_lists_and_searches_suppliers_by_name_or_bin(): void
    {
        $this->actingAsManager();
        Supplier::factory()->create(['name' => 'ТОО Мебель', 'bin' => '111111111111']);
        Supplier::factory()->create(['name' => 'ИП Диваны', 'bin' => '222222222222']);

        $this->getJson('/api/admin/suppliers')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'ИП Диваны');

        $this->getJson('/api/admin/suppliers?filter[search]=Мебель')->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/suppliers?filter[search]=2222')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'ИП Диваны');
    }

    #[Test]
    public function it_creates_updates_partially_and_deletes_a_supplier(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/suppliers', [
            'name' => 'ТОО Мебель',
            'bin' => '123456789012',
            'phone' => '+77010000000',
            'email' => 'sales@mebel.kz',
            'note' => 'Оплата по факту',
            'is_active' => true,
        ])->assertCreated()->json('data.id');

        $this->putJson("/api/admin/suppliers/{$id}", ['name' => 'ТОО Мебель-Про'])
            ->assertOk()
            ->assertJsonPath('data.name', 'ТОО Мебель-Про')
            ->assertJsonPath('data.bin', '123456789012');

        $this->deleteJson("/api/admin/suppliers/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('suppliers', ['id' => $id]);
    }

    #[Test]
    public function name_is_required_and_email_must_be_valid(): void
    {
        $this->actingAsManager();

        $this->postJson('/api/admin/suppliers', ['name' => '', 'email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email']);
    }

    #[Test]
    public function a_supplier_with_receipts_cannot_be_deleted(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();

        $this->deleteJson("/api/admin/suppliers/{$receipt->supplier_id}")
            ->assertUnprocessable()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseHas('suppliers', ['id' => $receipt->supplier_id]);
    }
}
```

- [ ] **Step 2: Убедиться, что падает**

Run: `$TEST tests/Feature/Admin/SupplierApiTest.php` — Expected: FAIL (404).

- [ ] **Step 3: Запрос**

`app/Http/Requests/Admin/SupplierRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class SupplierRequest extends FormRequest
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
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:255'],
            'bin' => ['nullable', 'string', 'max:32'],
            'phone' => ['nullable', 'string', 'max:64'],
            'email' => ['nullable', 'email', 'max:255'],
            'note' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['boolean'],
        ];
    }
}
```

- [ ] **Step 4: Контроллер**

`app/Http/Controllers/Api/Admin/SupplierController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SupplierRequest;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class SupplierController extends Controller
{
    public function index(): JsonResponse
    {
        $suppliers = QueryBuilder::for(Supplier::class)
            ->allowedFilters(
                AllowedFilter::callback('search', function ($query, $value): void {
                    $query->where(function ($q) use ($value): void {
                        $q->where('name', 'LIKE', "%{$value}%")
                            ->orWhere('bin', 'LIKE', "%{$value}%");
                    });
                }),
            )
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $suppliers]);
    }

    public function store(SupplierRequest $request): JsonResponse
    {
        return response()->json(['data' => Supplier::create($request->validated())], 201);
    }

    public function show(Supplier $supplier): JsonResponse
    {
        return response()->json(['data' => $supplier]);
    }

    public function update(SupplierRequest $request, Supplier $supplier): JsonResponse
    {
        $supplier->update($request->validated());

        return response()->json(['data' => $supplier]);
    }

    /**
     * Receipts keep pointing at their supplier; a manager switches the
     * supplier off (is_active) instead.
     */
    public function destroy(Supplier $supplier): JsonResponse
    {
        if ($supplier->goodsReceipts()->exists()) {
            return response()->json(['message' => 'У поставщика есть приёмки — удалить нельзя, выключите его.'], 422);
        }

        $supplier->delete();

        return response()->json(null, 204);
    }
}
```

- [ ] **Step 5: Маршрут**

Импорт `SupplierController`; в группе `admin`:

```php
        Route::apiResource('suppliers', SupplierController::class);
```

- [ ] **Step 6: Тесты зелёные**

Run: `php artisan route:clear && $TEST tests/Feature/Admin/SupplierApiTest.php` — Expected: PASS (5 tests).

- [ ] **Step 7: Коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Requests/Admin/SupplierRequest.php app/Http/Controllers/Api/Admin/SupplierController.php routes/api.php tests/Feature/Admin/SupplierApiTest.php
git commit -m "feat(admin-api): suppliers"
```

---

### Task 4: API складов

**Files:**
- Create: `app/Http/Requests/Admin/StoreRequest.php`, `app/Http/Controllers/Api/Admin/StoreController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Admin/StoreApiTest.php`

**Interfaces:**
- Consumes: `ActsAsStaff`; `WriteOff` (Task 1).
- Produces: `GET /api/admin/stores` → `{data: Store[]}` (сначала `is_default`, потом `name`); `POST`, `GET/PUT/DELETE /api/admin/stores/{store}`. Поля ответа: `id, name, code, type, address, is_active, is_default, created_at, updated_at` — **без** `source`, `external_id`. Запреты 422: удаление склада с историей (движения, партии, приёмки, списания, заказы); выключение или удаление последнего активного склада. `is_default = true` снимает флаг с остальных.

- [ ] **Step 1: Падающий тест**

`tests/Feature/Admin/StoreApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\Order;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\WriteOff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class StoreApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_stores(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/stores');
    }

    #[Test]
    public function it_lists_the_default_store_first_without_erp_fields(): void
    {
        $this->actingAsManager();
        Store::factory()->create(['name' => 'Алматы-1', 'is_default' => false]);
        Store::factory()->create(['name' => 'Шоурум', 'is_default' => true]);

        $this->getJson('/api/admin/stores')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Шоурум')
            ->assertJsonMissingPath('data.0.external_id')
            ->assertJsonMissingPath('data.0.source');
    }

    #[Test]
    public function it_creates_and_partially_updates_a_store(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/stores', [
            'name' => 'Склад на Рыскулова',
            'code' => 'RYS',
            'type' => 'warehouse',
            'address' => 'Алматы, Рыскулова 1',
            'is_active' => true,
        ])->assertCreated()->assertJsonMissingPath('data.external_id')->json('data.id');

        $this->putJson("/api/admin/stores/{$id}", ['address' => 'Алматы, Рыскулова 2'])
            ->assertOk()
            ->assertJsonPath('data.code', 'RYS')
            ->assertJsonPath('data.address', 'Алматы, Рыскулова 2');
    }

    #[Test]
    public function the_type_must_be_known(): void
    {
        $this->actingAsManager();

        $this->postJson('/api/admin/stores', ['name' => 'X', 'type' => 'garage'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('type');
    }

    #[Test]
    public function only_one_store_is_the_default(): void
    {
        $this->actingAsManager();
        $old = Store::factory()->create(['is_default' => true]);
        $new = Store::factory()->create(['is_default' => false]);

        $this->putJson("/api/admin/stores/{$new->id}", ['is_default' => true])->assertOk();

        $this->assertTrue($new->fresh()->is_default);
        $this->assertFalse($old->fresh()->is_default);

        $created = $this->postJson('/api/admin/stores', ['name' => 'Третий', 'is_default' => true])->json('data.id');
        $this->assertSame(1, Store::query()->where('is_default', true)->count());
        $this->assertTrue(Store::findOrFail($created)->is_default);
    }

    #[Test]
    public function the_last_active_store_cannot_be_switched_off_or_deleted(): void
    {
        $this->actingAsManager();
        $only = Store::factory()->create(['is_active' => true]);
        Store::factory()->inactive()->create();

        $this->putJson("/api/admin/stores/{$only->id}", ['is_active' => false])->assertUnprocessable();
        $this->assertTrue($only->fresh()->is_active);

        $this->deleteJson("/api/admin/stores/{$only->id}")->assertUnprocessable();
        $this->assertDatabaseHas('stores', ['id' => $only->id]);
    }

    #[Test]
    public function a_store_can_be_switched_off_while_another_stays_active(): void
    {
        $this->actingAsManager();
        $one = Store::factory()->create(['is_active' => true]);
        Store::factory()->create(['is_active' => true]);

        $this->putJson("/api/admin/stores/{$one->id}", ['is_active' => false])->assertOk();
        $this->assertFalse($one->fresh()->is_active);
    }

    #[Test]
    public function an_empty_store_is_deleted(): void
    {
        $this->actingAsManager();
        Store::factory()->create(['is_active' => true]);
        $empty = Store::factory()->inactive()->create();

        $this->deleteJson("/api/admin/stores/{$empty->id}")->assertNoContent();
        $this->assertDatabaseMissing('stores', ['id' => $empty->id]);
    }

    /**
     * @return array<string, array{0: callable(Store): void}>
     */
    public static function history(): array
    {
        return [
            'stock movement' => [fn (Store $store) => StockMovement::factory()->create(['store_id' => $store->id])],
            'goods receipt' => [fn (Store $store) => GoodsReceipt::factory()->create(['store_id' => $store->id])],
            'write-off' => [fn (Store $store) => WriteOff::factory()->create(['store_id' => $store->id])],
            'order' => [fn (Store $store) => Order::factory()->create(['store_id' => $store->id])],
        ];
    }

    #[Test]
    #[DataProvider('history')]
    public function a_store_with_history_cannot_be_deleted(callable $makeHistory): void
    {
        $this->actingAsManager();
        Store::factory()->create(['is_active' => true]);
        $store = Store::factory()->inactive()->create();
        $makeHistory($store);

        $this->deleteJson("/api/admin/stores/{$store->id}")
            ->assertUnprocessable()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseHas('stores', ['id' => $store->id]);
    }
}
```

Если `Order::factory()` требует обязательных связей, которых нет по умолчанию, — поправить только эту строку провайдера (например, `->for(User::factory())`), смысл проверки не менять.

- [ ] **Step 2: Убедиться, что падает**

Run: `$TEST tests/Feature/Admin/StoreApiTest.php` — Expected: FAIL (404).

- [ ] **Step 3: Запрос**

`app/Http/Requests/Admin/StoreRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A warehouse or pickup point. `source` / `external_id` are ERP history and are
 * deliberately not accepted.
 */
class StoreRequest extends FormRequest
{
    public const TYPES = ['warehouse', 'retail_point'];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['code', 'address'] as $field) {
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
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:64'],
            'type' => ['sometimes', Rule::in(self::TYPES)],
            'address' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
        ];
    }
}
```

- [ ] **Step 4: Контроллер**

`app/Http/Controllers/Api/Admin/StoreController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreRequest;
use App\Models\GoodsReceipt;
use App\Models\Order;
use App\Models\Store;
use App\Models\WriteOff;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Warehouses. Deleting one cascades batches, movements and receipts at the
 * database level, so the controller refuses to delete a warehouse that has any
 * history, and never lets the last active warehouse go: without one
 * StoreResolver returns null and checkout fails.
 */
class StoreController extends Controller
{
    /** ERP bookkeeping kept as data, never shown in the admin. */
    private const HIDDEN = ['source', 'external_id'];

    public function index(): JsonResponse
    {
        $stores = Store::query()->orderByDesc('is_default')->orderBy('name')->get()->each->makeHidden(self::HIDDEN);

        return response()->json(['data' => $stores]);
    }

    public function store(StoreRequest $request): JsonResponse
    {
        $data = $request->validated();

        $store = DB::transaction(function () use ($data): Store {
            if (! empty($data['is_default'])) {
                Store::query()->update(['is_default' => false]);
            }

            return Store::create($data);
        });

        return response()->json(['data' => $store->refresh()->makeHidden(self::HIDDEN)], 201);
    }

    public function show(Store $store): JsonResponse
    {
        return response()->json(['data' => $store->makeHidden(self::HIDDEN)]);
    }

    public function update(StoreRequest $request, Store $store): JsonResponse
    {
        $data = $request->validated();

        if (array_key_exists('is_active', $data) && ! $data['is_active'] && $this->isLastActive($store)) {
            return response()->json(['message' => 'Это последний активный склад — без него витрина и оформление заказов перестанут работать.'], 422);
        }

        DB::transaction(function () use ($store, $data): void {
            if (! empty($data['is_default'])) {
                Store::query()->whereKeyNot($store->id)->update(['is_default' => false]);
            }

            $store->update($data);
        });

        return response()->json(['data' => $store->refresh()->makeHidden(self::HIDDEN)]);
    }

    public function destroy(Store $store): JsonResponse
    {
        if ($this->hasHistory($store)) {
            return response()->json(['message' => 'У склада есть история (движения, приёмки, списания или заказы) — удалить нельзя, выключите его.'], 422);
        }

        if ($this->isLastActive($store)) {
            return response()->json(['message' => 'Это последний активный склад — удалить нельзя.'], 422);
        }

        $store->delete();

        return response()->json(null, 204);
    }

    private function isLastActive(Store $store): bool
    {
        return $store->is_active
            && ! Store::query()->where('is_active', true)->whereKeyNot($store->id)->exists();
    }

    private function hasHistory(Store $store): bool
    {
        return $store->stockMovements()->exists()
            || $store->batches()->exists()
            || GoodsReceipt::query()->where('store_id', $store->id)->exists()
            || WriteOff::query()->where('store_id', $store->id)->exists()
            || Order::query()->where('store_id', $store->id)->exists();
    }
}
```

- [ ] **Step 5: Маршрут**

Импорт `StoreController as AdminStoreController` (в `routes/api.php` уже есть публичный `StoreController`); в группе `admin`:

```php
        Route::apiResource('stores', AdminStoreController::class);
```

Проверить: `php artisan route:list --path=api/admin/stores` показывает `Api\Admin\StoreController`, а `api/public/stores` — прежний публичный.

- [ ] **Step 6: Тесты зелёные**

Run: `php artisan route:clear && $TEST tests/Feature/Admin/StoreApiTest.php` — Expected: PASS (12 tests с провайдером).

- [ ] **Step 7: Коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Requests/Admin/StoreRequest.php app/Http/Controllers/Api/Admin/StoreController.php routes/api.php tests/Feature/Admin/StoreApiTest.php
git commit -m "feat(admin-api): warehouses with history and last-active guards"
```

---

### Task 5: API приёмок — шапка и проведение

**Files:**
- Create: `app/Http/Controllers/Api/Admin/Concerns/RefusesPostedDocuments.php`
- Create: `app/Http/Requests/Admin/GoodsReceiptRequest.php`, `app/Http/Controllers/Api/Admin/GoodsReceiptController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Admin/GoodsReceiptApiTest.php`

**Interfaces:**
- Consumes: `ActsAsStaff`; `GoodsReceiptService::post` (Task 2).
- Produces:
  - Трейт `RefusesPostedDocuments::refuseIfPosted(GoodsReceipt|WriteOff $document): ?JsonResponse` — 422 `«Документ проведён — изменить нельзя.»` или `null`.
  - `GET /api/admin/goods-receipts` (фильтры `filter[status]`, `filter[store_id]`; новые сверху; пагинатор по 20) — элемент `{id, number, status, received_at, posted_at, note, store {id,name}, supplier {id,name}|null, items_count, total_cost}`.
  - `POST /api/admin/goods-receipts` → 201; `GET /api/admin/goods-receipts/{goods_receipt}` → `{data: {…шапка, store, supplier, user {id,name}|null, items: [{id, product_id, quantity, unit_cost, product {id,name,code,article}}], total_cost}}`; `PUT`/`DELETE` — 422 для проведённой.
  - `POST /api/admin/goods-receipts/{goods_receipt}/post` → `{data: …как show}`; ошибки сервиса → 422 `{message}`.

- [ ] **Step 1: Падающий тест**

`tests/Feature/Admin/GoodsReceiptApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\Store;
use App\Models\Supplier;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class GoodsReceiptApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_receipts(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/goods-receipts');
    }

    #[Test]
    public function it_lists_receipts_with_totals_and_filters(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create();
        $draft = GoodsReceipt::factory()->for($store, 'store')->create();
        GoodsReceiptItem::factory()->for($draft, 'goodsReceipt')->create(['quantity' => 2, 'unit_cost' => 150_000]);
        GoodsReceiptItem::factory()->for($draft, 'goodsReceipt')->create(['quantity' => 1.5, 'unit_cost' => 10_000]);
        GoodsReceipt::factory()->posted()->create();

        $this->getJson('/api/admin/goods-receipts')
            ->assertOk()
            ->assertJsonPath('total', 2);

        $this->getJson("/api/admin/goods-receipts?filter[status]=draft&filter[store_id]={$store->id}")
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $draft->id)
            ->assertJsonPath('data.0.items_count', 2)
            ->assertJsonPath('data.0.total_cost', 315_000)
            ->assertJsonPath('data.0.store.id', $store->id);
    }

    #[Test]
    public function a_draft_is_created_shown_updated_partially_and_deleted(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create();
        $supplier = Supplier::factory()->create();

        $id = $this->postJson('/api/admin/goods-receipts', [
            'store_id' => $store->id,
            'supplier_id' => $supplier->id,
            'number' => 'ПН-17',
            'received_at' => '2026-09-17 10:00:00',
            'note' => 'Первая партия',
        ])->assertCreated()->assertJsonPath('data.status', 'draft')->json('data.id');

        $this->putJson("/api/admin/goods-receipts/{$id}", ['number' => 'ПН-18'])
            ->assertOk()
            ->assertJsonPath('data.number', 'ПН-18')
            ->assertJsonPath('data.supplier.id', $supplier->id);

        $this->getJson("/api/admin/goods-receipts/{$id}")
            ->assertOk()
            ->assertJsonPath('data.store.id', $store->id)
            ->assertJsonPath('data.items', [])
            ->assertJsonPath('data.total_cost', 0);

        $this->deleteJson("/api/admin/goods-receipts/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('goods_receipts', ['id' => $id]);
    }

    #[Test]
    public function the_store_is_required_on_create(): void
    {
        $this->actingAsManager();

        $this->postJson('/api/admin/goods-receipts', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('store_id');
    }

    #[Test]
    public function posting_receives_the_stock_and_freezes_the_document(): void
    {
        $manager = $this->actingAsManager();
        $store = Store::factory()->create();
        $product = Product::factory()->create();
        $receipt = GoodsReceipt::factory()->for($store, 'store')->create();
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create(['product_id' => $product->id, 'quantity' => 3, 'unit_cost' => 50_000]);

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/post")
            ->assertOk()
            ->assertJsonPath('data.status', 'posted')
            ->assertJsonPath('data.user.id', $manager->id);

        $this->assertEqualsWithDelta(3.0, app(FifoInventoryService::class)->onHand($product, $store), 0.001);

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/post")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Приёмка уже проведена.');
        $this->putJson("/api/admin/goods-receipts/{$receipt->id}", ['number' => 'X'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Документ проведён — изменить нельзя.');
        $this->deleteJson("/api/admin/goods-receipts/{$receipt->id}")->assertUnprocessable();
        $this->assertEqualsWithDelta(3.0, app(FifoInventoryService::class)->onHand($product, $store), 0.001);
    }

    #[Test]
    public function an_empty_receipt_is_not_posted(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/post")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Нельзя провести пустую приёмку.');
    }
}
```

- [ ] **Step 2: Убедиться, что падает**

Run: `$TEST tests/Feature/Admin/GoodsReceiptApiTest.php` — Expected: FAIL (404).

- [ ] **Step 3: Трейт**

`app/Http/Controllers/Api/Admin/Concerns/RefusesPostedDocuments.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin\Concerns;

use App\Models\GoodsReceipt;
use App\Models\WriteOff;
use Illuminate\Http\JsonResponse;

/**
 * A posted document has already moved stock; editing its header or lines
 * afterwards would make the document disagree with the ledger.
 */
trait RefusesPostedDocuments
{
    protected function refuseIfPosted(GoodsReceipt|WriteOff $document): ?JsonResponse
    {
        if (! $document->isPosted()) {
            return null;
        }

        return response()->json(['message' => 'Документ проведён — изменить нельзя.'], 422);
    }
}
```

- [ ] **Step 4: Запрос**

`app/Http/Requests/Admin/GoodsReceiptRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Receipt header only; status, posted_at and user_id are set by posting.
 */
class GoodsReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['supplier_id', 'number', 'received_at', 'note'] as $field) {
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
            'store_id' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'integer', 'exists:stores,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'number' => ['nullable', 'string', 'max:255'],
            'received_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
```

- [ ] **Step 5: Контроллер**

`app/Http/Controllers/Api/Admin/GoodsReceiptController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\RefusesPostedDocuments;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GoodsReceiptRequest;
use App\Models\GoodsReceipt;
use App\Services\Inventory\GoodsReceiptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class GoodsReceiptController extends Controller
{
    use RefusesPostedDocuments;

    /** Line cost summed in SQL so the list costs one query per page. */
    private const TOTAL_COST_SQL = '(select coalesce(sum(round(quantity * unit_cost)), 0) from goods_receipt_items where goods_receipt_items.goods_receipt_id = goods_receipts.id)';

    public function index(Request $request): JsonResponse
    {
        $receipts = QueryBuilder::for(GoodsReceipt::class)
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('store_id'),
            )
            ->select('goods_receipts.*')
            ->selectRaw(self::TOTAL_COST_SQL.' as total_cost')
            ->withCasts(['total_cost' => 'integer'])
            ->withCount('items')
            ->with(['store:id,name', 'supplier:id,name'])
            ->orderByDesc('id')
            ->paginate(20)
            ->appends($request->query());

        return response()->json($receipts);
    }

    public function store(GoodsReceiptRequest $request): JsonResponse
    {
        $receipt = GoodsReceipt::create([...$request->validated(), 'status' => GoodsReceipt::STATUS_DRAFT]);

        return response()->json(['data' => $this->present($receipt)], 201);
    }

    public function show(GoodsReceipt $goodsReceipt): JsonResponse
    {
        return response()->json(['data' => $this->present($goodsReceipt)]);
    }

    public function update(GoodsReceiptRequest $request, GoodsReceipt $goodsReceipt): JsonResponse
    {
        if ($refusal = $this->refuseIfPosted($goodsReceipt)) {
            return $refusal;
        }

        $goodsReceipt->update($request->validated());

        return response()->json(['data' => $this->present($goodsReceipt)]);
    }

    public function destroy(GoodsReceipt $goodsReceipt): JsonResponse
    {
        if ($refusal = $this->refuseIfPosted($goodsReceipt)) {
            return $refusal;
        }

        $goodsReceipt->delete();

        return response()->json(null, 204);
    }

    public function post(Request $request, GoodsReceipt $goodsReceipt, GoodsReceiptService $service): JsonResponse
    {
        try {
            $service->post($goodsReceipt, $request->user());
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['data' => $this->present($goodsReceipt)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(GoodsReceipt $receipt): array
    {
        $receipt->load([
            'store:id,name',
            'supplier:id,name',
            'user:id,name',
            'items' => fn ($query) => $query->orderBy('id'),
            'items.product:id,name,code,article',
        ]);

        return [...$receipt->toArray(), 'total_cost' => $receipt->totalCost()];
    }
}
```

- [ ] **Step 6: Маршруты**

Импорт `GoodsReceiptController`; в группе `admin`:

```php
        Route::apiResource('goods-receipts', GoodsReceiptController::class);
        Route::post('goods-receipts/{goods_receipt}/post', [GoodsReceiptController::class, 'post']);
```

- [ ] **Step 7: Тесты зелёные**

Run: `php artisan route:clear && $TEST tests/Feature/Admin/GoodsReceiptApiTest.php` — Expected: PASS (6 tests).

- [ ] **Step 8: Коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Controllers/Api/Admin/Concerns/RefusesPostedDocuments.php app/Http/Requests/Admin/GoodsReceiptRequest.php app/Http/Controllers/Api/Admin/GoodsReceiptController.php routes/api.php tests/Feature/Admin/GoodsReceiptApiTest.php
git commit -m "feat(admin-api): goods receipt headers and posting"
```

---

### Task 6: API позиций приёмки

**Files:**
- Create: `app/Http/Requests/Admin/GoodsReceiptItemRequest.php`, `app/Http/Controllers/Api/Admin/GoodsReceiptItemController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Admin/GoodsReceiptItemApiTest.php`

**Interfaces:**
- Consumes: `ActsAsStaff`, `ConvertsTengeToTiyn`, `RefusesPostedDocuments` (Task 5).
- Produces: `GET/POST /api/admin/goods-receipts/{goods_receipt}/items`, `PUT/DELETE …/items/{item}` (scoped); элемент `{id, goods_receipt_id, product_id, quantity, unit_cost (тиын), product {id,name,code,article}}`; для проведённой приёмки запись → 422.

- [ ] **Step 1: Падающий тест**

`tests/Feature/Admin/GoodsReceiptItemApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class GoodsReceiptItemApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_receipt_lines(): void
    {
        $receipt = GoodsReceipt::factory()->create();

        $this->assertStaffOnly('GET', "/api/admin/goods-receipts/{$receipt->id}/items");
    }

    #[Test]
    public function a_line_is_added_in_tenge_updated_partially_and_removed(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        $product = Product::factory()->create();

        $id = $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", [
            'product_id' => $product->id,
            'quantity' => '2.5',
            'unit_cost' => '1500.50',
        ])->assertCreated()->assertJsonPath('data.product.id', $product->id)->json('data.id');

        $this->assertSame(150_050, GoodsReceiptItem::findOrFail($id)->unit_cost);

        $this->putJson("/api/admin/goods-receipts/{$receipt->id}/items/{$id}", ['quantity' => 3])
            ->assertOk()
            ->assertJsonPath('data.unit_cost', 150_050);
        $this->assertSame('3.000', GoodsReceiptItem::findOrFail($id)->quantity);

        $this->getJson("/api/admin/goods-receipts/{$receipt->id}/items")->assertOk()->assertJsonCount(1, 'data');

        $this->deleteJson("/api/admin/goods-receipts/{$receipt->id}/items/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('goods_receipt_items', ['id' => $id]);
    }

    #[Test]
    public function quantity_and_cost_are_validated(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();
        $product = Product::factory()->create();

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", [
            'product_id' => $product->id,
            'quantity' => 0,
            'unit_cost' => '1.005',
        ])->assertUnprocessable()->assertJsonValidationErrors(['quantity', 'unit_cost']);

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", [
            'product_id' => $product->id,
            'quantity' => '1.0005',
            'unit_cost' => 1,
        ])->assertUnprocessable()->assertJsonValidationErrors('quantity');
    }

    #[Test]
    public function lines_of_a_posted_receipt_are_frozen(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->posted()->create();
        $item = GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create();

        $this->postJson("/api/admin/goods-receipts/{$receipt->id}/items", [
            'product_id' => Product::factory()->create()->id, 'quantity' => 1, 'unit_cost' => 1,
        ])->assertUnprocessable();
        $this->putJson("/api/admin/goods-receipts/{$receipt->id}/items/{$item->id}", ['quantity' => 9])->assertUnprocessable();
        $this->deleteJson("/api/admin/goods-receipts/{$receipt->id}/items/{$item->id}")->assertUnprocessable();

        $this->assertDatabaseHas('goods_receipt_items', ['id' => $item->id]);
    }

    #[Test]
    public function another_receipts_line_is_not_found(): void
    {
        $this->actingAsManager();
        $foreign = GoodsReceiptItem::factory()->create();
        $receipt = GoodsReceipt::factory()->create();

        $this->deleteJson("/api/admin/goods-receipts/{$receipt->id}/items/{$foreign->id}")->assertNotFound();
    }
}
```

- [ ] **Step 2: Убедиться, что падает**

Run: `$TEST tests/Feature/Admin/GoodsReceiptItemApiTest.php` — Expected: FAIL (404).

- [ ] **Step 3: Запрос**

`app/Http/Requests/Admin/GoodsReceiptItemRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ConvertsTengeToTiyn;
use Illuminate\Foundation\Http\FormRequest;

class GoodsReceiptItemRequest extends FormRequest
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
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'product_id' => [$required, 'integer', 'exists:products,id'],
            'quantity' => [$required, 'numeric', 'decimal:0,3', 'gt:0', 'max:9999999.999'],
            'unit_cost' => [$required, 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
        ];
    }

    /**
     * @return list<string>
     */
    protected function priceFields(): array
    {
        return ['unit_cost'];
    }
}
```

- [ ] **Step 4: Контроллер**

`app/Http/Controllers/Api/Admin/GoodsReceiptItemController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\RefusesPostedDocuments;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GoodsReceiptItemRequest;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use Illuminate\Http\JsonResponse;

class GoodsReceiptItemController extends Controller
{
    use RefusesPostedDocuments;

    private const PRODUCT_COLUMNS = 'product:id,name,code,article';

    public function index(GoodsReceipt $goodsReceipt): JsonResponse
    {
        return response()->json(['data' => $goodsReceipt->items()->with(self::PRODUCT_COLUMNS)->orderBy('id')->get()]);
    }

    public function store(GoodsReceiptItemRequest $request, GoodsReceipt $goodsReceipt): JsonResponse
    {
        if ($refusal = $this->refuseIfPosted($goodsReceipt)) {
            return $refusal;
        }

        $item = $goodsReceipt->items()->create($request->validated());

        return response()->json(['data' => $item->load(self::PRODUCT_COLUMNS)], 201);
    }

    public function update(GoodsReceiptItemRequest $request, GoodsReceipt $goodsReceipt, GoodsReceiptItem $item): JsonResponse
    {
        if ($refusal = $this->refuseIfPosted($goodsReceipt)) {
            return $refusal;
        }

        $item->update($request->validated());

        return response()->json(['data' => $item->load(self::PRODUCT_COLUMNS)]);
    }

    public function destroy(GoodsReceipt $goodsReceipt, GoodsReceiptItem $item): JsonResponse
    {
        if ($refusal = $this->refuseIfPosted($goodsReceipt)) {
            return $refusal;
        }

        $item->delete();

        return response()->json(null, 204);
    }
}
```

- [ ] **Step 5: Маршрут**

Импорт; в группе `admin`:

```php
        Route::apiResource('goods-receipts.items', GoodsReceiptItemController::class)->except('show')->scoped();
```

Проверить `php artisan route:list --path=api/admin/goods-receipts` — параметры `{goods_receipt}` и `{item}`.

- [ ] **Step 6: Тесты зелёные**

Run: `php artisan route:clear && $TEST tests/Feature/Admin/GoodsReceiptItemApiTest.php` — Expected: PASS (5 tests).

- [ ] **Step 7: Коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Requests/Admin/GoodsReceiptItemRequest.php app/Http/Controllers/Api/Admin/GoodsReceiptItemController.php routes/api.php tests/Feature/Admin/GoodsReceiptItemApiTest.php
git commit -m "feat(admin-api): goods receipt lines"
```

---

### Task 7: API списаний — шапка, позиции, проведение

**Files:**
- Create: `app/Http/Requests/Admin/WriteOffRequest.php`, `app/Http/Controllers/Api/Admin/WriteOffController.php`
- Create: `app/Http/Requests/Admin/WriteOffItemRequest.php`, `app/Http/Controllers/Api/Admin/WriteOffItemController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Admin/WriteOffApiTest.php`, `tests/Feature/Admin/WriteOffItemApiTest.php`

**Interfaces:**
- Consumes: `ActsAsStaff`, `RefusesPostedDocuments` (Task 5), `WriteOff`, `WriteOffItem`, `WriteOffService` (Task 1).
- Produces:
  - `GET /api/admin/write-offs` (фильтры `filter[status]`, `filter[store_id]`, `filter[reason]`; новые сверху; пагинатор по 20) — элемент `{id, reason, note, status, posted_at, created_at, store {id,name}, items_count}`.
  - `POST /api/admin/write-offs` (`store_id`, `reason` обязательны; `note`) → 201; `GET /api/admin/write-offs/{write_off}` → `{data: {…шапка, label, store, user {id,name}|null, items: [{id, product_id, quantity, product {id,name,code,article}}], total_cost: int|null}}` (`total_cost` — себестоимость по движениям для проведённого, `null` для черновика); `PUT`/`DELETE` — 422 для проведённого.
  - `POST /api/admin/write-offs/{write_off}/post` → `{data: …как show}`; нехватка → 422 `«Не хватает: <товар> — нужно N, доступно M.»`; прочие ошибки сервиса → 422 с их текстом.
  - `GET/POST /api/admin/write-offs/{write_off}/items`, `PUT/DELETE …/items/{item}` (scoped); index отдаёт у позиции `available: number` — остаток товара на складе документа.

- [ ] **Step 1: Падающие тесты**

`tests/Feature/Admin/WriteOffApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Models\Store;
use App\Models\WriteOff;
use App\Models\WriteOffItem;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class WriteOffApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_write_offs(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/write-offs');
    }

    #[Test]
    public function a_draft_is_created_filtered_updated_partially_and_deleted(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create();

        $id = $this->postJson('/api/admin/write-offs', [
            'store_id' => $store->id,
            'reason' => 'damaged',
            'note' => 'Порван чехол',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.label', 'Списание №1')
            ->assertJsonPath('data.total_cost', null)
            ->json('data.id');

        WriteOff::factory()->create(['reason' => 'lost']);

        $this->getJson("/api/admin/write-offs?filter[reason]=damaged&filter[store_id]={$store->id}")
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.items_count', 0);

        $this->putJson("/api/admin/write-offs/{$id}", ['reason' => 'regrading'])
            ->assertOk()
            ->assertJsonPath('data.reason', 'regrading')
            ->assertJsonPath('data.note', 'Порван чехол');

        $this->deleteJson("/api/admin/write-offs/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('write_offs', ['id' => $id]);
    }

    #[Test]
    public function store_and_a_known_reason_are_required(): void
    {
        $this->actingAsManager();

        $this->postJson('/api/admin/write-offs', ['reason' => 'stolen'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['store_id', 'reason']);
    }

    #[Test]
    public function posting_issues_stock_and_reports_the_cost(): void
    {
        $manager = $this->actingAsManager();
        $store = Store::factory()->create();
        $product = Product::factory()->create();
        $inventory = app(FifoInventoryService::class);
        $inventory->receive($product, $store, 2, 10_000);
        $inventory->receive($product, $store, 2, 30_000);

        $writeOff = WriteOff::factory()->for($store, 'store')->create();
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create(['product_id' => $product->id, 'quantity' => 3]);

        $this->postJson("/api/admin/write-offs/{$writeOff->id}/post")
            ->assertOk()
            ->assertJsonPath('data.status', 'posted')
            ->assertJsonPath('data.user.id', $manager->id)
            ->assertJsonPath('data.total_cost', 50_000);

        $this->assertEqualsWithDelta(1.0, $inventory->onHand($product, $store), 0.001);

        $this->putJson("/api/admin/write-offs/{$writeOff->id}", ['note' => 'x'])->assertUnprocessable();
        $this->deleteJson("/api/admin/write-offs/{$writeOff->id}")->assertUnprocessable();
        $this->postJson("/api/admin/write-offs/{$writeOff->id}/post")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Списание уже проведено.');
    }

    #[Test]
    public function a_shortage_is_explained_and_nothing_is_written(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create();
        $product = Product::factory()->create(['name' => ['ru' => 'Диван Атланта']]);
        app(FifoInventoryService::class)->receive($product, $store, 1.5, 10_000);

        $writeOff = WriteOff::factory()->for($store, 'store')->create();
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create(['product_id' => $product->id, 'quantity' => 2]);

        $this->postJson("/api/admin/write-offs/{$writeOff->id}/post")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Не хватает: Диван Атланта — нужно 2, доступно 1.5.');

        $this->assertFalse($writeOff->fresh()->isPosted());
    }
}
```

`tests/Feature/Admin/WriteOffItemApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Models\Store;
use App\Models\WriteOff;
use App\Models\WriteOffItem;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class WriteOffItemApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_write_off_lines(): void
    {
        $writeOff = WriteOff::factory()->create();

        $this->assertStaffOnly('GET', "/api/admin/write-offs/{$writeOff->id}/items");
    }

    #[Test]
    public function lines_show_what_is_available_at_the_documents_store(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create();
        $elsewhere = Store::factory()->create();
        $product = Product::factory()->create();
        $inventory = app(FifoInventoryService::class);
        $inventory->receive($product, $store, 4, 10_000);
        $inventory->receive($product, $elsewhere, 9, 10_000);

        $writeOff = WriteOff::factory()->for($store, 'store')->create();

        $id = $this->postJson("/api/admin/write-offs/{$writeOff->id}/items", [
            'product_id' => $product->id,
            'quantity' => '1.5',
        ])->assertCreated()->assertJsonPath('data.product.id', $product->id)->json('data.id');

        $this->getJson("/api/admin/write-offs/{$writeOff->id}/items")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.available', 4);

        $this->putJson("/api/admin/write-offs/{$writeOff->id}/items/{$id}", ['quantity' => 2])->assertOk();
        $this->assertSame('2.000', WriteOffItem::findOrFail($id)->quantity);

        $this->deleteJson("/api/admin/write-offs/{$writeOff->id}/items/{$id}")->assertNoContent();
    }

    #[Test]
    public function a_product_never_received_there_has_nothing_available(): void
    {
        $this->actingAsManager();
        $writeOff = WriteOff::factory()->create();
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create();

        $this->getJson("/api/admin/write-offs/{$writeOff->id}/items")->assertJsonPath('data.0.available', 0);
    }

    #[Test]
    public function quantity_is_validated(): void
    {
        $this->actingAsManager();
        $writeOff = WriteOff::factory()->create();

        $this->postJson("/api/admin/write-offs/{$writeOff->id}/items", [
            'product_id' => Product::factory()->create()->id,
            'quantity' => -1,
        ])->assertUnprocessable()->assertJsonValidationErrors('quantity');
    }

    #[Test]
    public function lines_of_a_posted_write_off_are_frozen(): void
    {
        $this->actingAsManager();
        $writeOff = WriteOff::factory()->posted()->create();
        $item = WriteOffItem::factory()->for($writeOff, 'writeOff')->create();

        $this->postJson("/api/admin/write-offs/{$writeOff->id}/items", [
            'product_id' => Product::factory()->create()->id, 'quantity' => 1,
        ])->assertUnprocessable();
        $this->putJson("/api/admin/write-offs/{$writeOff->id}/items/{$item->id}", ['quantity' => 5])->assertUnprocessable();
        $this->deleteJson("/api/admin/write-offs/{$writeOff->id}/items/{$item->id}")->assertUnprocessable();
    }

    #[Test]
    public function another_write_offs_line_is_not_found(): void
    {
        $this->actingAsManager();
        $foreign = WriteOffItem::factory()->create();
        $writeOff = WriteOff::factory()->create();

        $this->deleteJson("/api/admin/write-offs/{$writeOff->id}/items/{$foreign->id}")->assertNotFound();
    }
}
```

- [ ] **Step 2: Убедиться, что падают**

Run: `$TEST tests/Feature/Admin/WriteOffApiTest.php tests/Feature/Admin/WriteOffItemApiTest.php` — Expected: FAIL (404).

- [ ] **Step 3: Запросы**

`app/Http/Requests/Admin/WriteOffRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Models\WriteOff;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WriteOffRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->input('note') === '') {
            $this->merge(['note' => null]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'store_id' => [$required, 'integer', 'exists:stores,id'],
            'reason' => [$required, Rule::in(WriteOff::REASONS)],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
```

`app/Http/Requests/Admin/WriteOffItemRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class WriteOffItemRequest extends FormRequest
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
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'product_id' => [$required, 'integer', 'exists:products,id'],
            'quantity' => [$required, 'numeric', 'decimal:0,3', 'gt:0', 'max:9999999.999'],
        ];
    }
}
```

- [ ] **Step 4: Контроллеры**

`app/Http/Controllers/Api/Admin/WriteOffController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\RefusesPostedDocuments;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\WriteOffRequest;
use App\Models\StockMovement;
use App\Models\WriteOff;
use App\Services\Inventory\InsufficientStockException;
use App\Services\Inventory\WriteOffService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class WriteOffController extends Controller
{
    use RefusesPostedDocuments;

    public function index(Request $request): JsonResponse
    {
        $writeOffs = QueryBuilder::for(WriteOff::class)
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('store_id'),
                AllowedFilter::exact('reason'),
            )
            ->withCount('items')
            ->with('store:id,name')
            ->orderByDesc('id')
            ->paginate(20)
            ->appends($request->query());

        return response()->json($writeOffs);
    }

    public function store(WriteOffRequest $request): JsonResponse
    {
        $writeOff = WriteOff::create([...$request->validated(), 'status' => WriteOff::STATUS_DRAFT]);

        return response()->json(['data' => $this->present($writeOff)], 201);
    }

    public function show(WriteOff $writeOff): JsonResponse
    {
        return response()->json(['data' => $this->present($writeOff)]);
    }

    public function update(WriteOffRequest $request, WriteOff $writeOff): JsonResponse
    {
        if ($refusal = $this->refuseIfPosted($writeOff)) {
            return $refusal;
        }

        $writeOff->update($request->validated());

        return response()->json(['data' => $this->present($writeOff)]);
    }

    public function destroy(WriteOff $writeOff): JsonResponse
    {
        if ($refusal = $this->refuseIfPosted($writeOff)) {
            return $refusal;
        }

        $writeOff->delete();

        return response()->json(null, 204);
    }

    public function post(Request $request, WriteOff $writeOff, WriteOffService $service): JsonResponse
    {
        try {
            $service->post($writeOff, $request->user());
        } catch (InsufficientStockException $exception) {
            return response()->json(['message' => sprintf(
                'Не хватает: %s — нужно %s, доступно %s.',
                $exception->product->getTranslation('name', 'ru'),
                $this->quantity($exception->requested),
                $this->quantity($exception->available),
            )], 422);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['data' => $this->present($writeOff)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(WriteOff $writeOff): array
    {
        $writeOff->load([
            'store:id,name',
            'user:id,name',
            'items' => fn ($query) => $query->orderBy('id'),
            'items.product:id,name,code,article',
        ]);

        return [
            ...$writeOff->toArray(),
            'label' => $writeOff->label(),
            'total_cost' => $writeOff->isPosted() ? $this->postedCost($writeOff) : null,
        ];
    }

    /** What the write-off cost, as the FIFO layers priced it when it was posted. */
    private function postedCost(WriteOff $writeOff): int
    {
        return (int) round((float) StockMovement::query()
            ->where('documentable_type', WriteOff::class)
            ->where('documentable_id', $writeOff->id)
            ->selectRaw('coalesce(sum(-qty_delta * unit_cost), 0) as cost')
            ->value('cost'));
    }

    /** 2.000 → "2", 1.500 → "1.5". */
    private function quantity(float $value): string
    {
        return rtrim(rtrim(number_format($value, 3, '.', ''), '0'), '.');
    }
}
```

`app/Http/Controllers/Api/Admin/WriteOffItemController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\RefusesPostedDocuments;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\WriteOffItemRequest;
use App\Models\ProductStoreStock;
use App\Models\WriteOff;
use App\Models\WriteOffItem;
use Illuminate\Http\JsonResponse;

class WriteOffItemController extends Controller
{
    use RefusesPostedDocuments;

    private const PRODUCT_COLUMNS = 'product:id,name,code,article';

    /**
     * Each line carries `available` — on-hand at the document's warehouse —
     * so a shortage is visible before posting, not only after the 422.
     */
    public function index(WriteOff $writeOff): JsonResponse
    {
        $items = $writeOff->items()->with(self::PRODUCT_COLUMNS)->orderBy('id')->get();

        $onHand = ProductStoreStock::query()
            ->where('store_id', $writeOff->store_id)
            ->whereIn('product_id', $items->pluck('product_id'))
            ->pluck('stock', 'product_id');

        $items->each(fn (WriteOffItem $item) => $item->setAttribute('available', (float) ($onHand[$item->product_id] ?? 0)));

        return response()->json(['data' => $items]);
    }

    public function store(WriteOffItemRequest $request, WriteOff $writeOff): JsonResponse
    {
        if ($refusal = $this->refuseIfPosted($writeOff)) {
            return $refusal;
        }

        $item = $writeOff->items()->create($request->validated());

        return response()->json(['data' => $item->load(self::PRODUCT_COLUMNS)], 201);
    }

    public function update(WriteOffItemRequest $request, WriteOff $writeOff, WriteOffItem $item): JsonResponse
    {
        if ($refusal = $this->refuseIfPosted($writeOff)) {
            return $refusal;
        }

        $item->update($request->validated());

        return response()->json(['data' => $item->load(self::PRODUCT_COLUMNS)]);
    }

    public function destroy(WriteOff $writeOff, WriteOffItem $item): JsonResponse
    {
        if ($refusal = $this->refuseIfPosted($writeOff)) {
            return $refusal;
        }

        $item->delete();

        return response()->json(null, 204);
    }
}
```

- [ ] **Step 5: Маршруты**

Импорты; в группе `admin`:

```php
        Route::apiResource('write-offs', WriteOffController::class);
        Route::post('write-offs/{write_off}/post', [WriteOffController::class, 'post']);
        Route::apiResource('write-offs.items', WriteOffItemController::class)->except('show')->scoped();
```

- [ ] **Step 6: Тесты зелёные**

Run: `php artisan route:clear && $TEST tests/Feature/Admin/WriteOffApiTest.php tests/Feature/Admin/WriteOffItemApiTest.php` — Expected: PASS (11 tests). Если `data.0.available` сериализуется как `4.0`/`"4.000"` — привести к числу в контроллере (`(float)`), не менять ожидание теста.

- [ ] **Step 7: Коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Requests/Admin/WriteOffRequest.php app/Http/Requests/Admin/WriteOffItemRequest.php app/Http/Controllers/Api/Admin/WriteOffController.php app/Http/Controllers/Api/Admin/WriteOffItemController.php routes/api.php tests/Feature/Admin/WriteOffApiTest.php tests/Feature/Admin/WriteOffItemApiTest.php
git commit -m "feat(admin-api): write-offs with lines, availability and posting"
```

---

### Task 8: API движений

**Files:**
- Create: `app/Http/Controllers/Api/Admin/StockMovementController.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Admin/StockMovementApiTest.php`

**Interfaces:**
- Consumes: `ActsAsStaff`; `GoodsReceipt`, `WriteOff`, `Order`, `StockMovement`.
- Produces: `GET /api/admin/stock-movements` — фильтры `filter[product_id]`, `filter[store_id]`, `filter[type]`, `filter[from]` (дата, с начала дня), `filter[to]` (дата, до конца дня), `filter[document]=receipt:<id>|write_off:<id>|order:<id>`; сортировка новые сверху (`created_at desc, id desc`); пагинатор по 50; элемент:
  `{id, created_at, type, qty_delta: number, unit_cost: int|null, balance_after: number|null, note, store {id,name}, product {id,name,code}, user {id,name}|null, document {type: 'receipt'|'write_off'|'order', id, label}|null}`.
  Подписи: приёмка — `«Приёмка <number>»` или `«Приёмка №<id>»`; списание — `WriteOff::label()`; заказ — `«Заказ <number>»`.

- [ ] **Step 1: Падающий тест**

`tests/Feature/Admin/StockMovementApiTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\Order;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\WriteOff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class StockMovementApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_read_movements(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/stock-movements');
    }

    #[Test]
    public function a_movement_is_presented_with_its_document(): void
    {
        $manager = $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create(['number' => 'ПН-7']);
        StockMovement::factory()->create([
            'store_id' => $receipt->store_id,
            'type' => StockMovement::TYPE_RECEIPT,
            'qty_delta' => 5,
            'unit_cost' => 10_000,
            'balance_after' => 5,
            'user_id' => $manager->id,
            'documentable_type' => GoodsReceipt::class,
            'documentable_id' => $receipt->id,
        ]);

        $this->getJson('/api/admin/stock-movements')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.type', 'receipt')
            ->assertJsonPath('data.0.qty_delta', 5)
            ->assertJsonPath('data.0.store.id', $receipt->store_id)
            ->assertJsonPath('data.0.user.id', $manager->id)
            ->assertJsonPath('data.0.document', ['type' => 'receipt', 'id' => $receipt->id, 'label' => 'Приёмка ПН-7']);
    }

    #[Test]
    public function write_off_and_order_documents_are_labelled(): void
    {
        $this->actingAsManager();
        $writeOff = WriteOff::factory()->create();
        $order = Order::factory()->create();
        StockMovement::factory()->create(['documentable_type' => WriteOff::class, 'documentable_id' => $writeOff->id, 'created_at' => now()->subMinute()]);
        StockMovement::factory()->create(['documentable_type' => Order::class, 'documentable_id' => $order->id, 'created_at' => now()]);
        StockMovement::factory()->create(['documentable_type' => null, 'documentable_id' => null, 'created_at' => now()->subHour()]);

        $response = $this->getJson('/api/admin/stock-movements')->assertOk();

        $response->assertJsonPath('data.0.document', ['type' => 'order', 'id' => $order->id, 'label' => 'Заказ '.$order->fresh()->number]);
        $response->assertJsonPath('data.1.document', ['type' => 'write_off', 'id' => $writeOff->id, 'label' => 'Списание №'.$writeOff->id]);
        $response->assertJsonPath('data.2.document', null);
    }

    #[Test]
    public function movements_are_filtered(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create();
        $product = Product::factory()->create();
        $receipt = GoodsReceipt::factory()->create();

        $match = StockMovement::factory()->create([
            'store_id' => $store->id,
            'product_id' => $product->id,
            'type' => StockMovement::TYPE_WRITE_OFF,
            'created_at' => Carbon::parse('2026-09-10 12:00:00'),
        ]);
        StockMovement::factory()->create(['store_id' => $store->id, 'product_id' => $product->id, 'type' => StockMovement::TYPE_SALE, 'created_at' => Carbon::parse('2026-09-10 13:00:00')]);
        StockMovement::factory()->create(['product_id' => $product->id, 'type' => StockMovement::TYPE_WRITE_OFF, 'created_at' => Carbon::parse('2026-09-10 14:00:00')]);
        StockMovement::factory()->create(['store_id' => $store->id, 'product_id' => $product->id, 'type' => StockMovement::TYPE_WRITE_OFF, 'created_at' => Carbon::parse('2026-09-12 09:00:00')]);
        $byDocument = StockMovement::factory()->create(['documentable_type' => GoodsReceipt::class, 'documentable_id' => $receipt->id]);

        $this->getJson("/api/admin/stock-movements?filter[store_id]={$store->id}&filter[product_id]={$product->id}&filter[type]=write_off&filter[from]=2026-09-10&filter[to]=2026-09-10")
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $match->id);

        $this->getJson("/api/admin/stock-movements?filter[document]=receipt:{$receipt->id}")
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $byDocument->id);
    }

    #[Test]
    public function an_unknown_document_kind_matches_nothing(): void
    {
        $this->actingAsManager();
        StockMovement::factory()->create();

        $this->getJson('/api/admin/stock-movements?filter[document]=invoice:1')
            ->assertOk()
            ->assertJsonPath('total', 0);
    }
}
```

- [ ] **Step 2: Убедиться, что падает**

Run: `$TEST tests/Feature/Admin/StockMovementApiTest.php` — Expected: FAIL (404).

- [ ] **Step 3: Контроллер**

`app/Http/Controllers/Api/Admin/StockMovementController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\GoodsReceipt;
use App\Models\Order;
use App\Models\StockMovement;
use App\Models\WriteOff;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * The stock ledger, read-only: where every on-hand number came from.
 */
class StockMovementController extends Controller
{
    /**
     * Document kinds the admin links to, keyed by the name the API uses.
     *
     * @var array<string, class-string>
     */
    private const DOCUMENTS = [
        'receipt' => GoodsReceipt::class,
        'write_off' => WriteOff::class,
        'order' => Order::class,
    ];

    public function index(Request $request): JsonResponse
    {
        $movements = QueryBuilder::for(StockMovement::class)
            ->allowedFilters(
                AllowedFilter::exact('product_id'),
                AllowedFilter::exact('store_id'),
                AllowedFilter::exact('type'),
                AllowedFilter::callback('from', fn ($query, $value) => $query->where('created_at', '>=', Carbon::parse($value)->startOfDay())),
                AllowedFilter::callback('to', fn ($query, $value) => $query->where('created_at', '<=', Carbon::parse($value)->endOfDay())),
                AllowedFilter::callback('document', function ($query, $value): void {
                    [$kind, $id] = array_pad(explode(':', (string) $value, 2), 2, null);
                    $class = self::DOCUMENTS[$kind] ?? null;

                    if ($class === null || ! ctype_digit((string) $id)) {
                        $query->whereRaw('1 = 0');

                        return;
                    }

                    $query->where('documentable_type', $class)->where('documentable_id', (int) $id);
                }),
            )
            ->with(['store:id,name', 'product:id,name,code', 'user:id,name', 'documentable'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(50)
            ->appends($request->query())
            ->through(fn (StockMovement $movement): array => $this->present($movement));

        return response()->json($movements);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(StockMovement $movement): array
    {
        return [
            'id' => $movement->id,
            'created_at' => $movement->created_at,
            'type' => $movement->type,
            'qty_delta' => (float) $movement->qty_delta,
            'unit_cost' => $movement->unit_cost === null ? null : (int) $movement->unit_cost,
            'balance_after' => $movement->balance_after === null ? null : (float) $movement->balance_after,
            'note' => $movement->note,
            'store' => $movement->store?->only(['id', 'name']),
            'product' => $movement->product?->only(['id', 'name', 'code']),
            'user' => $movement->user?->only(['id', 'name']),
            'document' => $this->document($movement),
        ];
    }

    /**
     * @return array{type: string, id: int, label: string}|null
     */
    private function document(StockMovement $movement): ?array
    {
        $document = $movement->documentable;

        return match (true) {
            $document instanceof GoodsReceipt => ['type' => 'receipt', 'id' => $document->id, 'label' => 'Приёмка '.($document->number ?: '№'.$document->id)],
            $document instanceof WriteOff => ['type' => 'write_off', 'id' => $document->id, 'label' => $document->label()],
            $document instanceof Order => ['type' => 'order', 'id' => $document->id, 'label' => 'Заказ '.$document->number],
            default => null,
        };
    }
}
```

`product.name` отдаётся как у переводимой модели (`only()` вызывает аксессор) — если в ответе строка вместо `{ru, kk}`, заменить на `['id' => …, 'name' => $movement->product->getTranslations('name'), 'code' => …]`, чтобы формат совпадал с остальными эндпоинтами (объект `{ru, kk}`), и отметить это в отчёте.

- [ ] **Step 4: Маршрут**

Импорт; в группе `admin`:

```php
        Route::get('stock-movements', [StockMovementController::class, 'index']);
```

- [ ] **Step 5: Тесты зелёные**

Run: `php artisan route:clear && $TEST tests/Feature/Admin/StockMovementApiTest.php` — Expected: PASS (5 tests). Затем весь блок API этапа: `$TEST tests/Feature/Admin tests/Feature/Inventory` — PASS.

- [ ] **Step 6: Коммит**

```bash
vendor/bin/pint --dirty --format agent
git add app/Http/Controllers/Api/Admin/StockMovementController.php routes/api.php tests/Feature/Admin/StockMovementApiTest.php
git commit -m "feat(admin-api): read-only stock movement ledger"
```

---

### Task 9: `admin/` — типы склада, меню, склады, поставщики, ссылки из остатков

**Files:**
- Create: `admin/src/lib/warehouse.ts`
- Create: `admin/src/components/warehouse/DocumentStatusBadge.tsx`, `admin/src/components/warehouse/StoreSelect.tsx`
- Create: `admin/src/app/stores/page.tsx`, `admin/src/app/suppliers/page.tsx`
- Modify: `admin/src/components/Sidebar.tsx`, `admin/src/components/NoActiveStoreWarning.tsx`, `admin/src/app/stock/page.tsx`

**Interfaces:**
- Consumes: API Tasks 3–4; компоненты этапа 1.
- Produces:
  - `@/lib/warehouse`: типы `Ref`, `Store`, `Supplier`, `DocumentStatus`, `GoodsReceiptListItem`, `GoodsReceiptItem`, `GoodsReceipt`, `WriteOffReason`, `WriteOffListItem`, `WriteOffItem`, `WriteOff`, `MovementType`, `StockMovement`; константы `STORE_TYPES`, `WRITE_OFF_REASONS`, `MOVEMENT_TYPES` (подписи), `QUANTITY_PATTERN`; функции `formatQty(value)`, `formatDateTime(value)`, `documentHref(document)`.
  - `DocumentStatusBadge({ status: DocumentStatus, postedLabel: string })`.
  - `StoreSelect(props: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement>; emptyLabel?: string })` — сам грузит `/admin/stores`, опции `name` (+ « (выключен)» для неактивных).
  - Маршруты `/stores`, `/suppliers`; пункты меню «Движения», «Приёмки», «Списания», «Склады», «Поставщики» (страницы трёх первых — Tasks 10–12).
  - Ссылка «Движения» в строке `/stock` → `/stock-movements?product_id=<id>&store_id=<id>`.

- [ ] **Step 1: Типы и подписи**

`admin/src/lib/warehouse.ts`:

```ts
import type { ProductRef, Translatable } from '@/lib/text';

export type Ref = { id: number; name: string };

export type Store = {
  id: number;
  name: string;
  code: string | null;
  type: 'warehouse' | 'retail_point';
  address: string | null;
  is_active: boolean;
  is_default: boolean;
};

export const STORE_TYPES: Record<Store['type'], string> = {
  warehouse: 'Склад',
  retail_point: 'Точка выдачи / шоурум',
};

export type Supplier = {
  id: number;
  name: string;
  bin: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  is_active: boolean;
};

export type DocumentStatus = 'draft' | 'posted';

export type GoodsReceiptListItem = {
  id: number;
  number: string | null;
  status: DocumentStatus;
  received_at: string | null;
  posted_at: string | null;
  store: Ref;
  supplier: Ref | null;
  items_count: number;
  total_cost: number;
};

export type GoodsReceiptItem = {
  id: number;
  product_id: number;
  quantity: string;
  unit_cost: number;
  product: ProductRef;
};

export type GoodsReceipt = {
  id: number;
  number: string | null;
  status: DocumentStatus;
  received_at: string | null;
  posted_at: string | null;
  note: string | null;
  store_id: number;
  supplier_id: number | null;
  store: Ref;
  supplier: Ref | null;
  user: Ref | null;
  items: GoodsReceiptItem[];
  total_cost: number;
};

export type WriteOffReason = 'damaged' | 'lost' | 'regrading' | 'other';

export const WRITE_OFF_REASONS: Record<WriteOffReason, string> = {
  damaged: 'Брак / повреждение',
  lost: 'Потеря / недостача',
  regrading: 'Пересортица',
  other: 'Прочее',
};

export type WriteOffListItem = {
  id: number;
  reason: WriteOffReason;
  status: DocumentStatus;
  posted_at: string | null;
  created_at: string;
  store: Ref;
  items_count: number;
};

export type WriteOffItem = {
  id: number;
  product_id: number;
  quantity: string;
  product: ProductRef;
  available?: number;
};

export type WriteOff = {
  id: number;
  label: string;
  reason: WriteOffReason;
  note: string | null;
  status: DocumentStatus;
  posted_at: string | null;
  store_id: number;
  store: Ref;
  user: Ref | null;
  items: WriteOffItem[];
  total_cost: number | null;
};

export type MovementType =
  | 'receipt'
  | 'sale'
  | 'return'
  | 'transfer_in'
  | 'transfer_out'
  | 'write_off'
  | 'adjustment'
  | 'stocktake';

export const MOVEMENT_TYPES: Record<MovementType, string> = {
  receipt: 'Приход',
  sale: 'Продажа',
  return: 'Возврат',
  transfer_in: 'Перемещение (приход)',
  transfer_out: 'Перемещение (расход)',
  write_off: 'Списание',
  adjustment: 'Корректировка',
  stocktake: 'Инвентаризация',
};

export type StockMovement = {
  id: number;
  created_at: string;
  type: MovementType;
  qty_delta: number;
  unit_cost: number | null;
  balance_after: number | null;
  note: string | null;
  store: Ref;
  product: { id: number; name: Translatable; code: string | null };
  user: Ref | null;
  document: { type: 'receipt' | 'write_off' | 'order'; id: number; label: string } | null;
};

/** Quantity typed into a form: digits, up to three decimals. */
export const QUANTITY_PATTERN = /^\d+(\.\d{1,3})?$/;

export const formatQty = (value: number | string | null | undefined): string =>
  value === null || value === undefined || value === ''
    ? '—'
    : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 3 });

export const formatDateTime = (value: string | null | undefined): string =>
  value ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export const documentHref = (document: NonNullable<StockMovement['document']>): string =>
  document.type === 'receipt'
    ? `/goods-receipts/${document.id}`
    : document.type === 'write_off'
      ? `/write-offs/${document.id}`
      : `/orders/${document.id}`;
```

- [ ] **Step 2: Мелкие компоненты**

`admin/src/components/warehouse/DocumentStatusBadge.tsx`:

```tsx
import type { DocumentStatus } from '@/lib/warehouse';

export default function DocumentStatusBadge({ status, postedLabel }: { status: DocumentStatus; postedLabel: string }) {
  return status === 'posted' ? (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">{postedLabel}</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">Черновик</span>
  );
}
```

`admin/src/components/warehouse/StoreSelect.tsx`:

```tsx
'use client';

import type { Ref, SelectHTMLAttributes } from 'react';
import { useResource } from '@/lib/crud';
import type { Store } from '@/lib/warehouse';
import { inputClass } from '@/components/ui/styles';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  ref?: Ref<HTMLSelectElement>;
  emptyLabel?: string;
};

/** Warehouse picker for forms (spread `register(...)`) and filters (controlled). */
export default function StoreSelect({ emptyLabel = 'Выберите склад', className, ...props }: Props) {
  const stores = useResource<Store>('/admin/stores');

  return (
    <select className={`${inputClass} ${className ?? ''}`} {...props}>
      <option value="">{emptyLabel}</option>
      {stores.items.map((store) => (
        <option key={store.id} value={store.id}>
          {store.name}
          {store.is_active ? '' : ' (выключен)'}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 3: Склады**

`admin/src/app/stores/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { REQUIRED } from '@/lib/validation';
import { STORE_TYPES, type Store } from '@/lib/warehouse';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

const schema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  code: z.string().max(64),
  type: z.enum(['warehouse', 'retail_point']),
  address: z.string().max(255),
  is_active: z.boolean(),
  is_default: z.boolean(),
});

type StoreForm = z.infer<typeof schema>;

const toForm = (s: Store | null): StoreForm => ({
  name: s?.name ?? '',
  code: s?.code ?? '',
  type: s?.type ?? 'warehouse',
  address: s?.address ?? '',
  is_active: s?.is_active ?? true,
  is_default: s?.is_default ?? false,
});

export default function StoresPage() {
  const stores = useResource<Store>('/admin/stores');
  const [editing, setEditing] = useState<Store | null | undefined>(undefined);

  const columns: Column<Store>[] = [
    {
      key: 'name',
      header: 'Название',
      render: (s) => (
        <span className="font-medium text-zinc-900">
          {s.name}
          {s.is_default && (
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">По умолчанию</span>
          )}
        </span>
      ),
    },
    { key: 'code', header: 'Код', render: (s) => s.code ?? '—' },
    { key: 'type', header: 'Тип', render: (s) => STORE_TYPES[s.type] ?? s.type },
    { key: 'address', header: 'Адрес', render: (s) => s.address ?? '—' },
    { key: 'active', header: 'Клиентам', render: (s) => (s.is_active ? 'Доступен' : 'Выключен') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (s) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(s)}>Изменить</button>
          <ConfirmButton
            question="Удалить склад? Склад с историей удалить нельзя — его можно только выключить."
            onConfirm={() => stores.remove(s.id)}
          >
            Удалить
          </ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Склады"
        actions={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить склад</button>}
      />
      <p className="mb-4 text-sm text-zinc-500">
        Склад «по умолчанию» витрина выбирает первым. Выключенный склад не виден клиентам, но в нём можно проводить приёмки и списания.
      </p>
      <DataTable columns={columns} rows={stores.items} loading={stores.loading} emptyText="Складов нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить склад' : 'Новый склад'}
          schema={schema}
          defaultValues={toForm(editing)}
          onSubmit={(values) => (editing ? stores.update(editing.id, values) : stores.create(values))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => {
            const { errors } = form.formState;
            return (
              <>
                <Field label="Название *" htmlFor="store-name" error={errors.name?.message}>
                  <input id="store-name" className={inputClass} {...form.register('name')} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Код" htmlFor="store-code" error={errors.code?.message}>
                    <input id="store-code" className={inputClass} {...form.register('code')} />
                  </Field>
                  <Field label="Тип" htmlFor="store-type" error={errors.type?.message}>
                    <select id="store-type" className={inputClass} {...form.register('type')}>
                      {Object.entries(STORE_TYPES).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Адрес" htmlFor="store-address" error={errors.address?.message}>
                  <input id="store-address" className={inputClass} {...form.register('address')} />
                </Field>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" {...form.register('is_active')} />
                  Доступен клиентам
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" {...form.register('is_default')} />
                  Склад по умолчанию
                </label>
              </>
            );
          }}
        </CrudModal>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Поставщики**

`admin/src/app/suppliers/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { REQUIRED } from '@/lib/validation';
import type { Supplier } from '@/lib/warehouse';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

const schema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  bin: z.string().max(32),
  phone: z.string().max(64),
  email: z.union([z.literal(''), z.string().email('Некорректный email')]),
  note: z.string().max(2000),
  is_active: z.boolean(),
});

type SupplierForm = z.infer<typeof schema>;

const toForm = (s: Supplier | null): SupplierForm => ({
  name: s?.name ?? '',
  bin: s?.bin ?? '',
  phone: s?.phone ?? '',
  email: s?.email ?? '',
  note: s?.note ?? '',
  is_active: s?.is_active ?? true,
});

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const suppliers = useResource<Supplier>('/admin/suppliers', search.trim() ? { 'filter[search]': search.trim() } : undefined);
  const [editing, setEditing] = useState<Supplier | null | undefined>(undefined);

  const columns: Column<Supplier>[] = [
    { key: 'name', header: 'Название', render: (s) => <span className="font-medium text-zinc-900">{s.name}</span> },
    { key: 'bin', header: 'БИН/ИИН', render: (s) => s.bin ?? '—' },
    { key: 'phone', header: 'Телефон', render: (s) => s.phone ?? '—' },
    { key: 'active', header: 'Статус', render: (s) => (s.is_active ? 'Активен' : 'Выключен') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (s) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(s)}>Изменить</button>
          <ConfirmButton onConfirm={() => suppliers.remove(s.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Поставщики"
        actions={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить поставщика</button>}
      />
      <input
        className={`${inputClass} mb-4 max-w-md`}
        placeholder="Поиск по названию или БИН"
        aria-label="Поиск по названию или БИН"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <DataTable columns={columns} rows={suppliers.items} loading={suppliers.loading} emptyText="Поставщиков нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить поставщика' : 'Новый поставщик'}
          schema={schema}
          defaultValues={toForm(editing)}
          onSubmit={(values) => (editing ? suppliers.update(editing.id, values) : suppliers.create(values))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => {
            const { errors } = form.formState;
            return (
              <>
                <Field label="Название *" htmlFor="sup-name" error={errors.name?.message}>
                  <input id="sup-name" className={inputClass} {...form.register('name')} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="БИН/ИИН" htmlFor="sup-bin" error={errors.bin?.message}>
                    <input id="sup-bin" className={inputClass} {...form.register('bin')} />
                  </Field>
                  <Field label="Телефон" htmlFor="sup-phone" error={errors.phone?.message}>
                    <input id="sup-phone" className={inputClass} {...form.register('phone')} />
                  </Field>
                </div>
                <Field label="Email" htmlFor="sup-email" error={errors.email?.message}>
                  <input id="sup-email" type="email" className={inputClass} {...form.register('email')} />
                </Field>
                <Field label="Заметка" htmlFor="sup-note" error={errors.note?.message}>
                  <textarea id="sup-note" rows={3} className={inputClass} {...form.register('note')} />
                </Field>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" {...form.register('is_active')} />
                  Активен
                </label>
              </>
            );
          }}
        </CrudModal>
      )}
    </div>
  );
}
```

Сервер превращает пустые строки в `null` глобальным middleware `ConvertEmptyStringsToNull`, поэтому формы шлют `''` для пустых полей.

- [ ] **Step 5: Меню**

В `admin/src/components/Sidebar.tsx` заменить группу «Запасы» на:

```tsx
  {
    title: 'Запасы',
    links: [
      { href: '/stock', label: 'Склад' },
      { href: '/stock-movements', label: 'Движения' },
      { href: '/goods-receipts', label: 'Приёмки' },
      { href: '/write-offs', label: 'Списания' },
      { href: '/stores', label: 'Склады' },
      { href: '/suppliers', label: 'Поставщики' },
    ],
  },
```

Внимание: `isActive` в Sidebar считает активной ссылку по `pathname.startsWith(href)`; `/stock` совпадёт с `/stock-movements`. Заменить проверку на точное совпадение или совпадение с `href + '/'`:

```tsx
  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
```

- [ ] **Step 6: Предупреждение и остатки**

`admin/src/components/NoActiveStoreWarning.tsx`: убрать импорт `ERP_ADMIN_URL`, импортировать `Link from 'next/link'`, заменить `<a href={`${ERP_ADMIN_URL}/admin/stores`} target="_blank" rel="noreferrer" …>` на `<Link href="/stores" …>` с теми же классами и **тем же текстом** «Настроить склады →»; в docblock «which is where the fix lives» заменить на «the fix lives on /stores».

`admin/src/app/stock/page.tsx`:
1. Импорт: `import api from '@/lib/api';` (без `ERP_ADMIN_URL`) и `import Link from 'next/link';`.
2. Заменить ссылку в шапке на:

```tsx
          <Link
            href="/goods-receipts"
            className="shrink-0 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Приёмки и списания →
          </Link>
```

3. В жёлтой плашке: «Чтобы изменить его, проведите приёмку или списание.»; в docblock файла «post a goods receipt or an adjustment» → «post a goods receipt or a write-off».
4. Добавить пятую колонку: в `<thead>` после «Себестоимость» `<th className="px-6 py-4 text-right"></th>`; в строке после ячейки себестоимости:

```tsx
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/stock-movements?product_id=${row.product_id}${row.store ? `&store_id=${row.store.id}` : ''}`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800"
                          >
                            Движения
                          </Link>
                        </td>
```

5. Оба `colSpan={4}` → `colSpan={5}`.

- [ ] **Step 7: Проверка**

Run: `cd admin && npx tsc --noEmit && npm run build` и `npx eslint src/lib/warehouse.ts src/components/warehouse src/app/stores src/app/suppliers src/components/Sidebar.tsx src/components/NoActiveStoreWarning.tsx src/app/stock/page.tsx`
Expected: без ошибок; маршруты `/stores`, `/suppliers` в выводе build. `grep -rn ERP_ADMIN_URL admin/src/app/stock admin/src/components/NoActiveStoreWarning.tsx` — пусто.

- [ ] **Step 8: Коммит**

```bash
git add admin/src/lib/warehouse.ts admin/src/components/warehouse admin/src/app/stores admin/src/app/suppliers admin/src/components/Sidebar.tsx admin/src/components/NoActiveStoreWarning.tsx admin/src/app/stock/page.tsx
git commit -m "feat(admin): warehouses and suppliers screens, stock links to the ledger"
```

---

### Task 10: `admin/` — приёмки

**Files:**
- Create: `admin/src/components/warehouse/QuantityForm.ts`
- Create: `admin/src/components/warehouse/GoodsReceiptForm.tsx`
- Create: `admin/src/app/goods-receipts/page.tsx`, `admin/src/app/goods-receipts/[id]/page.tsx`

**Interfaces:**
- Consumes: API Tasks 5–6; `@/lib/warehouse`, `StoreSelect`, `DocumentStatusBadge` (Task 9); компоненты этапа 1.
- Produces:
  - `@/components/warehouse/QuantityForm`: `quantityField` — zod-строка «> 0, до 3 знаков» с сообщением `«Количество больше нуля, до 3 знаков после точки»`.
  - `GoodsReceiptForm`: `receiptSchema`, `type ReceiptFormValues`, `toReceiptForm(r: GoodsReceipt | null)`, `ReceiptFields({ form, suppliers })`. Подписи полей: «Склад *», «Поставщик», «Номер», «Дата приёмки», «Комментарий».
  - Страницы: список с фильтрами и кнопкой «Новая приёмка»; карточка: `EntityPicker` с placeholder «Добавить товар: название или код», модалка позиции с полями «Количество *» и «Себестоимость, ₸ *», кнопки «Провести», «Изменить шапку», «Удалить черновик»; у проведённой — строка «Проведена <дата>[, <кто>]» и ссылка «Движения по этой приёмке» → `/stock-movements?document=receipt:<id>`.

- [ ] **Step 1: Общие поля**

`admin/src/components/warehouse/QuantityForm.ts`:

```ts
import { z } from 'zod';
import { QUANTITY_PATTERN } from '@/lib/warehouse';

const MESSAGE = 'Количество больше нуля, до 3 знаков после точки';

export const quantityField = z
  .string()
  .regex(QUANTITY_PATTERN, MESSAGE)
  .refine((value) => Number(value) > 0, MESSAGE);
```

`admin/src/components/warehouse/GoodsReceiptForm.tsx`:

```tsx
'use client';

import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { REQUIRED } from '@/lib/validation';
import type { GoodsReceipt, Supplier } from '@/lib/warehouse';
import Field from '@/components/ui/Field';
import { inputClass } from '@/components/ui/styles';
import StoreSelect from './StoreSelect';

export const receiptSchema = z.object({
  store_id: z.string().min(1, REQUIRED),
  supplier_id: z.string(),
  number: z.string().max(255),
  received_at: z.string(),
  note: z.string().max(2000),
});

export type ReceiptFormValues = z.infer<typeof receiptSchema>;

/** `<input type="datetime-local">` wants `YYYY-MM-DDTHH:mm` in local time. */
const toLocalInput = (value: string | null): string => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const toReceiptForm = (r: GoodsReceipt | null): ReceiptFormValues => ({
  store_id: r ? String(r.store_id) : '',
  supplier_id: r?.supplier_id ? String(r.supplier_id) : '',
  number: r?.number ?? '',
  received_at: toLocalInput(r?.received_at ?? null),
  note: r?.note ?? '',
});

export function ReceiptFields({ form, suppliers }: { form: UseFormReturn<ReceiptFormValues>; suppliers: Supplier[] }) {
  const { errors } = form.formState;

  return (
    <>
      <Field label="Склад *" htmlFor="gr-store" error={errors.store_id?.message}>
        <StoreSelect id="gr-store" {...form.register('store_id')} />
      </Field>
      <Field label="Поставщик" htmlFor="gr-supplier" error={errors.supplier_id?.message}>
        <select id="gr-supplier" className={inputClass} {...form.register('supplier_id')}>
          <option value="">Без поставщика</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Номер" htmlFor="gr-number" error={errors.number?.message}>
          <input id="gr-number" className={inputClass} {...form.register('number')} />
        </Field>
        <Field label="Дата приёмки" htmlFor="gr-date" error={errors.received_at?.message}>
          <input id="gr-date" type="datetime-local" className={inputClass} {...form.register('received_at')} />
        </Field>
      </div>
      <Field label="Комментарий" htmlFor="gr-note" error={errors.note?.message}>
        <textarea id="gr-note" rows={2} className={inputClass} {...form.register('note')} />
      </Field>
    </>
  );
}
```

`StoreSelect` грузит склады асинхронно: если при открытии модалки редактирования опции ещё не пришли, `select` покажет пустое значение, хотя в форме `store_id` задан. Проверить вручную при `npm run dev`; если воспроизводится — в `StoreSelect` рендерить `select` только после загрузки (`stores.loading ? <div className={inputClass}>Загрузка…</div> : <select …>`), и отметить в отчёте.

- [ ] **Step 2: Список приёмок**

`admin/src/app/goods-receipts/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useResource } from '@/lib/crud';
import { formatTenge } from '@/lib/money';
import { formatDateTime, type GoodsReceipt, type GoodsReceiptListItem, type Supplier } from '@/lib/warehouse';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';
import { buttonPrimary, inputClass } from '@/components/ui/styles';
import DocumentStatusBadge from '@/components/warehouse/DocumentStatusBadge';
import StoreSelect from '@/components/warehouse/StoreSelect';
import { ReceiptFields, receiptSchema, toReceiptForm } from '@/components/warehouse/GoodsReceiptForm';

export default function GoodsReceiptsPage() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [storeId, setStoreId] = useState('');
  const params: Record<string, string> = {};
  if (status) params['filter[status]'] = status;
  if (storeId) params['filter[store_id]'] = storeId;

  const receipts = useResource<GoodsReceiptListItem>('/admin/goods-receipts', params);
  const suppliers = useResource<Supplier>('/admin/suppliers');
  const [creating, setCreating] = useState(false);

  const columns: Column<GoodsReceiptListItem>[] = [
    {
      key: 'number',
      header: 'Приёмка',
      render: (r) => (
        <Link href={`/goods-receipts/${r.id}`} className="font-medium text-zinc-900 hover:text-blue-700">
          {r.number || `№${r.id}`}
        </Link>
      ),
    },
    { key: 'date', header: 'Дата', render: (r) => formatDateTime(r.received_at) },
    { key: 'supplier', header: 'Поставщик', render: (r) => r.supplier?.name ?? '—' },
    { key: 'store', header: 'Склад', render: (r) => r.store.name },
    { key: 'items', header: 'Позиций', render: (r) => r.items_count },
    { key: 'total', header: 'Сумма', render: (r) => formatTenge(r.total_cost) },
    { key: 'status', header: 'Статус', render: (r) => <DocumentStatusBadge status={r.status} postedLabel="Проведена" /> },
  ];

  return (
    <div>
      <PageHeader
        title="Приёмки"
        actions={<button type="button" className={buttonPrimary} onClick={() => setCreating(true)}>Новая приёмка</button>}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          aria-label="Статус"
          className={`${inputClass} max-w-48`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            receipts.setPage(1);
          }}
        >
          <option value="">Все статусы</option>
          <option value="draft">Черновики</option>
          <option value="posted">Проведённые</option>
        </select>
        <StoreSelect
          aria-label="Склад"
          emptyLabel="Все склады"
          className="max-w-64"
          value={storeId}
          onChange={(e) => {
            setStoreId(e.target.value);
            receipts.setPage(1);
          }}
        />
      </div>
      <DataTable
        columns={columns}
        rows={receipts.items}
        loading={receipts.loading}
        meta={receipts.meta}
        onPageChange={receipts.setPage}
        emptyText="Приёмок нет"
      />

      {creating && (
        <CrudModal
          title="Новая приёмка"
          schema={receiptSchema}
          defaultValues={toReceiptForm(null)}
          onSubmit={async (values) => {
            const receipt = (await receipts.create(values)) as unknown as GoodsReceipt;
            router.push(`/goods-receipts/${receipt.id}`);
          }}
          onClose={() => setCreating(false)}
        >
          {(form) => <ReceiptFields form={form} suppliers={suppliers.items} />}
        </CrudModal>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Карточка приёмки**

`admin/src/app/goods-receipts/[id]/page.tsx`:

```tsx
'use client';

import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import api from '@/lib/api';
import { useResource } from '@/lib/crud';
import { serverMessage } from '@/lib/errors';
import { formatTenge, TENGE_PATTERN, tiynToTenge } from '@/lib/money';
import { productLabel, type ProductRef } from '@/lib/text';
import { formatDateTime, formatQty, type GoodsReceipt, type GoodsReceiptItem, type Supplier } from '@/lib/warehouse';
import { toast } from '@/stores/toastStore';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EntityPicker from '@/components/ui/EntityPicker';
import Field from '@/components/ui/Field';
import MoneyInput from '@/components/ui/MoneyInput';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary, buttonSecondary, cardClass, inputClass } from '@/components/ui/styles';
import DocumentStatusBadge from '@/components/warehouse/DocumentStatusBadge';
import { ReceiptFields, receiptSchema, toReceiptForm } from '@/components/warehouse/GoodsReceiptForm';
import { quantityField } from '@/components/warehouse/QuantityForm';

const lineSchema = z.object({
  quantity: quantityField,
  unit_cost: z.string().regex(TENGE_PATTERN, 'Сумма в ₸, до двух знаков после точки'),
});

type LineEditing = { item: GoodsReceiptItem | null; product: ProductRef };

export default function GoodsReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const base = `/admin/goods-receipts/${id}`;

  const [receipt, setReceipt] = useState<GoodsReceipt | null>(null);
  const [loadError, setLoadError] = useState<'not_found' | 'error' | null>(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [line, setLine] = useState<LineEditing | null>(null);
  const items = useResource<GoodsReceiptItem>(`${base}/items`);
  const suppliers = useResource<Supplier>('/admin/suppliers');

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: GoodsReceipt }>(base);
      setReceipt(res.data.data);
      setLoadError(null);
    } catch (error) {
      setLoadError(isAxiosError(error) && error.response?.status === 404 ? 'not_found' : 'error');
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError === 'not_found') {
    return (
      <div className="space-y-3">
        <p className="text-zinc-700">Приёмка не найдена.</p>
        <Link href="/goods-receipts" className={buttonLink}>← К приёмкам</Link>
      </div>
    );
  }

  if (loadError === 'error') {
    return (
      <div className="space-y-3">
        <p className="text-zinc-700">Не удалось загрузить приёмку.</p>
        <button type="button" className={buttonSecondary} onClick={() => void load()}>Повторить</button>
      </div>
    );
  }

  if (!receipt) {
    return <div className="text-zinc-500">Загрузка…</div>;
  }

  const isDraft = receipt.status === 'draft';
  const total = items.items.reduce((sum, i) => sum + Math.round(Number(i.quantity) * i.unit_cost), 0);

  const post = async () => {
    try {
      const res = await api.post<{ data: GoodsReceipt }>(`${base}/post`);
      setReceipt(res.data.data);
      await items.reload();
      toast.success('Приёмка проведена');
    } catch (error) {
      const message = serverMessage(error);
      if (message) {
        toast.error(message);
      }
      await load();
    }
  };

  const columns: Column<GoodsReceiptItem>[] = [
    { key: 'product', header: 'Товар', render: (i) => productLabel(i.product) },
    { key: 'qty', header: 'Количество', className: 'text-right', render: (i) => formatQty(i.quantity) },
    { key: 'cost', header: 'Себестоимость', className: 'text-right', render: (i) => formatTenge(i.unit_cost) },
    { key: 'sum', header: 'Сумма', className: 'text-right', render: (i) => formatTenge(Math.round(Number(i.quantity) * i.unit_cost)) },
    ...(isDraft
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (i: GoodsReceiptItem) => (
              <div className="flex justify-end gap-4">
                <button type="button" className={buttonLink} onClick={() => setLine({ item: i, product: i.product })}>Изменить</button>
                <ConfirmButton question="Удалить позицию?" onConfirm={() => items.remove(i.id)}>Удалить</ConfirmButton>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Приёмка ${receipt.number || `№${receipt.id}`}`}
        back="/goods-receipts"
        actions={
          isDraft ? (
            <>
              <button type="button" className={buttonSecondary} onClick={() => setEditingHeader(true)}>Изменить шапку</button>
              <ConfirmButton
                question="Удалить черновик приёмки?"
                onConfirm={async () => {
                  await api.delete(base);
                  toast.success('Черновик удалён');
                  router.push('/goods-receipts');
                }}
              >
                Удалить черновик
              </ConfirmButton>
              <ConfirmButton
                className={buttonPrimary}
                question="Провести приёмку? Будут созданы партии и движения по складу. Необратимо."
                onConfirm={post}
              >
                Провести
              </ConfirmButton>
            </>
          ) : null
        }
      />

      <div className={`${cardClass} grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-4`}>
        <div><div className="text-zinc-500">Статус</div><DocumentStatusBadge status={receipt.status} postedLabel="Проведена" /></div>
        <div><div className="text-zinc-500">Склад</div>{receipt.store.name}</div>
        <div><div className="text-zinc-500">Поставщик</div>{receipt.supplier?.name ?? '—'}</div>
        <div><div className="text-zinc-500">Дата приёмки</div>{formatDateTime(receipt.received_at)}</div>
        {receipt.note && <div className="col-span-full"><div className="text-zinc-500">Комментарий</div>{receipt.note}</div>}
      </div>

      {!isDraft && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>
            Проведена {formatDateTime(receipt.posted_at)}
            {receipt.user ? `, ${receipt.user.name}` : ''}
          </span>
          <Link href={`/stock-movements?document=receipt:${receipt.id}`} className={buttonLink}>Движения по этой приёмке</Link>
        </div>
      )}

      {isDraft && (
        <EntityPicker<ProductRef>
          searchPath="/admin/products"
          placeholder="Добавить товар: название или код"
          label={productLabel}
          onPick={(product) => setLine({ item: null, product })}
        />
      )}

      <DataTable columns={columns} rows={items.items} loading={items.loading} emptyText="Позиций нет — добавьте товар" />
      <div className="text-right text-sm text-zinc-700">
        Итого: <span className="font-semibold text-zinc-900">{formatTenge(total)}</span>
      </div>

      {line && (
        <CrudModal
          title={`Позиция: ${productLabel(line.product)}`}
          schema={lineSchema}
          defaultValues={{
            quantity: line.item ? String(Number(line.item.quantity)) : '',
            unit_cost: tiynToTenge(line.item?.unit_cost),
          }}
          onSubmit={(values) =>
            line.item ? items.update(line.item.id, values) : items.create({ ...values, product_id: line.product.id })
          }
          onClose={() => setLine(null)}
        >
          {(form) => (
            <>
              <Field label="Количество *" htmlFor="line-qty" error={form.formState.errors.quantity?.message}>
                <input id="line-qty" type="number" step="0.001" min="0" className={inputClass} {...form.register('quantity')} />
              </Field>
              <Field label="Себестоимость, ₸ *" htmlFor="line-cost" error={form.formState.errors.unit_cost?.message}>
                <MoneyInput id="line-cost" {...form.register('unit_cost')} />
              </Field>
            </>
          )}
        </CrudModal>
      )}

      {editingHeader && (
        <CrudModal
          title="Шапка приёмки"
          schema={receiptSchema}
          defaultValues={toReceiptForm(receipt)}
          onSubmit={async (values) => {
            const res = await api.put<{ data: GoodsReceipt }>(base, values);
            setReceipt(res.data.data);
          }}
          onClose={() => setEditingHeader(false)}
        >
          {(form) => <ReceiptFields form={form} suppliers={suppliers.items} />}
        </CrudModal>
      )}
    </div>
  );
}
```

Если React ругается на вызов хуков после раннего `return` — все хуки (`useState`, `useResource`, `useCallback`, `useEffect`) уже объявлены до первого `return`; не переносить их ниже.

- [ ] **Step 4: Проверка**

Run: `cd admin && npx tsc --noEmit && npm run build` и `npx eslint src/components/warehouse src/app/goods-receipts`
Expected: без ошибок; маршруты `/goods-receipts`, `/goods-receipts/[id]`.

- [ ] **Step 5: Коммит**

```bash
git add admin/src/components/warehouse/QuantityForm.ts admin/src/components/warehouse/GoodsReceiptForm.tsx admin/src/app/goods-receipts
git commit -m "feat(admin): goods receipts — list, lines and posting"
```

---

### Task 11: `admin/` — списания

**Files:**
- Create: `admin/src/components/warehouse/WriteOffForm.tsx`
- Create: `admin/src/app/write-offs/page.tsx`, `admin/src/app/write-offs/[id]/page.tsx`

**Interfaces:**
- Consumes: API Task 7; `@/lib/warehouse`, `StoreSelect`, `DocumentStatusBadge`, `quantityField` (Tasks 9–10); компоненты этапа 1.
- Produces:
  - `WriteOffForm`: `writeOffSchema`, `type WriteOffFormValues`, `toWriteOffForm(w: WriteOff | null)`, `WriteOffFields({ form })`. Подписи: «Склад *», «Причина *», «Комментарий».
  - Страницы: список с фильтрами (статус, склад, причина) и кнопкой «Новое списание»; карточка: `EntityPicker` «Добавить товар: название или код», колонка «Доступно» (красным, если количество больше), модалка позиции «Количество *», кнопки «Провести», «Изменить шапку», «Удалить черновик»; у проведённого — «Проведено <дата>[, <кто>]», «Себестоимость: <сумма>», ссылка «Движения по этому списанию» → `/stock-movements?document=write_off:<id>`.

- [ ] **Step 1: Поля шапки**

`admin/src/components/warehouse/WriteOffForm.tsx`:

```tsx
'use client';

import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { REQUIRED } from '@/lib/validation';
import { WRITE_OFF_REASONS, type WriteOff } from '@/lib/warehouse';
import Field from '@/components/ui/Field';
import { inputClass } from '@/components/ui/styles';
import StoreSelect from './StoreSelect';

export const writeOffSchema = z.object({
  store_id: z.string().min(1, REQUIRED),
  reason: z.string().min(1, REQUIRED),
  note: z.string().max(2000),
});

export type WriteOffFormValues = z.infer<typeof writeOffSchema>;

export const toWriteOffForm = (w: WriteOff | null): WriteOffFormValues => ({
  store_id: w ? String(w.store_id) : '',
  reason: w?.reason ?? 'damaged',
  note: w?.note ?? '',
});

export function WriteOffFields({ form }: { form: UseFormReturn<WriteOffFormValues> }) {
  const { errors } = form.formState;

  return (
    <>
      <Field label="Склад *" htmlFor="wo-store" error={errors.store_id?.message}>
        <StoreSelect id="wo-store" {...form.register('store_id')} />
      </Field>
      <Field label="Причина *" htmlFor="wo-reason" error={errors.reason?.message}>
        <select id="wo-reason" className={inputClass} {...form.register('reason')}>
          {Object.entries(WRITE_OFF_REASONS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </Field>
      <Field label="Комментарий" htmlFor="wo-note" error={errors.note?.message}>
        <textarea id="wo-note" rows={2} className={inputClass} {...form.register('note')} />
      </Field>
    </>
  );
}
```

- [ ] **Step 2: Список списаний**

`admin/src/app/write-offs/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useResource } from '@/lib/crud';
import { formatDateTime, WRITE_OFF_REASONS, type WriteOff, type WriteOffListItem } from '@/lib/warehouse';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';
import { buttonPrimary, inputClass } from '@/components/ui/styles';
import DocumentStatusBadge from '@/components/warehouse/DocumentStatusBadge';
import StoreSelect from '@/components/warehouse/StoreSelect';
import { toWriteOffForm, WriteOffFields, writeOffSchema } from '@/components/warehouse/WriteOffForm';

export default function WriteOffsPage() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [storeId, setStoreId] = useState('');
  const [reason, setReason] = useState('');
  const params: Record<string, string> = {};
  if (status) params['filter[status]'] = status;
  if (storeId) params['filter[store_id]'] = storeId;
  if (reason) params['filter[reason]'] = reason;

  const writeOffs = useResource<WriteOffListItem>('/admin/write-offs', params);
  const [creating, setCreating] = useState(false);

  const columns: Column<WriteOffListItem>[] = [
    {
      key: 'label',
      header: 'Списание',
      render: (w) => (
        <Link href={`/write-offs/${w.id}`} className="font-medium text-zinc-900 hover:text-blue-700">
          №{w.id}
        </Link>
      ),
    },
    { key: 'date', header: 'Дата', render: (w) => formatDateTime(w.posted_at ?? w.created_at) },
    { key: 'store', header: 'Склад', render: (w) => w.store.name },
    { key: 'reason', header: 'Причина', render: (w) => WRITE_OFF_REASONS[w.reason] ?? w.reason },
    { key: 'items', header: 'Позиций', render: (w) => w.items_count },
    { key: 'status', header: 'Статус', render: (w) => <DocumentStatusBadge status={w.status} postedLabel="Проведено" /> },
  ];

  const resetPage = () => writeOffs.setPage(1);

  return (
    <div>
      <PageHeader
        title="Списания"
        actions={<button type="button" className={buttonPrimary} onClick={() => setCreating(true)}>Новое списание</button>}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <select aria-label="Статус" className={`${inputClass} max-w-48`} value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
          <option value="">Все статусы</option>
          <option value="draft">Черновики</option>
          <option value="posted">Проведённые</option>
        </select>
        <StoreSelect aria-label="Склад" emptyLabel="Все склады" className="max-w-64" value={storeId} onChange={(e) => { setStoreId(e.target.value); resetPage(); }} />
        <select aria-label="Причина" className={`${inputClass} max-w-56`} value={reason} onChange={(e) => { setReason(e.target.value); resetPage(); }}>
          <option value="">Все причины</option>
          {Object.entries(WRITE_OFF_REASONS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <DataTable
        columns={columns}
        rows={writeOffs.items}
        loading={writeOffs.loading}
        meta={writeOffs.meta}
        onPageChange={writeOffs.setPage}
        emptyText="Списаний нет"
      />

      {creating && (
        <CrudModal
          title="Новое списание"
          schema={writeOffSchema}
          defaultValues={toWriteOffForm(null)}
          onSubmit={async (values) => {
            const writeOff = (await writeOffs.create(values)) as unknown as WriteOff;
            router.push(`/write-offs/${writeOff.id}`);
          }}
          onClose={() => setCreating(false)}
        >
          {(form) => <WriteOffFields form={form} />}
        </CrudModal>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Карточка списания**

`admin/src/app/write-offs/[id]/page.tsx`:

```tsx
'use client';

import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import api from '@/lib/api';
import { useResource } from '@/lib/crud';
import { serverMessage } from '@/lib/errors';
import { formatTenge } from '@/lib/money';
import { productLabel, type ProductRef } from '@/lib/text';
import { formatDateTime, formatQty, WRITE_OFF_REASONS, type WriteOff, type WriteOffItem } from '@/lib/warehouse';
import { toast } from '@/stores/toastStore';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EntityPicker from '@/components/ui/EntityPicker';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary, buttonSecondary, cardClass, inputClass } from '@/components/ui/styles';
import DocumentStatusBadge from '@/components/warehouse/DocumentStatusBadge';
import { quantityField } from '@/components/warehouse/QuantityForm';
import { toWriteOffForm, WriteOffFields, writeOffSchema } from '@/components/warehouse/WriteOffForm';

const lineSchema = z.object({ quantity: quantityField });

type LineEditing = { item: WriteOffItem | null; product: ProductRef };

export default function WriteOffPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const base = `/admin/write-offs/${id}`;

  const [writeOff, setWriteOff] = useState<WriteOff | null>(null);
  const [loadError, setLoadError] = useState<'not_found' | 'error' | null>(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [line, setLine] = useState<LineEditing | null>(null);
  const items = useResource<WriteOffItem>(`${base}/items`);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: WriteOff }>(base);
      setWriteOff(res.data.data);
      setLoadError(null);
    } catch (error) {
      setLoadError(isAxiosError(error) && error.response?.status === 404 ? 'not_found' : 'error');
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError === 'not_found') {
    return (
      <div className="space-y-3">
        <p className="text-zinc-700">Списание не найдено.</p>
        <Link href="/write-offs" className={buttonLink}>← К списаниям</Link>
      </div>
    );
  }

  if (loadError === 'error') {
    return (
      <div className="space-y-3">
        <p className="text-zinc-700">Не удалось загрузить списание.</p>
        <button type="button" className={buttonSecondary} onClick={() => void load()}>Повторить</button>
      </div>
    );
  }

  if (!writeOff) {
    return <div className="text-zinc-500">Загрузка…</div>;
  }

  const isDraft = writeOff.status === 'draft';

  const post = async () => {
    try {
      const res = await api.post<{ data: WriteOff }>(`${base}/post`);
      setWriteOff(res.data.data);
      toast.success('Списание проведено');
    } catch (error) {
      const message = serverMessage(error);
      if (message) {
        toast.error(message);
      }
      await load();
    }
    await items.reload();
  };

  const columns: Column<WriteOffItem>[] = [
    { key: 'product', header: 'Товар', render: (i) => productLabel(i.product) },
    {
      key: 'qty',
      header: 'Количество',
      className: 'text-right',
      render: (i) => {
        const short = isDraft && i.available !== undefined && Number(i.quantity) > i.available;
        return <span className={short ? 'font-semibold text-red-600' : ''}>{formatQty(i.quantity)}</span>;
      },
    },
    ...(isDraft
      ? [
          { key: 'available', header: 'Доступно', className: 'text-right', render: (i: WriteOffItem) => formatQty(i.available ?? 0) },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (i: WriteOffItem) => (
              <div className="flex justify-end gap-4">
                <button type="button" className={buttonLink} onClick={() => setLine({ item: i, product: i.product })}>Изменить</button>
                <ConfirmButton question="Удалить позицию?" onConfirm={() => items.remove(i.id)}>Удалить</ConfirmButton>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={writeOff.label}
        back="/write-offs"
        actions={
          isDraft ? (
            <>
              <button type="button" className={buttonSecondary} onClick={() => setEditingHeader(true)}>Изменить шапку</button>
              <ConfirmButton
                question="Удалить черновик списания?"
                onConfirm={async () => {
                  await api.delete(base);
                  toast.success('Черновик удалён');
                  router.push('/write-offs');
                }}
              >
                Удалить черновик
              </ConfirmButton>
              <ConfirmButton
                className={buttonPrimary}
                question="Провести списание? Товар уйдёт со склада по FIFO. Необратимо."
                onConfirm={post}
              >
                Провести
              </ConfirmButton>
            </>
          ) : null
        }
      />

      <div className={`${cardClass} grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-4`}>
        <div><div className="text-zinc-500">Статус</div><DocumentStatusBadge status={writeOff.status} postedLabel="Проведено" /></div>
        <div><div className="text-zinc-500">Склад</div>{writeOff.store.name}</div>
        <div><div className="text-zinc-500">Причина</div>{WRITE_OFF_REASONS[writeOff.reason] ?? writeOff.reason}</div>
        {writeOff.note && <div className="col-span-full"><div className="text-zinc-500">Комментарий</div>{writeOff.note}</div>}
      </div>

      {!isDraft && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>
            Проведено {formatDateTime(writeOff.posted_at)}
            {writeOff.user ? `, ${writeOff.user.name}` : ''}
            {' · '}Себестоимость: {formatTenge(writeOff.total_cost)}
          </span>
          <Link href={`/stock-movements?document=write_off:${writeOff.id}`} className={buttonLink}>Движения по этому списанию</Link>
        </div>
      )}

      {isDraft && (
        <EntityPicker<ProductRef>
          searchPath="/admin/products"
          placeholder="Добавить товар: название или код"
          label={productLabel}
          onPick={(product) => setLine({ item: null, product })}
        />
      )}

      <DataTable columns={columns} rows={items.items} loading={items.loading} emptyText="Позиций нет — добавьте товар" />

      {line && (
        <CrudModal
          title={`Позиция: ${productLabel(line.product)}`}
          schema={lineSchema}
          defaultValues={{ quantity: line.item ? String(Number(line.item.quantity)) : '' }}
          onSubmit={(values) =>
            line.item ? items.update(line.item.id, values) : items.create({ ...values, product_id: line.product.id })
          }
          onClose={() => setLine(null)}
        >
          {(form) => (
            <Field label="Количество *" htmlFor="wo-line-qty" error={form.formState.errors.quantity?.message}>
              <input id="wo-line-qty" type="number" step="0.001" min="0" className={inputClass} {...form.register('quantity')} />
            </Field>
          )}
        </CrudModal>
      )}

      {editingHeader && (
        <CrudModal
          title="Шапка списания"
          schema={writeOffSchema}
          defaultValues={toWriteOffForm(writeOff)}
          onSubmit={async (values) => {
            const res = await api.put<{ data: WriteOff }>(base, values);
            setWriteOff(res.data.data);
            // The store may have changed — «Доступно» is per store.
            await items.reload();
          }}
          onClose={() => setEditingHeader(false)}
        >
          {(form) => <WriteOffFields form={form} />}
        </CrudModal>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Проверка**

Run: `cd admin && npx tsc --noEmit && npm run build` и `npx eslint src/components/warehouse/WriteOffForm.tsx src/app/write-offs`
Expected: без ошибок; маршруты `/write-offs`, `/write-offs/[id]`.

- [ ] **Step 5: Коммит**

```bash
git add admin/src/components/warehouse/WriteOffForm.tsx admin/src/app/write-offs
git commit -m "feat(admin): write-offs — lines with availability and posting"
```

---

### Task 12: `admin/` — движения

**Files:**
- Create: `admin/src/app/stock-movements/page.tsx`

**Interfaces:**
- Consumes: API Task 8; `@/lib/warehouse` (Task 9); `StoreSelect`; `EntityPicker`, `DataTable`, `useResource`.
- Produces: `/stock-movements` — фильтры в URL: `product_id`, `store_id`, `type`, `from`, `to`, `document` (передаётся в `filter[document]` как есть); колонки «Дата», «Склад», «Товар», «Тип», «Количество» (`+N` зелёным / `−N` красным), «Себестоимость», «Остаток после», «Документ» (ссылка через `documentHref`), «Кто»; кнопка «Сбросить фильтры».

- [ ] **Step 1: Страница**

`admin/src/app/stock-movements/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useResource } from '@/lib/crud';
import { formatTenge } from '@/lib/money';
import { productLabel, ru, type ProductRef } from '@/lib/text';
import { documentHref, formatDateTime, formatQty, MOVEMENT_TYPES, type StockMovement } from '@/lib/warehouse';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EntityPicker from '@/components/ui/EntityPicker';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonSecondary, inputClass } from '@/components/ui/styles';
import StoreSelect from '@/components/warehouse/StoreSelect';

const FILTERS = ['product_id', 'store_id', 'type', 'from', 'to', 'document'] as const;
type FilterKey = (typeof FILTERS)[number];

function MovementsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = (key: FilterKey) => searchParams.get(key) ?? '';

  const params: Record<string, string> = {};
  for (const key of FILTERS) {
    if (value(key)) {
      params[`filter[${key}]`] = value(key);
    }
  }

  const movements = useResource<StockMovement>('/admin/stock-movements', params);
  const [productName, setProductName] = useState('');

  const productId = value('product_id');

  // Opened from /stock with only an id in the URL — show the product's name.
  useEffect(() => {
    if (!productId) {
      return;
    }
    let cancelled = false;
    api
      .get<{ data: ProductRef }>(`/admin/products/${productId}`)
      .then((res) => {
        if (!cancelled) {
          setProductName(productLabel(res.data.data));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const setFilter = (key: FilterKey, next: string) => {
    const query = new URLSearchParams(searchParams.toString());
    if (next) {
      query.set(key, next);
    } else {
      query.delete(key);
    }
    movements.setPage(1);
    router.replace(`${pathname}${query.toString() ? `?${query}` : ''}`);
  };

  const columns: Column<StockMovement>[] = [
    { key: 'date', header: 'Дата', render: (m) => formatDateTime(m.created_at) },
    { key: 'store', header: 'Склад', render: (m) => m.store?.name ?? '—' },
    {
      key: 'product',
      header: 'Товар',
      render: (m) => (
        <div>
          <div className="text-zinc-900">{ru(m.product?.name) || `#${m.product?.id}`}</div>
          {m.product?.code && <div className="text-xs text-zinc-500">{m.product.code}</div>}
        </div>
      ),
    },
    { key: 'type', header: 'Тип', render: (m) => MOVEMENT_TYPES[m.type] ?? m.type },
    {
      key: 'qty',
      header: 'Количество',
      className: 'text-right',
      render: (m) => (
        <span className={m.qty_delta >= 0 ? 'font-medium text-green-700' : 'font-medium text-red-600'}>
          {m.qty_delta >= 0 ? '+' : '−'}
          {formatQty(Math.abs(m.qty_delta))}
        </span>
      ),
    },
    { key: 'cost', header: 'Себестоимость', className: 'text-right', render: (m) => formatTenge(m.unit_cost) },
    { key: 'balance', header: 'Остаток после', className: 'text-right', render: (m) => formatQty(m.balance_after) },
    {
      key: 'document',
      header: 'Документ',
      render: (m) =>
        m.document ? (
          <Link href={documentHref(m.document)} className={buttonLink}>{m.document.label}</Link>
        ) : (
          '—'
        ),
    },
    { key: 'user', header: 'Кто', render: (m) => m.user?.name ?? '—' },
  ];

  const hasFilters = FILTERS.some((key) => value(key));

  return (
    <div>
      <PageHeader
        title="Движения"
        actions={
          hasFilters ? (
            <button type="button" className={buttonSecondary} onClick={() => { movements.setPage(1); router.replace(pathname); setProductName(''); }}>
              Сбросить фильтры
            </button>
          ) : null
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="md:col-span-2">
          {productId ? (
            <div className={`${inputClass} flex items-center justify-between gap-2`}>
              <span className="truncate">{productName || `Товар #${productId}`}</span>
              <button type="button" className={buttonLink} onClick={() => { setProductName(''); setFilter('product_id', ''); }}>×</button>
            </div>
          ) : (
            <EntityPicker<ProductRef>
              searchPath="/admin/products"
              placeholder="Товар: название или код"
              label={productLabel}
              onPick={(p) => { setProductName(productLabel(p)); setFilter('product_id', String(p.id)); }}
            />
          )}
        </div>
        <StoreSelect aria-label="Склад" emptyLabel="Все склады" value={value('store_id')} onChange={(e) => setFilter('store_id', e.target.value)} />
        <select aria-label="Тип" className={inputClass} value={value('type')} onChange={(e) => setFilter('type', e.target.value)}>
          <option value="">Все типы</option>
          {Object.entries(MOVEMENT_TYPES).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <input aria-label="С даты" type="date" className={inputClass} value={value('from')} onChange={(e) => setFilter('from', e.target.value)} />
        <input aria-label="По дату" type="date" className={inputClass} value={value('to')} onChange={(e) => setFilter('to', e.target.value)} />
      </div>
      {value('document') && (
        <p className="mb-3 text-sm text-zinc-600">
          Показаны движения одного документа.{' '}
          <button type="button" className={buttonLink} onClick={() => setFilter('document', '')}>Показать все</button>
        </p>
      )}
      <DataTable
        columns={columns}
        rows={movements.items}
        loading={movements.loading}
        meta={movements.meta}
        onPageChange={movements.setPage}
        emptyText="Движений не найдено"
      />
    </div>
  );
}

export default function StockMovementsPage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense fallback={<div className="text-zinc-500">Загрузка…</div>}>
      <MovementsView />
    </Suspense>
  );
}
```

- [ ] **Step 2: Проверка**

Run: `cd admin && npx tsc --noEmit && npm run build` и `npx eslint src/app/stock-movements`
Expected: без ошибок; маршрут `/stock-movements` собран. Если build ругается на `useSearchParams` вне Suspense — проверить, что в `default export` нет прямого вызова хука (см. `node_modules/next/dist/docs/` про `useSearchParams`).

- [ ] **Step 3: Коммит**

```bash
git add admin/src/app/stock-movements
git commit -m "feat(admin): stock movement ledger with URL filters"
```

---

### Task 13: E2E этапа 2

**Files:**
- Modify: `admin/e2e/adminApi.ts` (методы для подготовки данных)
- Create: `admin/e2e/warehouse.spec.ts`

**Interfaces:**
- Consumes: подписи и тексты из Tasks 9–12; `ADMIN_SESSION`; API этапов 1–2.
- Produces: `adminApi(request).create<T>(path, body): Promise<T>` и `adminApi(request).send<T>(method: 'post' | 'put', path, body?): Promise<T>` — **бросают** при не-2xx (для подготовки данных, не для уборки); `warehouse.spec.ts` с тремя тестами.

Порядок запуска и правила — как на этапе 1: фикстуры приёмки уже есть, серверы уже подняты; **не** запускать `php artisan mvp:acceptance`.

- [ ] **Step 1: Методы подготовки данных**

В `admin/e2e/adminApi.ts` в возвращаемый объект добавить:

```ts
    /**
     * Setup, not cleanup: throws on any non-2xx so a broken precondition
     * fails the test at its cause instead of three steps later.
     */
    async send<T = unknown>(method: "post" | "put", path: string, body?: unknown): Promise<T> {
      const res = await request[method](`${API_URL}${path}`, { headers: headers(), data: body ?? {} });

      if (!res.ok()) {
        throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}: ${await res.text()}`);
      }

      return (await res.json()) as T;
    },
    async create<T = unknown>(path: string, body: unknown): Promise<T> {
      return this.send<T>("post", path, body);
    },
```

- [ ] **Step 2: Спека**

`admin/e2e/warehouse.spec.ts`:

```ts
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { adminApi } from "./adminApi";
import { ADMIN_SESSION } from "./session";

/**
 * Склад: приёмка → остаток → движение; списание с нехваткой; склад с историей.
 *
 * Товар и склад каждый тест заводит сам: товар — выключенным (на витрину не
 * попадёт), склад — неактивным (StoreResolver его не выберет). Общие фикстуры
 * приёмки не трогаются. Проведённые документы удалить нельзя по замыслу, поэтому
 * они остаются в базе с пометкой E2E; черновики убираются в afterEach.
 */
test.use({ storageState: ADMIN_SESSION });

type Created = { data: { id: number } };

const drafts: string[] = [];

test.beforeEach(({ page }) => {
  drafts.length = 0;
  page.on("dialog", (dialog) => dialog.accept());
});

test.afterEach(async ({ request }) => {
  const api = adminApi(request);
  for (const path of drafts) {
    // A draft that got posted answers 422 here — that's fine, it stays by design.
    await api.delete(path);
  }
});

async function setupProductAndStore(request: APIRequestContext, stamp: number) {
  const api = adminApi(request);
  const product = await api.create<Created>("/admin/products", {
    name: { ru: `E2E товар ${stamp}` },
    is_active: false,
  });
  const store = await api.create<Created>("/admin/stores", {
    name: `E2E склад ${stamp}`,
    is_active: false,
  });
  return { productId: product.data.id, storeId: store.data.id, productName: `E2E товар ${stamp}`, storeName: `E2E склад ${stamp}` };
}

async function receiveViaApi(request: APIRequestContext, storeId: number, productId: number, quantity: number) {
  const api = adminApi(request);
  const receipt = await api.create<Created>("/admin/goods-receipts", { store_id: storeId });
  await api.create(`/admin/goods-receipts/${receipt.data.id}/items`, { product_id: productId, quantity, unit_cost: 1000 });
  await api.send("post", `/admin/goods-receipts/${receipt.data.id}/post`);
}

async function addLine(page: Page, productName: string) {
  await page.getByLabel("Добавить товар: название или код").fill(productName);
  await page.getByRole("option").filter({ hasText: productName }).first().click();
}

test("приёмка проводится, остаток растёт, движение видно в журнале", async ({ page, request }) => {
  const stamp = Date.now();
  const { productName, storeName } = await setupProductAndStore(request, stamp);
  const supplierName = `E2E поставщик ${stamp}`;
  const dialog = page.getByRole("dialog");

  await page.goto("/suppliers");
  await page.getByRole("button", { name: "Добавить поставщика" }).click();
  await dialog.getByLabel("Название *").fill(supplierName);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.locator("tbody tr").filter({ hasText: supplierName })).toHaveCount(1);

  await page.goto("/goods-receipts");
  await page.getByRole("button", { name: "Новая приёмка" }).click();
  await dialog.getByLabel("Склад *").selectOption({ label: `${storeName} (выключен)` });
  await dialog.getByLabel("Поставщик").selectOption({ label: supplierName });
  await dialog.getByLabel("Номер").fill(`E2E-${stamp}`);
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  await expect(page).toHaveURL(/\/goods-receipts\/\d+$/);
  drafts.push(`/admin${new URL(page.url()).pathname}`);

  await addLine(page, productName);
  await dialog.getByLabel("Количество *").fill("3");
  await dialog.getByLabel("Себестоимость, ₸ *").fill("1500");
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  // Columns by position: the product name carries a timestamp full of digits.
  const line = page.locator("tbody tr").filter({ hasText: productName });
  await expect(line.locator("td").nth(1)).toHaveText("3");
  await expect(line.locator("td").nth(3)).toHaveText(/4\s500 ₸/);

  await page.getByRole("button", { name: "Провести" }).click();
  await expect(page.getByText(/^Проведена /)).toBeVisible();

  await page.goto("/stock");
  await page.getByPlaceholder("Поиск по названию, коду или артикулу...").fill(productName);
  const stockRow = page.locator("tbody tr").filter({ hasText: storeName });
  await expect(stockRow.locator("td").nth(2)).toHaveText("3");

  await stockRow.getByRole("link", { name: "Движения" }).click();
  await expect(page).toHaveURL(/\/stock-movements\?/);
  const movement = page.locator("tbody tr").filter({ hasText: `Приёмка E2E-${stamp}` });
  await expect(movement).toContainText("Приход");
  await expect(movement).toContainText("+3");
});

test("списание больше остатка отклоняется, исправленное проводится", async ({ page, request }) => {
  const stamp = Date.now();
  const { productId, storeId, productName, storeName } = await setupProductAndStore(request, stamp);
  await receiveViaApi(request, storeId, productId, 2);
  const dialog = page.getByRole("dialog");

  await page.goto("/write-offs");
  await page.getByRole("button", { name: "Новое списание" }).click();
  await dialog.getByLabel("Склад *").selectOption({ label: `${storeName} (выключен)` });
  await dialog.getByLabel("Причина *").selectOption({ label: "Брак / повреждение" });
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  await expect(page).toHaveURL(/\/write-offs\/\d+$/);
  drafts.push(`/admin${new URL(page.url()).pathname}`);

  await addLine(page, productName);
  await dialog.getByLabel("Количество *").fill("5");
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  // Columns by position: «Товар», «Количество», «Доступно».
  const line = page.locator("tbody tr").filter({ hasText: productName });
  await expect(line.locator("td").nth(1)).toHaveText("5");
  await expect(line.locator("td").nth(2)).toHaveText("2");

  await page.getByRole("button", { name: "Провести" }).click();
  await expect(page.getByText(`Не хватает: ${productName} — нужно 5, доступно 2.`)).toBeVisible();

  await line.getByRole("button", { name: "Изменить" }).click();
  await dialog.getByLabel("Количество *").fill("1");
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(line.locator("td").nth(1)).toHaveText("1");

  await page.getByRole("button", { name: "Провести" }).click();
  await expect(page.getByText(/^Проведено /)).toBeVisible();
  await expect(page.getByText(/Себестоимость: 1\s000 ₸/)).toBeVisible();
});

test("склад с историей удалить нельзя", async ({ page, request }) => {
  const stamp = Date.now();
  const { productId, storeId, storeName } = await setupProductAndStore(request, stamp);
  await receiveViaApi(request, storeId, productId, 1);

  await page.goto("/stores");
  const row = page.locator("tbody tr").filter({ hasText: storeName });
  await row.getByRole("button", { name: "Удалить" }).click();

  await expect(page.getByText(/У склада есть история/)).toBeVisible();
  await expect(page.locator("tbody tr").filter({ hasText: storeName })).toHaveCount(1);
});
```

- [ ] **Step 3: Прогон**

Проверить, что API отвечает на новые маршруты: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/admin/stores` → `401` (не `404`; при 404 — устаревший кэш маршрутов в контейнере: сообщить, самому кэш в контейнере не чистить).

```bash
cd admin && npx tsc --noEmit
npx playwright test e2e/warehouse.spec.ts
npx playwright test
```

Expected: `warehouse.spec.ts` — 3/3; весь набор — зелёный, кроме известного падения `stock.spec.ts` из-за расхождения остатка в фикстурах (см. этап 1), если оно всё ещё воспроизводится. Упавший локатор чинить по реальной разметке (доступное имя/роль), не ослабляя проверку; настоящий баг приложения — в отчёт.

- [ ] **Step 4: Коммит**

```bash
git add admin/e2e/adminApi.ts admin/e2e/warehouse.spec.ts
git commit -m "test(admin-e2e): receipts, write-offs and warehouse history"
```

---

### Task 14: Итоговая проверка и документация

**Files:**
- Modify: `docs/superpowers/specs/2026-09-17-admin-warehouse-design.md` (только расхождения с кодом)
- Modify: `CLAUDE.md` (раздел «Two admin panels, split by job»)

- [ ] **Step 1: PHP**

```bash
git diff --name-only main...HEAD -- '*.php' | xargs vendor/bin/pint --format agent
php artisan route:clear
STOREFRONT_REVALIDATION_SECRET= WHATSAPP_API_URL= WHATSAPP_API_KEY= WHATSAPP_INSTANCE_ID= php artisan test --compact
```

Expected: 0 падений. Если pint что-то поменял — коммит `style: pint`.

- [ ] **Step 2: admin/**

Run: `cd admin && npx tsc --noEmit && npm run build && npx eslint src`
Expected: tsc и build чистые; в eslint нет новых ошибок в файлах этапа 2.

- [ ] **Step 3: Спек**

Сверить разделы 1–2 спека с кодом; поправить только расхождения (например, фильтр `filter[document]` у движений, `available` у позиций, подписи колонок). Не переписывать разделы.

- [ ] **Step 4: CLAUDE.md**

В разделе «Two admin panels, split by job» перенести склад из пункта Filament в пункт `admin/`:

```markdown
- **`admin/` (Next.js)** — operational screens for managers: orders and status
  changes, products (with photos, prices by type, per-client prices,
  attributes, variants), stock with the movement ledger, goods receipts,
  write-offs, warehouses, suppliers, B2B client approval, categories, brands,
  attributes, price types, catalog groups, product collections.
  Calls `/api/admin/*` (`auth:sanctum` + `role:admin|manager`). Shared UI lives
  in `admin/src/components/ui`, data access in `admin/src/lib/crud.ts`.
- **Filament (`/admin` on the API host)** — being retired stage by stage
  (`docs/superpowers/specs/2026-09-17-admin-catalog-migration-design.md`,
  `docs/superpowers/specs/2026-09-17-admin-warehouse-design.md`).
  Still the only place for CMS pages, banners, reviews, shorts, catalog
  settings and user editing; its warehouse resources still work on the same
  data until stage 5. `admin/` links out to it (`ERP_ADMIN_URL` in
  `admin/src/lib/api.ts`).
```

В разделе «Stock: the local FIFO ledger is the source of truth» добавить строку в схему:

```
Write-off posted (WriteOffService::post)  ──> FifoInventoryService::issue(type: write_off)
```

- [ ] **Step 5: Коммит и проверка трейлеров**

```bash
git add docs/superpowers/specs/2026-09-17-admin-warehouse-design.md CLAUDE.md
git commit -m "docs: warehouse back-office now lives in admin/"
git log main..HEAD --format=%B | grep -ci "co-authored\|generated with"
```

Expected: последняя команда печатает `0`. Дальше — superpowers:finishing-a-development-branch.
