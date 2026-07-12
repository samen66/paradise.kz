<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Flat local-category payload for the public storefront. The frontend rebuilds
 * the tree client-side from `parent_id`, same convention as {@see CategoryResource}
 * (which serves the ERP-mirrored ProductFolder tree for the B2B catalog instead).
 *
 * @mixin Category
 */
class PublicCategoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'parent_id' => $this->parent_id,
            // Detail-only extras, flagged by the controller via the transient
            // `with_detail` attribute (same convention as ProductResource).
            ...($this->resource->with_detail ?? false ? [
                'seo_title' => $this->seo_title,
                'seo_description' => $this->seo_description,
                'children' => self::collection($this->whenLoaded('children')),
                'breadcrumb' => ($this->resource->breadcrumb_chain ?? collect())
                    ->map(fn (Category $ancestor): array => [
                        'id' => $ancestor->id,
                        'name' => $ancestor->name,
                        'slug' => $ancestor->slug,
                    ])
                    ->all(),
            ] : []),
        ];
    }
}
