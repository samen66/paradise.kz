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
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'product_id' => [$required, 'integer', 'exists:products,id'],
            'quantity' => [$required, 'numeric', 'decimal:0,3', 'gt:0', 'max:9999999.999'],
            'unit_cost' => [$required, 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
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
