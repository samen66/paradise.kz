<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductVariantFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A product variant / modification mirrored from the ERP (e.g. a size/colour of
 * a parent product), with its own external id, barcodes, characteristics, price
 * and stock. Prices are kept in kopecks (minor units).
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
}
