<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A showroom as the admin card edits it: translations as {ru, kk}, hours
 * always seven entries, and the storefront URL once it is published.
 *
 * @mixin Store
 */
class ShowroomAdminResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $hours = $this->weekly_hours;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'address' => $this->address,
            'city' => $this->city,
            'is_active' => $this->is_active,
            'show_on_site' => $this->show_on_site,
            'landmark' => $this->pair('landmark'),
            'parking' => $this->pair('parking'),
            'description' => $this->pair('description'),
            'phone' => $this->phone,
            'whatsapp' => $this->whatsapp,
            'lat' => $this->lat,
            'lng' => $this->lng,
            'weekly_hours' => is_array($hours) && count($hours) === 7 ? array_values($hours) : array_fill(0, 7, null),
            'services' => $this->services ?? [],
            'area' => $this->area,
            'floors' => $this->floors,
            'is_flagship' => $this->is_flagship,
            'sort_order' => $this->sort_order,
            'cover_url' => $this->getFirstMediaUrl(Store::PHOTOS_COLLECTION, 'card') ?: null,
            'public_url' => $this->resource->isPublishedShowroom()
                ? rtrim((string) config('services.storefront.url'), '/').'/showrooms/'.$this->slug
                : null,
            'products_in_stock' => $this->whenHas('products_in_stock'),
        ];
    }

    /**
     * @return array{ru: string, kk: string}
     */
    private function pair(string $key): array
    {
        return [
            'ru' => (string) $this->resource->getTranslation($key, 'ru', false),
            'kk' => (string) $this->resource->getTranslation($key, 'kk', false),
        ];
    }
}
