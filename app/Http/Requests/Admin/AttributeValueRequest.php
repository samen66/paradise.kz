<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AttributeValueRequest extends FormRequest
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
        /** @var Product $product */
        $product = $this->route('product');

        return [
            'attribute_id' => [
                'required', 'integer', 'exists:attributes,id',
                Rule::unique('attribute_values', 'attribute_id')
                    ->where('product_id', $product->id)
                    ->ignore($this->route('attribute_value')),
            ],
            'value' => ['required', 'string', 'max:255'],
        ];
    }
}
