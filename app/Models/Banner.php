<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\BannerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Image\Enums\Fit;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Spatie\Translatable\HasTranslations;

/**
 * A storefront promo banner. `placement` names the slot the storefront renders
 * it in (only `home_hero` for now); admins control order via `sort_order`.
 */
class Banner extends Model implements HasMedia
{
    /** @use HasFactory<BannerFactory> */
    use HasFactory;

    use HasTranslations;
    use InteractsWithMedia;

    public const IMAGE_COLLECTION = 'image';

    public const PLACEMENT_HOME_HERO = 'home_hero';

    /** @var list<string> */
    public array $translatable = ['title', 'subtitle'];

    protected $fillable = [
        'placement',
        'title',
        'subtitle',
        'url',
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

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection(self::IMAGE_COLLECTION)
            ->useDisk(config('media-library.disk_name'))
            ->singleFile();
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('wide')
            ->fit(Fit::Max, 1920, 800)
            ->format('webp')
            ->quality(82)
            ->performOnCollections(self::IMAGE_COLLECTION);

        $this->addMediaConversion('mobile')
            ->fit(Fit::Max, 768, 600)
            ->format('webp')
            ->quality(80)
            ->performOnCollections(self::IMAGE_COLLECTION);
    }
}
