<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\StoreFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Image\Enums\Fit;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Spatie\Translatable\HasTranslations;

/**
 * A warehouse or a retail point. A retail point is also a showroom on the
 * storefront once it is active, marked `show_on_site` and has a slug; its
 * public card (contacts, hours, services, photos) lives on the same row.
 */
class Store extends Model implements HasMedia
{
    /** @use HasFactory<StoreFactory> */
    use HasFactory;

    use HasTranslations;
    use InteractsWithMedia;

    public const TYPE_RETAIL_POINT = 'retail_point';

    public const PHOTOS_COLLECTION = 'showroom_photos';

    public const MAX_PHOTOS = 20;

    /** Service keys a showroom may list; the front-ends own the labels. */
    public const SHOWROOM_SERVICES = ['pickup', 'consult', 'card', 'kids', 'cafe', 'assembly'];

    /** @var list<string> */
    public array $translatable = ['landmark', 'parking', 'description'];

    protected $fillable = [
        'source',
        'external_id',
        'name',
        'code',
        'type',
        'address',
        'is_default',
        'is_active',
        'slug',
        'show_on_site',
        'city',
        'landmark',
        'parking',
        'description',
        'phone',
        'whatsapp',
        'lat',
        'lng',
        'weekly_hours',
        'services',
        'area',
        'floors',
        'is_flagship',
        'sort_order',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'is_active' => 'boolean',
            'show_on_site' => 'boolean',
            'is_flagship' => 'boolean',
            'sort_order' => 'integer',
            'lat' => 'float',
            'lng' => 'float',
            'weekly_hours' => 'array',
            'services' => 'array',
        ];
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection(self::PHOTOS_COLLECTION)
            ->useDisk(config('media-library.disk_name'));
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('wide')
            ->fit(Fit::Max, 1920, 1080)
            ->format('webp')
            ->quality(82)
            ->performOnCollections(self::PHOTOS_COLLECTION);

        $this->addMediaConversion('card')
            ->fit(Fit::Max, 800, 600)
            ->format('webp')
            ->quality(82)
            ->performOnCollections(self::PHOTOS_COLLECTION);
    }

    /**
     * Showrooms the storefront lists, in display order.
     *
     * @param  Builder<Store>  $query
     */
    public function scopePublishedShowrooms(Builder $query): void
    {
        $query->where('type', self::TYPE_RETAIL_POINT)
            ->where('is_active', true)
            ->where('show_on_site', true)
            ->whereNotNull('slug')
            ->orderBy('sort_order')
            ->orderBy('name');
    }

    public function isPublishedShowroom(): bool
    {
        return $this->type === self::TYPE_RETAIL_POINT
            && $this->is_active
            && $this->show_on_site
            && filled($this->slug);
    }

    /**
     * Storefront cache tags to purge after this showroom changes; a renamed
     * slug purges the old page too.
     *
     * @return list<string>
     */
    public function storefrontCacheTags(?string $previousSlug = null): array
    {
        $tags = ['showrooms'];

        foreach ([$this->slug, $previousSlug] as $slug) {
            if (filled($slug)) {
                $tags[] = "showroom:{$slug}";
            }
        }

        return array_values(array_unique($tags));
    }

    /**
     * @return HasMany<ProductStoreStock, $this>
     */
    public function productStocks(): HasMany
    {
        return $this->hasMany(ProductStoreStock::class);
    }

    /**
     * @return HasMany<Batch, $this>
     */
    public function batches(): HasMany
    {
        return $this->hasMany(Batch::class);
    }

    /**
     * @return HasMany<StockMovement, $this>
     */
    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    /**
     * @return HasMany<Order, $this>
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
