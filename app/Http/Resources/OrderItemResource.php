<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A single order line. Prices are stored in kopecks (minor units) and exposed
 * here in major units (₸).
 *
 * @mixin OrderItem
 */
class OrderItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'external_product_id' => $this->external_product_id,
            'name' => $this->name,
            'quantity' => (float) $this->quantity,
            'price' => $this->price / 100,
            // Presentation only, from the live product: the line's name, quantity
            // and price stay the order's own snapshot. Present only when the
            // caller eager-loaded `product` (with `media`), so the order list
            // does not pay for photos it does not show.
            'image' => $this->whenLoaded('product', fn (): ?string => $this->product
                ?->getFirstMedia(Product::IMAGE_COLLECTION)
                ?->getUrl('thumb')),
            'article' => $this->whenLoaded('product', fn (): ?string => $this->product?->article),
        ];
    }
}
