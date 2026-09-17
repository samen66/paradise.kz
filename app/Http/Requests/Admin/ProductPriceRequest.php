<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ConvertsTengeToTiyn;
use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductPriceRequest extends FormRequest
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
        /** @var Product $product */
        $product = $this->route('product');

        return [
            'price_type_id' => [
                'required', 'integer', 'exists:price_types,id',
                Rule::unique('product_prices', 'price_type_id')
                    ->where('product_id', $product->id)
                    ->ignore($this->route('price')),
            ],
            'price' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
        ];
    }

    /**
     * @return list<string>
     */
    protected function priceFields(): array
    {
        return ['price'];
    }
}
