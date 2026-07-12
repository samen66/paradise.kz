<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductCollectionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Spatie\Translatable\HasTranslations;

/**
 * An admin-curated product selection rendered as a block on the storefront
 * home page ("Новинки", "Хиты продаж", ...). Which products actually surface
 * still passes through the public visibility rules at read time.
 */
class ProductCollection extends Model
{
    /** @use HasFactory<ProductCollectionFactory> */
    use HasFactory;

    use HasTranslations;

    /** @var list<string> */
    public array $translatable = ['title'];

    protected $fillable = [
        'title',
        'slug',
        'sort_order',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return BelongsToMany<Product, $this>
     */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'product_collection_product')
            ->withPivot('sort_order')
            ->orderByPivot('sort_order');
    }
}
