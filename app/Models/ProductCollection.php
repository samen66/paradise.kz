<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductCollectionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Spatie\Image\Enums\Fit;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Spatie\Translatable\HasTranslations;

/**
 * An admin-curated product selection. On the storefront home it is a
 * product row ("Новинки", "Хиты продаж"); on the B2B portal home it is a
 * "style" with an interior cover photo and a description. `show_on_*`
 * picks the surfaces. Which products surface still passes through the
 * public visibility rules at read time.
 */
class ProductCollection extends Model implements HasMedia
{
    /** @use HasFactory<ProductCollectionFactory> */
    use HasFactory;

    use HasTranslations;
    use InteractsWithMedia;

    public const COVER_COLLECTION = 'cover';

    /** @var list<string> */
    public array $translatable = ['title', 'description'];

    protected $fillable = [
        'title',
        'slug',
        'description',
        'sort_order',
        'is_active',
        'show_on_storefront',
        'show_on_b2b_home',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'show_on_storefront' => 'boolean',
            'show_on_b2b_home' => 'boolean',
        ];
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection(self::COVER_COLLECTION)
            ->useDisk(config('media-library.disk_name'))
            ->singleFile();
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('wide')
            ->fit(Fit::Max, 1920, 1080)
            ->format('webp')
            ->quality(82)
            ->performOnCollections(self::COVER_COLLECTION);

        $this->addMediaConversion('card')
            ->fit(Fit::Max, 800, 600)
            ->format('webp')
            ->quality(82)
            ->performOnCollections(self::COVER_COLLECTION);
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
