<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RegisterRequest extends FormRequest
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
            'name' => ['nullable', 'string', 'max:255'],
            'company_name' => ['required', 'string', 'max:255'],
            // KZ БИН: exactly 12 digits.
            'company_bin' => ['required', 'string', 'digits:12'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')],
            'phone' => ['required', 'string', 'max:50', Rule::unique('users', 'phone')],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'preferred_store_id' => ['nullable', 'integer', 'exists:stores,id'],
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
            'company_name.required' => 'Укажите название компании.',
            'company_bin.required' => 'Укажите БИН компании.',
            'company_bin.digits' => 'БИН должен состоять из 12 цифр.',
            'email.email' => 'Укажите корректный email.',
            'email.unique' => 'Этот email уже зарегистрирован.',
            'phone.required' => 'Укажите номер телефона.',
            'phone.unique' => 'Этот номер телефона уже зарегистрирован.',
            'password.required' => 'Укажите пароль.',
            'password.min' => 'Пароль должен содержать не менее 8 символов.',
            'password.confirmed' => 'Пароли не совпадают.',
            'preferred_store_id.exists' => 'Выбранный склад недоступен.',
        ];
    }
}
