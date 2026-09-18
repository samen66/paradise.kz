<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\B2bHomeContentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Image\Enums\Fit;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Spatie\Translatable\HasTranslations;

/**
 * Single-row "who we are" block of the B2B portal home page, edited in
 * the admin SPA (/b2b-home).
 */
class B2bHomeContent extends Model implements HasMedia
{
    /** @use HasFactory<B2bHomeContentFactory> */
    use HasFactory;

    use HasTranslations;
    use InteractsWithMedia;

    public const ABOUT_IMAGE_COLLECTION = 'about_image';

    /** @var list<string> */
    public array $translatable = ['about_title', 'about_text'];

    protected $fillable = [
        'about_title',
        'about_text',
    ];

    public static function current(): self
    {
        return static::query()->firstOrCreate([]);
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection(self::ABOUT_IMAGE_COLLECTION)
            ->useDisk(config('media-library.disk_name'))
            ->singleFile();
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('wide')
            ->fit(Fit::Max, 1600, 1200)
            ->format('webp')
            ->quality(82)
            ->performOnCollections(self::ABOUT_IMAGE_COLLECTION);
    }
}
