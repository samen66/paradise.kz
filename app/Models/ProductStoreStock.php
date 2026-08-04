<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductStoreStockFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductStoreStock extends Model
{
    /** @use HasFactory<ProductStoreStockFactory> */
    use HasFactory;

    protected $touches = ['product'];

    /** Eloquent would otherwise guess `product_store_stocks` (double-plural). */
    protected $table = 'product_store_stock';

    protected $fillable = [
        'product_id',
        'store_id',
        'stock',
        'reserved',
        'avg_cost',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'stock' => 'decimal:3',
            'reserved' => 'decimal:3',
            'avg_cost' => 'integer',
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
     * @return BelongsTo<Store, $this>
     */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }
}
