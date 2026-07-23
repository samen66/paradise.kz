# Kaspi Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Kaspi Pay and Cash payment methods into the checkout flow, track payment statuses locally, and pause ERP sync.

**Architecture:** Extend the `orders` table, update checkout form requests and the placement service to handle payment fields, generate a dummy Kaspi invoice URL, and add a webhook for Kaspi payment callbacks. Disable `PushOrderJob`.

**Tech Stack:** Laravel 11, PHP 8.3

## Global Constraints

- Keep existing ERP fields on `Order`.
- Disable, but do not delete, `PushOrderJob`.

---

### Task 1: Database and Model Updates

**Files:**
- Create: `database/migrations/2026_07_22_000000_add_payment_fields_to_orders_table.php`
- Modify: `app/Models/Order.php:28-50`
- Test: `tests/Feature/Public/GuestCheckoutTest.php`

**Interfaces:**
- Produces: `Order` with `payment_method` and `payment_status`.

- [ ] **Step 1: Write the failing test**

```php
// Add to tests/Feature/Public/GuestCheckoutTest.php

    #[Test]
    public function it_saves_payment_fields_on_order(): void
    {
        $store = \App\Models\Store::factory()->create();
        $product = \App\Models\Product::factory()->create(['retail_price' => 200_000]);
        $this->stockAt($store, $product, 10);

        $response = $this->postJson('/api/public/checkout', [
            'name' => 'Айгерим',
            'phone' => '+77011234567',
            'store_id' => $store->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'kaspi',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('orders', [
            'payment_method' => 'kaspi',
            'payment_status' => 'unpaid',
        ]);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter it_saves_payment_fields_on_order`
Expected: FAIL (validation error on payment_method)

- [ ] **Step 3: Write minimal implementation**

Create migration:
Run: `php artisan make:migration add_payment_fields_to_orders_table`

```php
// In the created migration file
public function up(): void
{
    Schema::table('orders', function (Blueprint $table) {
        $table->string('payment_method')->default('cash')->after('status');
        $table->string('payment_status')->default('unpaid')->after('payment_method');
    });
}

public function down(): void
{
    Schema::table('orders', function (Blueprint $table) {
        $table->dropColumn(['payment_method', 'payment_status']);
    });
}
```
Run `php artisan migrate`.

Update `app/Models/Order.php` fillable array:
```php
    protected $fillable = [
        'number',
        'user_id',
        'store_id',
        'status',
        'payment_method', // New
        'payment_status', // New
        'total',
        'comment',
        // ... rest unchanged
```

- [ ] **Step 4: Run test to verify it passes**
*(Wait, the controller/requests aren't updated yet, so the test will still fail on validation. We will fix it in Task 2. We can comment out the test assertion for now or skip to Task 2)*
We will proceed to Task 2 to fix the test.

- [ ] **Step 5: Commit**

```bash
git add database/migrations app/Models/Order.php tests/Feature/Public/GuestCheckoutTest.php
git commit -m "feat: add payment fields to Order model and migration"
```

---

### Task 2: Update Checkout Requests

**Files:**
- Modify: `app/Http/Requests/Public/GuestCheckoutRequest.php`
- Modify: `app/Http/Requests/Public/RetailCheckoutRequest.php`

**Interfaces:**
- Produces: Validated `payment_method`.

- [ ] **Step 1: Write the failing test**

```php
// Add to tests/Feature/Public/GuestCheckoutTest.php
    #[Test]
    public function checkout_requires_valid_payment_method(): void
    {
        $this->postJson('/api/public/checkout', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['payment_method']);

        $this->postJson('/api/public/checkout', ['payment_method' => 'invalid'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['payment_method']);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter checkout_requires_valid_payment_method`
Expected: FAIL (missing validation rules)

- [ ] **Step 3: Write minimal implementation**

Update `rules()` in `app/Http/Requests/Public/GuestCheckoutRequest.php`:
```php
    public function rules(): array
    {
        return [
            // ... existing rules
            'payment_method' => ['required', 'string', 'in:kaspi,cash'],
        ];
    }
```

Update `rules()` in `app/Http/Requests/Public/RetailCheckoutRequest.php` (if it exists, else check where Retail validation is). (Wait, `CheckoutController` uses `GuestCheckoutRequest` for everything).
Let's modify only `GuestCheckoutRequest`.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter checkout_requires_valid_payment_method`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Http/Requests/Public/GuestCheckoutRequest.php tests/Feature/Public/GuestCheckoutTest.php
git commit -m "feat: validate payment_method in checkout requests"
```

---

### Task 3: Update OrderPlacementService and CheckoutController

**Files:**
- Modify: `app/Services/Orders/OrderPlacementService.php`
- Modify: `app/Http/Controllers/Api/Public/CheckoutController.php`

**Interfaces:**
- Consumes: `payment_method` from validated data.

- [ ] **Step 1: Write the failing test**

*(The test `it_saves_payment_fields_on_order` from Task 1 should pass after this)*

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter it_saves_payment_fields_on_order`
Expected: FAIL (doesn't save to db)

- [ ] **Step 3: Write minimal implementation**

In `app/Services/Orders/OrderPlacementService.php`, update `placeGuest` signature and implementation:
```php
    public function placeGuest(
        string $name,
        string $phone,
        ?string $email,
        array $items,
        int $storeId,
        string $paymentMethod, // NEW
        ?string $comment = null,
        ?array $delivery = null,
    ): Order {
        // ... inside transaction
            $order = $guest->orders()->create([
                'store_id' => $store->id,
                'status' => Order::STATUS_PENDING,
                'payment_method' => $paymentMethod, // NEW
                'payment_status' => 'unpaid', // NEW
                'total' => $subtotal + $deliveryAttributes['delivery_cost'],
        // ...
```
Do the same for `placeRetail`:
```php
    public function placeRetail(
        User $user,
        array $items,
        int $storeId,
        string $paymentMethod, // NEW
        ?string $comment = null,
        ?array $delivery = null,
        ?string $contactEmail = null,
    ): Order {
        // ... inside transaction
            $order = $user->orders()->create([
                'store_id' => $store->id,
                'status' => Order::STATUS_PENDING,
                'payment_method' => $paymentMethod, // NEW
                'payment_status' => 'unpaid', // NEW
        // ...
```

In `app/Http/Controllers/Api/Public/CheckoutController.php`:
```php
    public function store(GuestCheckoutRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user = $request->user('sanctum');

        if ($user !== null && $user->type === User::TYPE_RETAIL && ! $user->is_guest) {
            $order = $this->placement->placeRetail(
                $user,
                $validated['items'],
                $validated['store_id'],
                $validated['payment_method'], // NEW
                $validated['comment'] ?? null,
                $validated['delivery'] ?? null,
                $validated['email'] ?? null,
            );
        } else {
            $order = $this->placement->placeGuest(
                $validated['name'],
                $validated['phone'],
                $validated['email'] ?? null,
                $validated['items'],
                $validated['store_id'],
                $validated['payment_method'], // NEW
                $validated['comment'] ?? null,
                $validated['delivery'] ?? null,
            );
        }

        // PushOrderJob::dispatch($order); // DISABLED FOR NOW
        
        $response = new OrderResource($order);
        $additional = [];
        if ($order->payment_method === 'kaspi') {
            // Mock kaspi URL for MVP
            $additional['payment_url'] = "https://kaspi.kz/pay/mock?order=" . $order->id;
        }

        return $response->additional($additional)
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter it_saves_payment_fields_on_order`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Services/Orders/OrderPlacementService.php app/Http/Controllers/Api/Public/CheckoutController.php
git commit -m "feat: save payment fields and disable PushOrderJob"
```

---

### Task 4: Kaspi Webhook Endpoint

**Files:**
- Create: `app/Http/Controllers/Api/Public/KaspiWebhookController.php`
- Modify: `routes/api.php`
- Create: `tests/Feature/Public/KaspiWebhookTest.php`

**Interfaces:**
- Exposes: `POST /api/public/kaspi/webhook`

- [ ] **Step 1: Write the failing test**

```php
// tests/Feature/Public/KaspiWebhookTest.php
<?php
namespace Tests\Feature\Public;
use App\Models\Order;
use Tests\TestCase;

class KaspiWebhookTest extends TestCase
{
    public function test_webhook_marks_order_as_paid(): void
    {
        $order = Order::factory()->create(['payment_status' => 'unpaid']);
        
        $this->postJson('/api/public/kaspi/webhook', [
            'order_id' => $order->id,
            'status' => 'paid'
        ])->assertOk();

        $this->assertSame('paid', $order->fresh()->payment_status);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Public/KaspiWebhookTest.php`
Expected: FAIL (404 Not Found)

- [ ] **Step 3: Write minimal implementation**

Create `app/Http/Controllers/Api/Public/KaspiWebhookController.php`:
```php
<?php
declare(strict_types=1);
namespace App\Http\Controllers\Api\Public;
use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class KaspiWebhookController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_id' => ['required', 'integer'],
            'status' => ['required', 'string', 'in:paid'],
        ]);

        $order = Order::findOrFail($validated['order_id']);
        $order->update(['payment_status' => 'paid']);

        return response()->json(['success' => true]);
    }
}
```

Update `routes/api.php`:
```php
use App\Http\Controllers\Api\Public\KaspiWebhookController;

// Inside public api group:
Route::post('/kaspi/webhook', KaspiWebhookController::class);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Public/KaspiWebhookTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/Feature/Public/KaspiWebhookTest.php app/Http/Controllers/Api/Public/KaspiWebhookController.php routes/api.php
git commit -m "feat: add basic kaspi webhook to mark orders paid"
```
