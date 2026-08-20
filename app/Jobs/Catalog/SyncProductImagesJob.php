<?php

declare(strict_types=1);

namespace App\Jobs\Catalog;

use App\Contracts\Catalog\CatalogSource;
use App\Models\Product;
use App\Services\Catalog\Data\CatalogImage;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/**
 * Mirror a single product's ERP images into our own storage.
 *
 * Reconciles the product's image media collection against the desired set from
 * the ERP, keyed by the `external_image_id` custom property:
 *   - downloads + adds images that are new or whose size/updated changed,
 *   - deletes media for images removed in the ERP,
 *   - leaves unchanged images untouched (no re-download).
 *
 * Downloading is deferred to this queued job (not the catalog sync) because the
 * binary is re-fetchable from the source at any time. See {@see CatalogImage}.
 */
class SyncProductImagesJob implements ShouldQueue
{
    use Queueable;

    /**
     * @param  list<CatalogImage>  $images
     */
    public function __construct(
        private readonly string $source,
        private readonly string $externalId,
        private readonly array $images,
    ) {}

    public function handle(CatalogSource $source): void
    {
        $product = Product::query()
            ->whereHas('externalMapping', function ($query) {
                $query->where('source', $this->source)
                    ->where('external_id', $this->externalId);
            })
            ->first();

        if ($product === null) {
            return;
        }

        $existing = $product->getMedia(Product::IMAGE_COLLECTION)
            ->keyBy(fn (Media $media): string => (string) $media->getCustomProperty('external_image_id'));

        $desiredIds = [];

        foreach ($this->images as $image) {
            $desiredIds[] = $image->id;
            $current = $existing->get($image->id);

            if ($current instanceof Media && ! $this->hasChanged($current, $image)) {
                continue;
            }

            // Replace a stale image (size/updated changed) before re-adding.
            $current?->delete();

            $product->addMediaFromString($source->fetchImageBinary($image))
                ->usingFileName($this->fileName($image))
                ->withCustomProperties([
                    'external_image_id' => $image->id,
                    'size' => $image->size,
                    'updated' => $image->updated,
                ])
                ->toMediaCollection(Product::IMAGE_COLLECTION);
        }

        // Remove media whose source image no longer exists in the ERP. (Uses
        // reject, not except: Eloquent's except() filters by model primary key,
        // not by our custom-property keys.)
        $existing
            ->reject(fn (Media $media): bool => in_array(
                (string) $media->getCustomProperty('external_image_id'),
                $desiredIds,
                strict: true,
            ))
            ->each->delete();
    }

    private function hasChanged(Media $media, CatalogImage $image): bool
    {
        return (int) $media->getCustomProperty('size') !== $image->size
            || $media->getCustomProperty('updated') !== $image->updated;
    }

    private function fileName(CatalogImage $image): string
    {
        $extension = strtolower(pathinfo($image->filename, PATHINFO_EXTENSION)) ?: 'jpg';

        return $image->id.'.'.$extension;
    }
}
