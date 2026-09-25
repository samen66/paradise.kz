<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AttributeRequest extends FormRequest
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
            'name' => ['required', 'array'],
            'name.ru' => ['required', 'string', 'max:255'],
            'name.kk' => ['nullable', 'string', 'max:255'],
            // Blank on create: the controller makes one from name.ru. Blank on
            // update: the current slug stays.
            'slug' => [
                'nullable', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('attributes', 'slug')->ignore($this->route('attribute')),
            ],
            'is_filterable' => ['boolean'],
        ];
    }
}
