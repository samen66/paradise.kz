<?php

declare(strict_types=1);

namespace App\Http\Requests\Orders;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ValidateB2bCartRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * `product_id` is deliberately NOT exists-validated: a cart kept in the
     * browser may reference a product deleted since — such lines come back as
     * `unavailable` instead of failing the whole check.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'store_id' => ['nullable', 'integer', Rule::exists('stores', 'id')->where('is_active', true)],
            'items' => ['required', 'array', 'min:1', 'max:200'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'store_id.exists' => 'Выбранный склад недоступен.',
            'items.required' => 'Корзина пуста.',
            'items.min' => 'Корзина пуста.',
            'items.*.quantity.gt' => 'Количество должно быть больше нуля.',
        ];
    }
}
