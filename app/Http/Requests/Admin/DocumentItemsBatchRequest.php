<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Пачка строк из «Подбора»: товар и количество (без количества — 1).
 * Себестоимость не принимается — строки приёмки получают SuggestedUnitCost.
 */
class DocumentItemsBatchRequest extends FormRequest
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
        return [
            'items' => ['required', 'array', 'min:1', 'max:200'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['nullable', 'numeric', 'decimal:0,3', 'gt:0', 'max:9999999.999'],
        ];
    }
}
