<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Product;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/**
 * A published showroom for the storefront. `products_count` and the
 * `previewProducts` relation are set by Public\ShowroomController.
 *
 * @mixin Store
 */
class PublicShowroomResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $hours = $this->weekly_hours;

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'city' => $this->city,
            'address' => $this->address,
            'landmark' => $this->landmark ?: null,
            'parking' => $this->parking ?: null,
            'description' => $this->description ?: null,
            'phone' => $this->phone,
            'whatsapp' => $this->whatsapp,
            'lat' => $this->lat,
            'lng' => $this->lng,
            'weekly_hours' => is_array($hours) && count($hours) === 7 ? array_values($hours) : array_fill(0, 7, null),
            'services' => $this->services ?? [],
            'area' => $this->area,
            'floors' => $this->floors,
            'is_flagship' => $this->is_flagship,
            'photos' => $this->getMedia(Store::PHOTOS_COLLECTION)
                ->map(fn (Media $media): array => ['wide' => $media->getUrl('wide'), 'card' => $media->getUrl('card')])
                ->values()
                ->all(),
            'products_count' => (int) ($this->resource->products_count ?? 0),
            'products_preview' => $this->resource->relationLoaded('previewProducts')
                ? $this->resource->getRelation('previewProducts')->map(fn (Product $product): array => [
                    'id' => $product->id,
                    'slug' => $product->slug,
                    'name' => $product->name,
                    'image' => $product->getFirstMediaUrl(Product::IMAGE_COLLECTION, 'thumb') ?: null,
                ])->values()->all()
                : [],
        ];
    }
}
