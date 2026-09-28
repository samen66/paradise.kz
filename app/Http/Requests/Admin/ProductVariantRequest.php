<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ConvertsTengeToTiyn;
use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

/**
 * `stock`, `source`, `external_id` and `synced_at` are deliberately absent:
 * stock moves only through FifoInventoryService, and the ERP fields are
 * historical data the admin neither shows nor edits; the legacy
 * `characteristics` JSON is ERP data and no longer written.
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
            // Characteristics — the whole set, synced by AttributeValueSync.
            'attribute_values' => ['sometimes', 'array'],
            'attribute_values.*.attribute_id' => ['required', 'integer', 'distinct', 'exists:attributes,id'],
            'attribute_values.*.value' => ['required', 'array'],
            'attribute_values.*.value.ru' => ['required', 'string', 'max:255'],
            'attribute_values.*.value.kk' => ['nullable', 'string', 'max:255'],
            // Photos: ids of this product's gallery, in the variant's order.
            'media_ids' => ['sometimes', 'array'],
            'media_ids.*' => ['integer', 'distinct', $this->ownPhoto()],
        ];
    }

    /**
     * @return list<string>
     */
    protected function priceFields(): array
    {
        return ['retail_price', 'b2b_price'];
    }

    /**
     * A media id from this product's `images` collection — never another
     * product's photo.
     */
    private function ownPhoto(): Exists
    {
        /** @var Product $product */
        $product = $this->route('product');

        return Rule::exists('media', 'id')
            ->where('model_type', $product->getMorphClass())
            ->where('model_id', $product->id)
            ->where('collection_name', Product::IMAGE_COLLECTION);
    }
}
