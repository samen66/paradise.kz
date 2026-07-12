<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductFolderFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductFolder extends Model
{
    /** @use HasFactory<ProductFolderFactory> */
    use HasFactory;

    protected $fillable = [
        'source',
        'external_id',
        'parent_external_id',
        'name',
        'path_name',
    ];

    /**
     * @return BelongsTo<ProductFolder, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_external_id', 'external_id');
    }

    /**
     * @return HasMany<ProductFolder, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_external_id', 'external_id');
    }

    /**
     * @return HasMany<Product, $this>
     */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'external_folder_id', 'external_id');
    }
}
