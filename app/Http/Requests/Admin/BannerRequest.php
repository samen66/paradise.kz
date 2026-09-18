<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Models\Banner;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BannerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Title and subtitle are optional: a hero can be a photo alone.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'placement' => ['required', Rule::in(array_keys(Banner::PLACEMENTS))],
            'title' => ['nullable', 'array'],
            'title.ru' => ['nullable', 'string', 'max:255'],
            'title.kk' => ['nullable', 'string', 'max:255'],
            'subtitle' => ['nullable', 'array'],
            'subtitle.ru' => ['nullable', 'string', 'max:255'],
            'subtitle.kk' => ['nullable', 'string', 'max:255'],
            'url' => ['nullable', 'string', 'max:2048'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'placement.required' => 'Выберите место баннера.',
            'placement.in' => 'Неизвестное место баннера.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function validated($key = null, $default = null): mixed
    {
        $validated = parent::validated();

        foreach (['title', 'subtitle'] as $field) {
            $validated[$field] = array_filter(
                $validated[$field] ?? [],
                fn (?string $value): bool => $value !== null && $value !== '',
            );
        }

        if (array_key_exists('sort_order', $validated)) {
            $validated['sort_order'] = (int) ($validated['sort_order'] ?? 0);
        }

        return $key === null ? $validated : data_get($validated, $key, $default);
    }
}
