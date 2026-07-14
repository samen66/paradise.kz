<?php

declare(strict_types=1);

namespace App\Http\Requests\Orders;

use App\Models\Order;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Structural validation only. Business rules (visibility, stock, resolvable
     * price) are enforced in the controller so failures can name the product.
     *
     * `delivery` is entirely optional — absent means pickup, unchanged from
     * before delivery existed. When `delivery.method` is "delivery", either
     * `delivery.address_id` (one of the client's own saved addresses) or the
     * raw city/street/building fields must be present.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'store_id' => ['required', 'integer', Rule::exists('stores', 'id')->where('is_active', true)],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'comment' => ['nullable', 'string', 'max:1000'],

            'delivery' => ['nullable', 'array'],
            'delivery.method' => ['nullable', Rule::in([Order::DELIVERY_PICKUP, Order::DELIVERY_DELIVERY])],
            'delivery.address_id' => [
                'nullable', 'integer',
                Rule::exists('addresses', 'id')->where('user_id', $this->user()?->id),
            ],
            'delivery.city' => ['nullable', 'string', 'max:255', Rule::requiredIf($this->deliveryNeedsRawAddress())],
            'delivery.street' => ['nullable', 'string', 'max:255', Rule::requiredIf($this->deliveryNeedsRawAddress())],
            'delivery.building' => ['nullable', 'string', 'max:50', Rule::requiredIf($this->deliveryNeedsRawAddress())],
            'delivery.apartment' => ['nullable', 'string', 'max:50'],
            'delivery.comment' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * Raw address fields are only required when delivering AND the client
     * hasn't picked one of their own saved addresses instead.
     */
    private function deliveryNeedsRawAddress(): bool
    {
        return $this->input('delivery.method') === Order::DELIVERY_DELIVERY
            && blank($this->input('delivery.address_id'));
    }

    /**
     * RU validation messages (interface text is Russian per AGENTS.md).
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'store_id.required' => 'Выберите склад для заказа.',
            'store_id.exists' => 'Выбранный склад недоступен.',
            'items.required' => 'Добавьте хотя бы один товар в заказ.',
            'items.min' => 'Добавьте хотя бы один товар в заказ.',
            'items.*.product_id.required' => 'Не указан товар.',
            'items.*.product_id.exists' => 'Товар не найден.',
            'items.*.quantity.required' => 'Укажите количество товара.',
            'items.*.quantity.gt' => 'Количество должно быть больше нуля.',
            'delivery.address_id.exists' => 'Выбранный адрес недоступен.',
            'delivery.city.required' => 'Укажите город доставки.',
            'delivery.street.required' => 'Укажите улицу доставки.',
            'delivery.building.required' => 'Укажите дом.',
        ];
    }

    public function after(): array
    {
        return [
            function (\Illuminate\Validation\Validator $validator): void {
                $user = $this->user();
                if ($user === null || $user->type !== 'b2b') {
                    return;
                }

                foreach ($this->input('items', []) as $index => $item) {
                    $product = \App\Models\Product::find($item['product_id'] ?? 0);
                    if ($product === null) {
                        continue;
                    }

                    $minQty = $product->effectiveB2bMinOrderQty();
                    $qty = (int) ($item['quantity'] ?? 0);

                    if ($qty < $minQty) {
                        $validator->errors()->add(
                            "items.{$index}.quantity",
                            "Минимальное количество для «{$product->getTranslation('name', 'ru', false)}» — {$minQty} шт.",
                        );
                    }
                }
            },
        ];
    }
}
