<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validation for the admin catalog editor (POST /api/admin/products,
 * PUT /api/admin/products/{product}).
 *
 * Money units: every price is *sent* in major units (₸, at most two decimals) —
 * that is what the admin types and what the form labels — and *stored* in the
 * integer minor units (тиын) the `products` columns hold. The conversion happens
 * exactly once, in {@see validated()}, so callers never have to guess which side
 * of the boundary they are on. This mirrors the Filament form, which formats
 * kopecks down for display and dehydrates tenge back up on save.
 *
 * `stock` is deliberately not accepted here. On-hand quantity only ever moves
 * through a goods receipt or a stock correction (FifoInventoryService); a
 * `stock` key in the payload is dropped by validation and never reaches the
 * model.
 */
class ProductSaveRequest extends FormRequest
{
    /**
     * Fields the client sends in ₸ and the database stores in тиын.
     *
     * @var list<string>
     */
    private const PRICE_FIELDS = [
        'retail_price',
        'b2b_price',
        'compare_at_price',
        'min_price',
        'purchase_price',
    ];

    /**
     * Optional scalars that a multipart form submits as "" when left blank.
     * Normalised to null so that, for instance, a blank slug still falls
     * through to Product::booted() instead of being stored as an empty string
     * (which would also collide on the unique index for the second product).
     *
     * @var list<string>
     */
    private const BLANK_MEANS_UNSET = [
        'slug',
        'code',
        'article',
        'uom',
        'country',
        'supplier',
        'weight',
        'volume',
        'b2b_min_order_qty',
        'category_id',
        'brand_id',
        'retail_price',
        'b2b_price',
        'compare_at_price',
        'min_price',
        'purchase_price',
    ];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $normalised = [];

        foreach (self::BLANK_MEANS_UNSET as $field) {
            if ($this->has($field) && $this->input($field) === '') {
                $normalised[$field] = null;
            }
        }

        if ($normalised !== []) {
            $this->merge($normalised);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Identity
            'name' => 'required|array',
            'name.ru' => 'required|string|max:255',
            'name.kk' => 'nullable|string|max:255',
            'description' => 'nullable|array',
            'description.ru' => 'nullable|string',
            'description.kk' => 'nullable|string',
            'code' => 'nullable|string|max:255',
            'article' => 'nullable|string|max:255',
            'category_id' => 'nullable|exists:categories,id',
            'brand_id' => 'nullable|exists:brands,id',

            // SEO. The slug is left blank on create and Product::booted()
            // generates it from the ru name; on update an existing slug must not
            // collide with another product's.
            'slug' => [
                'nullable',
                'string',
                'max:255',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('products', 'slug')->ignore($this->route('product')),
            ],
            'seo_title' => 'nullable|array',
            'seo_title.ru' => 'nullable|string|max:255',
            'seo_title.kk' => 'nullable|string|max:255',
            'seo_description' => 'nullable|array',
            'seo_description.ru' => 'nullable|string|max:1000',
            'seo_description.kk' => 'nullable|string|max:1000',

            // Prices — in ₸ here, converted to тиын by validated().
            'retail_price' => 'nullable|numeric|decimal:0,2|min:0|max:99999999.99',
            'b2b_price' => 'nullable|numeric|decimal:0,2|min:0|max:99999999.99',
            'compare_at_price' => 'nullable|numeric|decimal:0,2|min:0|max:99999999.99',
            'min_price' => 'nullable|numeric|decimal:0,2|min:0|max:99999999.99',
            'purchase_price' => 'nullable|numeric|decimal:0,2|min:0|max:99999999.99',
            'b2b_min_order_qty' => 'nullable|integer|min:1|max:1000000',

            // Physical characteristics — decimal(12,3) columns.
            'uom' => 'nullable|string|max:50',
            'country' => 'nullable|string|max:255',
            'supplier' => 'nullable|string|max:255',
            'weight' => 'nullable|numeric|decimal:0,3|min:0|max:999999999.999',
            'volume' => 'nullable|numeric|decimal:0,3|min:0|max:999999999.999',

            // Storefront flags
            'is_active' => 'boolean',
            'is_new_arrival' => 'boolean',
        ];
    }

    /**
     * Validated payload with every price converted from ₸ to тиын, ready to be
     * mass-assigned. Keys absent from the request stay absent, so a partial
     * update never blanks the fields it did not mention.
     *
     * @param  string|null  $key
     * @param  mixed  $default
     * @return mixed
     */
    public function validated($key = null, $default = null)
    {
        $validated = parent::validated();

        foreach (self::PRICE_FIELDS as $field) {
            if (array_key_exists($field, $validated) && $validated[$field] !== null) {
                $validated[$field] = (int) round((float) $validated[$field] * 100);
            }
        }

        return $key === null ? $validated : data_get($validated, $key, $default);
    }
}
