<?php

declare(strict_types=1);

namespace App\Http\Requests\Public;

use App\Models\Order;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GuestCheckoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Structural validation only. Business rules (visibility, stock, resolvable
     * price) are enforced in the controller so failures can name the product.
     *
     * `delivery` is entirely optional — absent means pickup. Guests have no
     * saved addresses (no account), so unlike StoreOrderRequest there is no
     * `delivery.address_id` — a "delivery" checkout always needs the raw
     * city/street/building fields.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'store_id' => ['required', 'integer', Rule::exists('stores', 'id')->where('is_active', true)],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'comment' => ['nullable', 'string', 'max:1000'],

            'delivery' => ['nullable', 'array'],
            'delivery.method' => ['nullable', Rule::in([Order::DELIVERY_PICKUP, Order::DELIVERY_DELIVERY])],
            // Honoured only for authenticated retail customers (saved
            // addresses); ownership is re-checked in OrderPlacementService.
            'delivery.address_id' => ['nullable', 'integer'],
            'delivery.city' => ['nullable', 'string', 'max:255', Rule::requiredIf($this->isDeliveryWithoutSavedAddress())],
            'delivery.street' => ['nullable', 'string', 'max:255', Rule::requiredIf($this->isDeliveryWithoutSavedAddress())],
            'delivery.building' => ['nullable', 'string', 'max:50', Rule::requiredIf($this->isDeliveryWithoutSavedAddress())],
            'delivery.apartment' => ['nullable', 'string', 'max:50'],
            'delivery.comment' => ['nullable', 'string', 'max:500'],
        ];
    }

    private function isDeliveryWithoutSavedAddress(): bool
    {
        return $this->input('delivery.method') === Order::DELIVERY_DELIVERY
            && $this->input('delivery.address_id') === null;
    }

    /**
     * RU validation messages (interface text is Russian per AGENTS.md).
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Укажите имя.',
            'phone.required' => 'Укажите номер телефона.',
            'email.email' => 'Укажите корректный email.',
            'store_id.required' => 'Выберите склад для заказа.',
            'store_id.exists' => 'Выбранный склад недоступен.',
            'items.required' => 'Добавьте хотя бы один товар в заказ.',
            'items.min' => 'Добавьте хотя бы один товар в заказ.',
            'items.*.product_id.required' => 'Не указан товар.',
            'items.*.product_id.exists' => 'Товар не найден.',
            'items.*.quantity.required' => 'Укажите количество товара.',
            'items.*.quantity.gt' => 'Количество должно быть больше нуля.',
            'delivery.city.required' => 'Укажите город доставки.',
            'delivery.street.required' => 'Укажите улицу доставки.',
            'delivery.building.required' => 'Укажите дом.',
        ];
    }
}
