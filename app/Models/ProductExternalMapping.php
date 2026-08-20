<?php
// app/Models/ProductExternalMapping.php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductExternalMappingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductExternalMapping extends Model
{
    /** @use HasFactory<ProductExternalMappingFactory> */
    use HasFactory;

    protected $fillable = [
        'product_id',
        'source',
        'external_id',
        'external_folder_id',
        'synced_at',
        'barcodes',
        'erp_attributes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'barcodes' => 'array',
            'erp_attributes' => 'array',
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
     * The ERP product folder via the external_folder_id.
     *
     * @return BelongsTo<ProductFolder, $this>
     */
    public function folder(): BelongsTo
    {
        return $this->belongsTo(ProductFolder::class, 'external_folder_id', 'external_id');
    }
}
