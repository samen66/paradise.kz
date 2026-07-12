<?php

declare(strict_types=1);

namespace App\Http\Requests\Addresses;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Shared rules for creating and updating one of the authenticated B2B
 * client's own saved addresses.
 */
class AddressRequest extends FormRequest
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
            'city' => ['required', 'string', 'max:255'],
            'street' => ['required', 'string', 'max:255'],
            'building' => ['required', 'string', 'max:50'],
            'apartment' => ['nullable', 'string', 'max:50'],
            'comment' => ['nullable', 'string', 'max:500'],
            'is_default' => ['nullable', 'boolean'],
        ];
    }

    /**
     * RU validation messages (interface text is Russian per AGENTS.md).
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'city.required' => 'Укажите город.',
            'street.required' => 'Укажите улицу.',
            'building.required' => 'Укажите дом.',
        ];
    }
}
