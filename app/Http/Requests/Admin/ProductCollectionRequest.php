<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductCollectionRequest extends FormRequest
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
            'title' => ['required', 'array'],
            'title.ru' => ['required', 'string', 'max:255'],
            'title.kk' => ['nullable', 'string', 'max:255'],
            'slug' => [
                'required', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('product_collections', 'slug')->ignore($this->route('product_collection')),
            ],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
            'description' => ['nullable', 'array'],
            'description.ru' => ['nullable', 'string', 'max:2000'],
            'description.kk' => ['nullable', 'string', 'max:2000'],
            'show_on_storefront' => ['boolean'],
            'show_on_b2b_home' => ['boolean'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function validated($key = null, $default = null): mixed
    {
        $validated = parent::validated();
        $validated['title'] = array_filter($validated['title'], fn (?string $value): bool => $value !== null && $value !== '');

        if (array_key_exists('description', $validated)) {
            $validated['description'] = array_filter(
                $validated['description'] ?? [],
                fn (?string $value): bool => $value !== null && $value !== '',
            );
        }

        if (array_key_exists('sort_order', $validated)) {
            $validated['sort_order'] = (int) ($validated['sort_order'] ?? 0);
        }

        return $key === null ? $validated : data_get($validated, $key, $default);
    }
}
