<?php

declare(strict_types=1);

namespace App\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ValidateCartRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * `product_id` is deliberately NOT exists-validated: a browser cart may
     * reference a product that was deleted since — such lines come back as
     * `available: false` instead of failing the whole request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'store_id' => ['nullable', 'integer', Rule::exists('stores', 'id')->where('is_active', true)],
            'items' => ['required', 'array', 'min:1'],
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
            'items.required' => 'Корзина пуста.',
            'items.min' => 'Корзина пуста.',
            'items.*.quantity.gt' => 'Количество должно быть больше нуля.',
        ];
    }
}
