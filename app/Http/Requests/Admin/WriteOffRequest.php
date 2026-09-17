<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Models\WriteOff;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WriteOffRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->input('note') === '') {
            $this->merge(['note' => null]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'store_id' => [$required, 'integer', 'exists:stores,id'],
            'reason' => [$required, Rule::in(WriteOff::REASONS)],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
