<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductVariantFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/**
 * A product variant / modification mirrored from the ERP (e.g. a size/colour of
 * a parent product), with its own external id, barcodes, price and stock.
 * Characteristics live in {@see attributeValues()}, from the same attribute
 * dictionary as the product's; the `characteristics` column is legacy ERP
 * data, no longer written by the admin. Prices are kept in kopecks (minor
 * units).
 */
class ProductVariant extends Model
{
    /** @use HasFactory<ProductVariantFactory> */
    use HasFactory;

    protected $fillable = [
        'product_id',
        'source',
        'external_id',
        'name',
        'code',
        'retail_price',
        'b2b_price',
        'stock',
        'barcodes',
        'characteristics',
        'synced_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'retail_price' => 'integer',
            'b2b_price' => 'integer',
            'stock' => 'decimal:3',
            'barcodes' => 'array',
            'characteristics' => 'array',
            'synced_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return HasMany<ProductVariantAttributeValue, $this>
     */
    public function attributeValues(): HasMany
    {
        return $this->hasMany(ProductVariantAttributeValue::class);
    }

    /**
     * The variant's photos: a subset of its product's `images` collection,
     * in the variant's own order.
     *
     * @return BelongsToMany<Media, $this>
     */
    public function images(): BelongsToMany
    {
        return $this->belongsToMany(Media::class, 'product_variant_media')
            ->withPivot('sort_order')
            ->orderByPivot('sort_order');
    }
}
