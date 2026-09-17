<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ConvertsTengeToTiyn;
use Illuminate\Foundation\Http\FormRequest;

/**
 * `stock`, `source`, `external_id` and `synced_at` are deliberately absent:
 * stock moves only through FifoInventoryService, and the ERP fields are
 * historical data the admin neither shows nor edits.
 */
class ProductVariantRequest extends FormRequest
{
    use ConvertsTengeToTiyn;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['code', 'retail_price', 'b2b_price'] as $field) {
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
        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:255'],
            'retail_price' => ['nullable', 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
            'b2b_price' => ['nullable', 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
            'barcodes' => ['nullable', 'array'],
            'barcodes.*' => ['string', 'max:64'],
            'characteristics' => ['nullable', 'array'],
            'characteristics.*' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return list<string>
     */
    protected function priceFields(): array
    {
        return ['retail_price', 'b2b_price'];
    }
}
