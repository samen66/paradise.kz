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
        $isCreate = $this->isMethod('POST');

        return [
            'product_id' => [$isCreate ? 'required' : 'sometimes', 'integer', 'exists:products,id'],
            // POST: без количества — 1.
            'quantity' => [$isCreate ? 'nullable' : 'sometimes', 'numeric', 'decimal:0,3', 'gt:0', 'max:9999999.999'],
        ];
    }
}
