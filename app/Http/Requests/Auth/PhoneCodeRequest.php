<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use App\Services\Auth\B2bPhoneAuthService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PhoneCodeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Registration fields are validated here too, so a missing name is
     * reported before an SMS is spent.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'phone' => ['required', 'string', 'max:32'],
            'intent' => ['required', Rule::in([B2bPhoneAuthService::INTENT_REGISTER, B2bPhoneAuthService::INTENT_LOGIN])],
            'name' => ['nullable', 'required_if:intent,'.B2bPhoneAuthService::INTENT_REGISTER, 'string', 'max:255'],
            'company_name' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'phone.required' => 'Укажите номер телефона.',
            'intent.required' => 'Не указано действие.',
            'intent.in' => 'Неизвестное действие.',
            'name.required_if' => 'Укажите ваше имя.',
        ];
    }
}
