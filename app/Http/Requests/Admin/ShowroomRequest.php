<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Models\Store;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * The public card of a showroom. Accounting fields (`type`, `code`,
 * `is_active`, `is_default`) belong to the warehouse screen and are not
 * accepted here.
 */
class ShowroomRequest extends FormRequest
{
    private const NULLABLE_STRINGS = ['address', 'slug', 'city', 'phone', 'whatsapp', 'area', 'floors', 'lat', 'lng'];

    private const TRANSLATABLE = ['landmark', 'parking', 'description'];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (self::NULLABLE_STRINGS as $field) {
            if ($this->input($field) === '') {
                $this->merge([$field => null]);
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Store|null $store */
        $store = $this->route('store');

        return [
            'name' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'slug' => [
                'nullable', 'string', 'max:100', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('stores', 'slug')->ignore($store),
            ],
            'show_on_site' => ['sometimes', 'boolean'],
            'city' => ['nullable', 'string', 'max:100'],
            'landmark' => ['nullable', 'array'],
            'landmark.ru' => ['nullable', 'string', 'max:255'],
            'landmark.kk' => ['nullable', 'string', 'max:255'],
            'parking' => ['nullable', 'array'],
            'parking.ru' => ['nullable', 'string', 'max:255'],
            'parking.kk' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'array'],
            'description.ru' => ['nullable', 'string', 'max:5000'],
            'description.kk' => ['nullable', 'string', 'max:5000'],
            'phone' => ['nullable', 'string', 'max:32'],
            'whatsapp' => ['nullable', 'string', 'regex:/^7\d{10}$/'],
            'lat' => ['nullable', 'numeric', 'between:-90,90', 'required_with:lng'],
            'lng' => ['nullable', 'numeric', 'between:-180,180', 'required_with:lat'],
            'weekly_hours' => ['nullable', 'array', 'size:7'],
            'weekly_hours.*' => ['nullable', 'array'],
            'services' => ['nullable', 'array'],
            'services.*' => ['string', 'distinct', Rule::in(Store::SHOWROOM_SERVICES)],
            'area' => ['nullable', 'string', 'max:50'],
            'floors' => ['nullable', 'string', 'max:50'],
            'is_flagship' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $this->checkWeeklyHours($validator);
                $this->checkPublishable($validator);
            },
        ];
    }

    /**
     * Translations come back without empty locales; hours are reduced to
     * exactly `{open, close}` or null per day, Monday first.
     *
     * @return array<string, mixed>
     */
    public function validated($key = null, $default = null): mixed
    {
        $validated = parent::validated();

        foreach (self::TRANSLATABLE as $field) {
            if (array_key_exists($field, $validated)) {
                $validated[$field] = array_filter(
                    $validated[$field] ?? [],
                    fn (?string $value): bool => $value !== null && $value !== '',
                );
            }
        }

        if (array_key_exists('weekly_hours', $validated) && $validated['weekly_hours'] !== null) {
            // validated() can list a null day's key out of order; the index is the weekday.
            ksort($validated['weekly_hours']);
            $validated['weekly_hours'] = array_map(
                fn (?array $day): ?array => $day === null ? null : ['open' => $day['open'], 'close' => $day['close']],
                array_values($validated['weekly_hours']),
            );
        }

        if (array_key_exists('services', $validated)) {
            $validated['services'] = array_values($validated['services'] ?? []);
        }

        return $key === null ? $validated : data_get($validated, $key, $default);
    }

    private function checkWeeklyHours(Validator $validator): void
    {
        $hours = $this->input('weekly_hours');

        if (! is_array($hours) || count($hours) !== 7) {
            return;
        }

        foreach (array_values($hours) as $index => $day) {
            if (! is_array($day)) {
                continue;
            }

            $open = $day['open'] ?? null;
            $close = $day['close'] ?? null;

            if (! $this->isTime($open) || ! $this->isTime($close)) {
                $validator->errors()->add("weekly_hours.{$index}", 'Время — в формате ЧЧ:ММ.');
            } elseif ($open >= $close) {
                $validator->errors()->add("weekly_hours.{$index}", 'Открытие должно быть раньше закрытия.');
            }
        }
    }

    /**
     * Publishing needs a page address: the one sent now, or the saved one.
     */
    private function checkPublishable(Validator $validator): void
    {
        if (! $this->boolean('show_on_site')) {
            return;
        }

        /** @var Store|null $store */
        $store = $this->route('store');
        $slug = $this->exists('slug') ? $this->input('slug') : $store?->slug;

        if (blank($slug) && $this->isMethod('PUT')) {
            $validator->errors()->add('show_on_site', 'Чтобы показать шоурум на сайте, заполните адрес страницы (slug).');
        }
    }

    private function isTime(mixed $value): bool
    {
        return is_string($value) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $value) === 1;
    }
}
