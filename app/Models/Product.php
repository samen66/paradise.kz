<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;
use Spatie\Image\Enums\Fit;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Spatie\Translatable\HasTranslations;

class Product extends Model implements HasMedia
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory;

    use HasTranslations;
    use InteractsWithMedia;

    /** Media collection holding the product's images. */
    public const IMAGE_COLLECTION = 'images';

    /** @var list<string> */
    public array $translatable = ['name', 'description'];

    protected $fillable = [
        'category_id',
        'brand_id',
        'name',
        'slug',
        'code',
        'article',
        'description',
        'retail_price',
        'b2b_price',
        'purchase_price',
        'min_price',
        'stock',
        'uom',
        'weight',
        'volume',
        'country',
        'supplier',
        'is_active',
        'is_new_arrival',
        'b2b_min_order_qty',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'retail_price' => 'integer',
            'b2b_price' => 'integer',
            'min_price' => 'integer',
            'stock' => 'decimal:3',
            'weight' => 'decimal:3',
            'volume' => 'decimal:3',
            'is_active' => 'boolean',
            'is_new_arrival' => 'boolean',
            'b2b_min_order_qty' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        // Storefront URL slug, generated from the ru name once the id is
        // known and then kept stable (SEO). ERP sync upserts bypass model
        // events, so `catalog:generate-product-slugs` backfills those rows.
        static::created(function (Product $product): void {
            if ($product->slug === null) {
                $product->slug = $product->generateSlug();
                $product->saveQuietly();
            }
        });
    }

    public function generateSlug(): string
    {
        $base = Str::slug($this->getTranslation('name', 'ru', false));

        return $base === '' ? 'product-'.$this->id : $base.'-'.$this->id;
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection(self::IMAGE_COLLECTION)
            ->useDisk(config('media-library.disk_name'));
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('thumb')
            ->fit(Fit::Contain, 200, 200)
            ->format('webp')
            ->quality(80)
            ->performOnCollections(self::IMAGE_COLLECTION);

        $this->addMediaConversion('card')
            ->fit(Fit::Contain, 600, 600)
            ->format('webp')
            ->quality(80)
            ->performOnCollections(self::IMAGE_COLLECTION);

        $this->addMediaConversion('full')
            ->fit(Fit::Contain, 1200, 1200)
            ->format('webp')
            ->quality(80)
            ->performOnCollections(self::IMAGE_COLLECTION);
    }

    /**
     * @return HasOne<ProductExternalMapping, $this>
     */
    public function externalMapping(): HasOne
    {
        return $this->hasOne(ProductExternalMapping::class);
    }

    /**
     * Whether this product was imported from an external ERP.
     */
    public function isErpSynced(): bool
    {
        return $this->externalMapping !== null;
    }

    /**
     * Local, admin-assigned category. Independent of the ERP-mirrored
     * {@see folder()} tree — never touched by the catalog sync (see
     * SyncProductsJob).
     *
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * Local, admin-assigned brand — never touched by the catalog sync.
     *
     * @return BelongsTo<Brand, $this>
     */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    /**
     * @return HasMany<ProductVariant, $this>
     */
    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }

    /**
     * @return HasMany<ClientProductPrice, $this>
     */
    public function clientPrices(): HasMany
    {
        return $this->hasMany(ClientProductPrice::class);
    }

    /**
     * Structured characteristics (the catalog's own replacement for the
     * ERP-mirrored `attributes` JSON blob).
     *
     * @return HasMany<AttributeValue, $this>
     */
    public function attributeValues(): HasMany
    {
        return $this->hasMany(AttributeValue::class);
    }

    /**
     * Local, per-price-type prices — the catalog's own replacement for the
     * hardcoded retail_price/b2b_price columns (see PricingService).
     *
     * @return HasMany<ProductPrice, $this>
     */
    public function prices(): HasMany
    {
        return $this->hasMany(ProductPrice::class);
    }

    /**
     * @return BelongsToMany<CatalogGroup, $this>
     */
    public function catalogGroups(): BelongsToMany
    {
        return $this->belongsToMany(CatalogGroup::class);
    }

    /**
     * @return HasMany<ProductStoreStock, $this>
     */
    public function storeStocks(): HasMany
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
     * @return HasMany<ProductReview, $this>
     */
    public function reviews(): HasMany
    {
        return $this->hasMany(ProductReview::class);
    }

    /**
     * @return HasMany<ProductShort, $this>
     */
    public function shorts(): HasMany
    {
        return $this->hasMany(ProductShort::class);
    }

    /**
     * @param  Builder<Product>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /**
     * Effective B2B minimum order quantity: per-product override → global default → 1.
     */
    public function effectiveB2bMinOrderQty(): int
    {
        return $this->b2b_min_order_qty
            ?? CatalogSetting::current()->b2b_default_min_order_qty
            ?? 1;
    }
}
