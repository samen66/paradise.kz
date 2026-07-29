<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Product payload for the B2B catalog. The per-client price is resolved by the
 * controller (PricingService) and attached as the transient `resolved_price`
 * attribute (in kopecks); it is exposed here in major units (₸). Stock is
 * resolved per-warehouse by the controller (StoreResolver) and attached as
 * the transient `resolved_stock` attribute. Whether the exact stock number is
 * shown at all is controlled by the admin-editable `CatalogSetting` and
 * attached as the transient `show_stock_quantity` attribute; `in_stock`
 * (boolean) is always shown regardless of this setting.
 *
 * @mixin Product
 */
class ProductResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $images = $this->imagePayload();

        return [
            'id' => $this->id,
            'external_id' => $this->external_id,
            'name' => $this->name,
            'slug' => $this->slug,
            'code' => $this->code,
            'article' => $this->article,
            'category_id' => $this->category_id,
            'brand' => $this->whenLoaded('brand', fn (): ?array => $this->brand === null ? null : [
                'id' => $this->brand->id,
                'name' => $this->brand->name,
                'slug' => $this->brand->slug,
            ]),
            // Stable, on-disk URLs (multiple sizes). The single `image` is a
            // convenience for catalog cards; `images` is the full gallery.
            'images' => $images,
            'image' => $images[0]['thumb'] ?? null,
            'stock' => $this->when($this->showStockQuantity(), $this->resolvedStock()),
            'in_stock' => $this->resolvedStock() > 0,
            'price' => $this->majorPrice(),
            'old_price' => $this->majorComparePrice(),
            'is_new' => (bool) $this->is_new_arrival,
            'b2b_min_order_qty' => $this->resource->effectiveB2bMinOrderQty(),
            'external_folder_id' => $this->external_folder_id,
            // Mirrored ERP data so the B2B site never has to call the ERP at
            // read time. `barcodes`/`attributes` are JSON-cast on the model.
            'country' => $this->country,
            'supplier' => $this->supplier,
            'barcodes' => $this->barcodes ?? [],
            'attributes' => $this->attributes ?? [],
            // `description` and `variants` are only included on the detail
            // endpoint, flagged by the controller via the transient
            // `with_description` attribute.
            'description' => $this->when(
                (bool) ($this->resource->with_description ?? false),
                fn (): ?string => $this->description,
            ),
            'variants' => $this->when(
                (bool) ($this->resource->with_description ?? false),
                fn (): array => $this->variantsPayload(),
            ),
            // Structured, admin-curated characteristics (attribute_values) —
            // the storefront's replacement for the raw ERP `attributes` blob.
            'characteristics' => $this->whenLoaded(
                'attributeValues',
                fn (): array => $this->characteristicsPayload(),
            ),
            'rating' => $this->whenLoaded('reviews', fn() => (float) $this->reviews->where('is_approved', true)->avg('rating')),
            'reviews_count' => $this->whenLoaded('reviews', fn() => $this->reviews->where('is_approved', true)->count()),
            'reviews' => $this->when(
                (bool) ($this->resource->with_description ?? false) && $this->relationLoaded('reviews'),
                fn (): array => $this->reviews->where('is_approved', true)->map(fn ($r) => [
                    'id' => $r->id,
                    'name' => $r->name,
                    'rating' => $r->rating,
                    'comment' => $r->comment,
                    'created_at' => $r->created_at->toIso8601String(),
                ])->values()->all(),
            ),
            'shorts' => $this->when(
                (bool) ($this->resource->with_description ?? false) && $this->relationLoaded('shorts'),
                fn (): array => $this->shorts->sortBy('sort_order')->map(fn ($s) => [
                    'id' => $s->id,
                    'video_url' => $s->video_url,
                    'thumbnail_url' => $s->thumbnail_url,
                    'title' => $s->title,
                ])->values()->all(),
            ),
            'showrooms' => $this->when(
                (bool) ($this->resource->with_description ?? false) && $this->relationLoaded('storeStocks'),
                fn (): array => $this->storeStocks->filter(fn ($s) => $s->stock > 0)->map(fn ($s) => [
                    'store' => [
                        'id' => $s->store->id,
                        'name' => $s->store->name,
                        'address' => $s->store->address,
                    ],
                    'stock' => (float) $s->stock,
                ])->values()->all(),
            ),
        ];
    }

    /**
     * @return list<array{name: string, slug: string, value: string}>
     */
    private function characteristicsPayload(): array
    {
        return $this->attributeValues
            ->filter(fn ($attributeValue): bool => $attributeValue->attribute !== null)
            ->map(fn ($attributeValue): array => [
                'name' => $attributeValue->attribute->name,
                'slug' => $attributeValue->attribute->slug,
                'value' => $attributeValue->value,
            ])
            ->values()
            ->all();
    }

    /**
     * Mirrored product variants (modifications). Relies on the `variants`
     * relation being eager-loaded by the controller to avoid N+1.
     *
     * @return list<array<string, mixed>>
     */
    private function variantsPayload(): array
    {
        $showStockQuantity = $this->showStockQuantity();

        return $this->variants
            ->map(fn ($variant): array => [
                'id' => $variant->id,
                'external_id' => $variant->external_id,
                'name' => $variant->name,
                'characteristics' => $variant->characteristics ?? [],
                'barcodes' => $variant->barcodes ?? [],
                'stock' => $this->when($showStockQuantity, (float) $variant->stock),
                'in_stock' => (float) $variant->stock > 0,
            ])
            ->values()
            ->all();
    }

    /**
     * Mirrored product images as on-disk URLs in three sizes. Relies on the
     * `media` relation being eager-loaded by the controller to avoid N+1.
     *
     * @return list<array{thumb: string, medium: string, full: string}>
     */
    private function imagePayload(): array
    {
        return $this->getMedia(Product::IMAGE_COLLECTION)
            ->map(fn ($media): array => [
                'thumb' => $media->getUrl('thumb'),
                'medium' => $media->getUrl('card'),
                'full' => $media->getUrl('full'),
            ])
            ->values()
            ->all();
    }

    /**
     * Resolved per-client price in major units (₸), or null when no base price
     * is known. `resolved_price` is set on the model before serialization.
     */
    private function majorPrice(): ?float
    {
        $kopecks = $this->resource->resolved_price ?? null;

        if ($kopecks === null) {
            return null;
        }

        return $kopecks / 100;
    }

    /**
     * Admin-set "was" price for the storefront discount badge, in major units
     * (₸). Null unless it is actually higher than the resolved price — a
     * stale compare_at_price left below the current price would render as a
     * negative discount, so it's suppressed rather than shown.
     */
    private function majorComparePrice(): ?float
    {
        $kopecks = $this->resource->compare_at_price ?? null;

        if ($kopecks === null || $kopecks <= ($this->resource->resolved_price ?? 0)) {
            return null;
        }

        return $kopecks / 100;
    }

    /**
     * Free stock at the resolved warehouse. `resolved_stock` is set on the
     * model before serialization; absent means "no warehouse resolved".
     */
    private function resolvedStock(): float
    {
        return (float) ($this->resource->resolved_stock ?? 0);
    }

    /**
     * Whether the exact stock number may be shown. `show_stock_quantity` is
     * set on the model before serialization; absent defaults to shown, so
     * resources built without the controller (e.g. in other tests) still
     * behave like today.
     */
    private function showStockQuantity(): bool
    {
        return (bool) ($this->resource->show_stock_quantity ?? true);
    }
}
