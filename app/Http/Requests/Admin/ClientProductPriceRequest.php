<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ConvertsTengeToTiyn;
use App\Models\Product;
use App\Models\User;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ClientProductPriceRequest extends FormRequest
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
            'user_id' => [
                'required', 'integer',
                function (string $attribute, mixed $value, Closure $fail): void {
                    $user = User::find($value);

                    if ($user === null || ! $user->hasRole('b2b_customer')) {
                        $fail('Персональная цена задаётся только B2B-клиенту.');
                    }
                },
                Rule::unique('client_product_prices', 'user_id')
                    ->where('product_id', $product->id)
                    ->ignore($this->route('client_price')),
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
