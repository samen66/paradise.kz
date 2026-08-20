<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ProductSaveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|array',
            'name.ru' => 'required|string|max:255',
            'name.kk' => 'nullable|string|max:255',
            'description' => 'nullable|array',
            'description.ru' => 'nullable|string',
            'description.kk' => 'nullable|string',
            'category_id' => 'nullable|exists:categories,id',
            'brand_id' => 'nullable|exists:brands,id',
            'retail_price' => 'nullable|integer|min:0',
            'b2b_price' => 'nullable|integer|min:0',
            'is_active' => 'boolean',
            'is_new_arrival' => 'boolean',
            'images' => 'nullable|array',
            'images.*' => 'image|max:5120',
        ];
    }
}
