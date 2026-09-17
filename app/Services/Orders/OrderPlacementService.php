<?php

declare(strict_types=1);

namespace App\Services\Orders;

use App\Models\Address;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\User;
use App\Services\Catalog\VisibilityService;
use App\Services\Inventory\FifoInventoryService;
use App\Services\Inventory\InsufficientStockException;
use App\Services\Pricing\PricingService;
use App\Support\Phone;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Turns a validated cart (items: [{product_id, quantity}]) into a persisted
 * `pending` order with snapshotted line prices, fulfilled from one warehouse.
 *
 * Each line is checked against three business rules and rejected with a 422
 * (RU message) on failure:
 *   - the buyer may actually see the product (VisibilityService),
 *   - the requested quantity does not exceed free stock AT THE CHOSEN STORE,
 *   - a price resolves (PricingService returns non-null kopecks).
 *
 * Prices are snapshotted in kopecks (minor units) so the order is immune to
 * later catalog/price changes, and so the push job can forward them as-is.
 *
 * Stock is authoritatively decremented from the local FIFO ledger
 * (FifoInventoryService) at placement time — that ledger is the single source
 * of truth for on-hand quantities. The cheap pre-check below (against the
 * product_store_stock projection) exists only to give a fast, friendly 422
 * before opening a transaction; FifoInventoryService::issue() is the
 * authoritative, lock-guarded check-and-deduct.
 *
 * Two entry points share the same fulfilment/FIFO machinery but differ in
 * identity, visibility and pricing:
 *   - {@see place()}      — an approved B2B client, gated catalog + discounted price.
 *   - {@see placeGuest()} — an anonymous storefront checkout, public catalog +
 *     retail price. No persistent "guest" identity exists in the domain; a
 *     minimal throwaway User row is created so the order can reuse the exact
 *     same Order/admin machinery as a B2B order.
 */
class OrderPlacementService
{
    public function __construct(
        private readonly VisibilityService $visibility,
        private readonly PricingService $pricing,
        private readonly FifoInventoryService $inventory,
        private readonly DeliveryCostCalculator $deliveryCalculator,
        private readonly B2bCartChecker $cartChecker,
    ) {}

    /**
     * @param  array<int, array{product_id: int, quantity: int|float|string}>  $items
     * @param  array{method?: string, address_id?: int, city?: string, street?: string, building?: string, apartment?: string, comment?: string}|null  $delivery
     *                                                                                                                                                            Absent/null means pickup (see {@see resolveDelivery}).
     *
     * @throws ValidationException
     */
    public function place(User $user, array $items, int $storeId, ?string $comment = null, ?array $delivery = null): Order
    {
        $store = Store::findOrFail($storeId);
        [$lines, $products] = $this->buildLines($user, $store, $items);
        $subtotal = $this->totalFor($lines);
        $deliveryAttributes = $this->resolveDelivery($user, $delivery, $subtotal);

        return DB::transaction(function () use ($user, $store, $comment, $subtotal, $lines, $products, $deliveryAttributes): Order {
            $order = $user->orders()->create([
                'store_id' => $store->id,
                'status' => Order::STATUS_PENDING,
                'total' => $subtotal + $deliveryAttributes['delivery_cost'],
                'comment' => $comment,
                ...$deliveryAttributes,
            ]);

            $order->items()->createMany($lines);
            $this->issueLinesOrFail($order, $lines, $products, $store, $user);

            return $order->load(['items', 'store', 'address']);
        });
    }

    /**
     * Anonymous storefront checkout: no login, no approval gate, retail
     * pricing. Contact details are snapshotted on the order (guest_name is the
     * throwaway user's name; email is snapshotted separately since the
     * user's own email is a synthetic, non-contactable placeholder). Guests
     * have no saved addresses, so `delivery.address_id` is never honoured
     * here — only raw address fields (see {@see resolveDelivery}).
     *
     * @param  array<int, array{product_id: int, quantity: int|float|string}>  $items
     * @param  array{method?: string, city?: string, street?: string, building?: string, apartment?: string, comment?: string}|null  $delivery
     *                                                                                                                                          Absent/null means pickup (see {@see resolveDelivery}).
     *
     * @throws ValidationException
     */
    public function placeGuest(
        string $name,
        string $phone,
        ?string $email,
        array $items,
        int $storeId,
        string $paymentMethod,
        ?string $comment = null,
        ?array $delivery = null,
    ): Order {
        $store = Store::findOrFail($storeId);
        [$lines, $products] = $this->buildGuestLines($store, $items);
        $subtotal = $this->totalFor($lines);
        $deliveryAttributes = $this->resolveDelivery(null, $delivery, $subtotal);

        return DB::transaction(function () use ($name, $phone, $email, $store, $comment, $subtotal, $lines, $products, $deliveryAttributes, $paymentMethod): Order {
            $guest = User::create([
                'name' => $name,
                'email' => 'guest-'.Str::uuid().'@guest.paradise.kz',
                // Normalized so OTP login can later claim this order by phone.
                'phone' => Phone::normalize($phone),
                'password' => Hash::make(Str::random(40)),
                'type' => User::TYPE_RETAIL,
                'is_approved' => true,
                'is_guest' => true,
            ]);

            $order = $guest->orders()->create([
                'store_id' => $store->id,
                'status' => Order::STATUS_PENDING,
                'payment_method' => $paymentMethod,
                'payment_status' => 'unpaid',
                'total' => $subtotal + $deliveryAttributes['delivery_cost'],
                'comment' => $comment,
                'contact_email' => $email,
                ...$deliveryAttributes,
            ]);

            $order->items()->createMany($lines);
            $this->issueLinesOrFail($order, $lines, $products, $store, $guest);

            return $order->load(['items', 'store', 'address']);
        });
    }

    /**
     * Checkout for an authenticated retail (storefront) customer: public
     * catalog visibility and retail pricing like {@see placeGuest}, but the
     * order belongs to the customer's real account (no throwaway user) and
     * `delivery.address_id` is honoured for saved addresses.
     *
     * @param  array<int, array{product_id: int, quantity: int|float|string}>  $items
     * @param  array{method?: string, address_id?: int, city?: string, street?: string, building?: string, apartment?: string, comment?: string}|null  $delivery
     *
     * @throws ValidationException
     */
    public function placeRetail(
        User $user,
        array $items,
        int $storeId,
        string $paymentMethod,
        ?string $comment = null,
        ?array $delivery = null,
        ?string $contactEmail = null,
    ): Order {
        $store = Store::findOrFail($storeId);
        [$lines, $products] = $this->buildGuestLines($store, $items);
        $subtotal = $this->totalFor($lines);
        $deliveryAttributes = $this->resolveDelivery($user, $delivery, $subtotal);

        return DB::transaction(function () use ($user, $store, $comment, $contactEmail, $subtotal, $lines, $products, $deliveryAttributes, $paymentMethod): Order {
            $order = $user->orders()->create([
                'store_id' => $store->id,
                'status' => Order::STATUS_PENDING,
                'payment_method' => $paymentMethod,
                'payment_status' => 'unpaid',
                'total' => $subtotal + $deliveryAttributes['delivery_cost'],
                'comment' => $comment,
                'contact_email' => $contactEmail,
                ...$deliveryAttributes,
            ]);

            $order->items()->createMany($lines);
            $this->issueLinesOrFail($order, $lines, $products, $store, $user);

            return $order->load(['items', 'store', 'address']);
        });
    }

    /**
     * Resolve the order's delivery snapshot: pickup is free and carries no
     * address; delivery either copies a B2B client's saved address (by id, an
     * ownership-checked re-fetch — the FormRequest layer already validated
     * ownership, this is the same defensive-re-fetch precedent as
     * `Store::findOrFail`) or snapshots the raw address fields submitted
     * inline (the only option for guests, or a B2B client's one-off address).
     *
     * @param  array{method?: string, address_id?: int, city?: string, street?: string, building?: string, apartment?: string, comment?: string}|null  $delivery
     * @return array{delivery_method: string, delivery_cost: int, address_id: int|null, delivery_city: ?string, delivery_street: ?string, delivery_building: ?string, delivery_apartment: ?string, delivery_comment: ?string}
     */
    private function resolveDelivery(?User $user, ?array $delivery, int $subtotal): array
    {
        $method = $delivery['method'] ?? Order::DELIVERY_PICKUP;

        if ($method !== Order::DELIVERY_DELIVERY) {
            return [
                'delivery_method' => Order::DELIVERY_PICKUP,
                'delivery_cost' => 0,
                'address_id' => null,
                'delivery_city' => null,
                'delivery_street' => null,
                'delivery_building' => null,
                'delivery_apartment' => null,
                'delivery_comment' => null,
            ];
        }

        $address = null;

        if ($user !== null && ! empty($delivery['address_id'])) {
            $address = Address::query()->where('user_id', $user->id)->findOrFail((int) $delivery['address_id']);
        }

        return [
            'delivery_method' => Order::DELIVERY_DELIVERY,
            'delivery_cost' => $this->deliveryCalculator->costFor($subtotal),
            'address_id' => $address?->id,
            'delivery_city' => $address->city ?? ($delivery['city'] ?? null),
            'delivery_street' => $address->street ?? ($delivery['street'] ?? null),
            'delivery_building' => $address->building ?? ($delivery['building'] ?? null),
            'delivery_apartment' => $address->apartment ?? ($delivery['apartment'] ?? null),
            'delivery_comment' => $address->comment ?? ($delivery['comment'] ?? null),
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $lines
     */
    private function totalFor(array $lines): int
    {
        return array_sum(array_map(
            static fn (array $line): int => (int) round($line['price'] * (float) $line['quantity']),
            $lines,
        ));
    }

    /**
     * Draw down FIFO stock for every line, rejecting the whole order (rolling
     * back the transaction) if a layer turns out short — e.g. a race between
     * the pre-check above and this authoritative, lock-guarded deduction.
     *
     * @param  array<int, array<string, mixed>>  $lines
     * @param  array<int, Product>  $products
     *
     * @throws ValidationException
     */
    private function issueLinesOrFail(Order $order, array $lines, array $products, Store $store, User $user): void
    {
        foreach ($lines as $index => $line) {
            try {
                $this->inventory->issue(
                    product: $products[$line['product_id']],
                    store: $store,
                    quantity: (float) $line['quantity'],
                    type: StockMovement::TYPE_SALE,
                    document: $order,
                    user: $user,
                );
            } catch (InsufficientStockException) {
                $this->reject($index, "Товара «{$line['name']}» недостаточно на складе «{$store->name}».");
            }
        }
    }

    /**
     * One query for the whole cart's stock at the chosen store (no N+1). This
     * mirrors what FifoInventoryService keeps in product_store_stock, so it is
     * a fast, accurate pre-check ahead of the authoritative issue().
     *
     * @param  array<int, array{product_id: int, quantity: int|float|string}>  $items
     * @return Collection<int, float>
     */
    private function stockByProductId(Store $store, array $items): Collection
    {
        return ProductStoreStock::query()
            ->where('store_id', $store->id)
            ->whereIn('product_id', array_column($items, 'product_id'))
            ->pluck('stock', 'product_id');
    }

    /**
     * Validate every cart item and produce the order-item attribute rows for
     * an authenticated B2B client. The rules live in {@see B2bCartChecker},
     * shared with the portal's cart check, so both always agree.
     *
     * @param  array<int, array{product_id: int, quantity: int|float|string}>  $items
     * @return array{0: array<int, array<string, mixed>>, 1: array<int, Product>} Lines, and their products keyed by product id.
     *
     * @throws ValidationException
     */
    private function buildLines(User $user, Store $store, array $items): array
    {
        $lines = [];
        $products = [];

        foreach ($this->cartChecker->check($user, $store, $items) as $index => $checked) {
            $product = $checked['product'];
            $name = $product?->name;

            match ($checked['problem']) {
                null => null,
                B2bCartChecker::PROBLEM_UNAVAILABLE => $this->reject($index, "Товар «{$name}» недоступен для заказа."),
                B2bCartChecker::PROBLEM_NO_PRICE => $this->reject($index, "Для товара «{$name}» не определена цена."),
                B2bCartChecker::PROBLEM_BELOW_MIN_QTY => $this->reject($index, "Минимальное количество для «{$name}» — {$checked['min_qty']} шт."),
                default => $this->reject($index, "Товара «{$name}» недостаточно на складе «{$store->name}»."),
            };

            $products[$product->id] = $product;
            $lines[] = [
                'product_id' => $product->id,
                'external_product_id' => $product->externalMapping?->external_id,
                'name' => $product->name,
                'quantity' => $checked['quantity'],
                'price' => $checked['price'],
            ];
        }

        return [$lines, $products];
    }

    /**
     * Validate every cart item and produce the order-item attribute rows for
     * an anonymous storefront checkout: public catalog visibility, retail
     * pricing, no per-client override.
     *
     * @param  array<int, array{product_id: int, quantity: int|float|string}>  $items
     * @return array{0: array<int, array<string, mixed>>, 1: array<int, Product>} Lines, and their products keyed by product id.
     *
     * @throws ValidationException
     */
    private function buildGuestLines(Store $store, array $items): array
    {
        $stockByProductId = $this->stockByProductId($store, $items);
        $lines = [];
        $products = [];

        foreach ($items as $index => $item) {
            $product = Product::findOrFail($item['product_id']);
            $quantity = (float) $item['quantity'];

            if (! $this->visibility->canSeePublicly($product)) {
                $this->reject($index, "Товар «{$product->name}» недоступен для заказа.");
            }

            // The order is fulfilled from exactly one warehouse, so only that
            // warehouse's balance may be promised — including when it is zero.
            // (The old fallback to the all-warehouse aggregate let a sold-out
            // line pass this pre-check and fail later inside issue().)
            $availableStock = (float) ($stockByProductId[$product->id] ?? 0);

            if ($quantity > $availableStock) {
                $this->reject($index, "Товара «{$product->name}» недостаточно на складе «{$store->name}».");
            }

            $price = $this->pricing->retailPriceFor($product);

            if ($price === null) {
                $this->reject($index, "Для товара «{$product->name}» не определена цена.");
            }

            $products[$product->id] = $product;
            $lines[] = [
                'product_id' => $product->id,
                'external_product_id' => $product->externalMapping?->external_id,
                'name' => $product->name,
                'quantity' => $quantity,
                'price' => $price,
            ];
        }

        return [$lines, $products];
    }

    /**
     * @throws ValidationException
     */
    private function reject(int $index, string $message): never
    {
        throw ValidationException::withMessages([
            "items.{$index}" => [$message],
        ]);
    }
}
