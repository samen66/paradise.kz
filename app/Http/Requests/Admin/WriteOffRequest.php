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
        $optional = $this->isMethod('POST') ? 'nullable' : 'sometimes';

        return [
            // POST без склада и причины — WriteOffController::store подставит.
            'store_id' => [$optional, 'integer', 'exists:stores,id'],
            'reason' => [$optional, Rule::in(WriteOff::REASONS)],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
