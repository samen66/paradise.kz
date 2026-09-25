<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Receipt header only; status and posted_at are set by posting. On create every
 * field is optional — GoodsReceiptController::store fills the store, date,
 * supplier and author.
 */
class GoodsReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['store_id', 'supplier_id', 'number', 'received_at', 'note'] as $field) {
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
            'store_id' => [$this->isMethod('POST') ? 'nullable' : 'sometimes', 'integer', 'exists:stores,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'number' => ['nullable', 'string', 'max:255'],
            'received_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
