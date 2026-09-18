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
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'product_id' => [$required, 'integer', 'exists:products,id'],
            'quantity' => [$required, 'numeric', 'decimal:0,3', 'gt:0', 'max:9999999.999'],
        ];
    }
}
