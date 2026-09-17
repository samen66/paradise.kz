<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Orders\ValidateB2bCartRequest;
use App\Models\Product;
use App\Services\Catalog\StoreResolver;
use App\Services\Orders\B2bCartChecker;
use App\Services\Orders\DeliveryCostCalculator;
use Illuminate\Http\JsonResponse;

/**
 * B2B portal pre-checkout check of the browser-side cart: the client's own
 * prices, visibility, minimum order quantity and stock at the chosen
 * warehouse. Pure read — POST /api/orders re-checks the same rules
 * ({@see B2bCartChecker}) authoritatively inside its transaction.
 */
class CartController extends Controller
{
    public function __construct(
        private readonly B2bCartChecker $checker,
        private readonly StoreResolver $stores,
        private readonly DeliveryCostCalculator $deliveryCalculator,
    ) {}

    public function validateCart(ValidateB2bCartRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user = $request->user();
        $store = $this->stores->resolve($user, isset($validated['store_id']) ? (int) $validated['store_id'] : null);

        if ($store === null) {
            abort(422, 'Нет доступного склада.');
        }

        $subtotal = 0; // kopecks, over valid lines only
        $lines = [];

        foreach ($this->checker->check($user, $store, $validated['items']) as $line) {
            $product = $line['product'];

            if ($line['problem'] === null) {
                $subtotal += (int) round($line['price'] * $line['quantity']);
            }

            $lines[] = [
                'product_id' => $line['product_id'],
                'quantity' => $line['quantity'],
                'available' => $line['problem'] === null,
                'problem' => $line['problem'],
                'name' => $product?->name,
                'slug' => $product?->slug,
                'article' => $product?->article,
                'image' => $product?->getFirstMediaUrl(Product::IMAGE_COLLECTION, 'thumb') ?: null,
                'price' => $line['price'] === null ? null : $line['price'] / 100,
                'stock' => $line['stock'],
                'min_qty' => $line['min_qty'],
            ];
        }

        $deliveryCost = $this->deliveryCalculator->costFor($subtotal);

        return new JsonResponse([
            'data' => [
                'store_id' => $store->id,
                'items' => $lines,
                'subtotal' => $subtotal / 100,
                // What delivery would cost for this subtotal; pickup is free.
                'delivery_cost' => $deliveryCost / 100,
                'total_with_delivery' => ($subtotal + $deliveryCost) / 100,
                'total_pickup' => $subtotal / 100,
            ],
        ]);
    }
}
