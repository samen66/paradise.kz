<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ConvertsTengeToTiyn;
use Illuminate\Foundation\Http\FormRequest;

class GoodsReceiptItemRequest extends FormRequest
{
    use ConvertsTengeToTiyn;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $isCreate = $this->isMethod('POST');

        return [
            'product_id' => [$isCreate ? 'required' : 'sometimes', 'integer', 'exists:products,id'],
            // POST: без количества — 1, без себестоимости — SuggestedUnitCost.
            'quantity' => [$isCreate ? 'nullable' : 'sometimes', 'numeric', 'decimal:0,3', 'gt:0', 'max:9999999.999'],
            'unit_cost' => [$isCreate ? 'nullable' : 'sometimes', 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
        ];
    }

    /**
     * @return list<string>
     */
    protected function priceFields(): array
    {
        return ['unit_cost'];
    }
}
