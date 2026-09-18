<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class B2bHomeContentRequest extends FormRequest
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
            'about_title' => ['required', 'array'],
            'about_title.ru' => ['required', 'string', 'max:255'],
            'about_title.kk' => ['nullable', 'string', 'max:255'],
            'about_text' => ['required', 'array'],
            'about_text.ru' => ['required', 'string', 'max:5000'],
            'about_text.kk' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'about_title.ru.required' => 'Укажите заголовок на русском.',
            'about_text.ru.required' => 'Укажите текст на русском.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function validated($key = null, $default = null): mixed
    {
        $validated = parent::validated();

        foreach (['about_title', 'about_text'] as $field) {
            $validated[$field] = array_filter(
                $validated[$field],
                fn (?string $value): bool => $value !== null && $value !== '',
            );
        }

        return $key === null ? $validated : data_get($validated, $key, $default);
    }
}
