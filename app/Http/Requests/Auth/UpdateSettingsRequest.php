<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSettingsRequest extends FormRequest
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
            'preferred_store_id' => ['nullable', 'integer', Rule::exists('stores', 'id')->where('is_active', true)],
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
            'preferred_store_id.exists' => 'Выбранный склад недоступен.',
        ];
    }
}
