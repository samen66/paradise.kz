<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Order payload. `total` is stored in kopecks (minor units) and exposed here in
 * major units (₸). Items are included when loaded on the model.
 *
 * @mixin Order
 */
class OrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->status,
            'payment_method' => $this->payment_method,
            'payment_status' => $this->payment_status,
            'total' => $this->total / 100,
            'comment' => $this->comment,
            'contact_email' => $this->contact_email,
            'external_order_id' => $this->external_order_id,
            'external_number' => $this->external_number,
            'store_id' => $this->store_id,
            'store_name' => $this->whenLoaded('store', fn (): ?string => $this->store?->name),
            'store_address' => $this->whenLoaded('store', fn (): ?string => $this->store?->address),
            'delivery_method' => $this->delivery_method,
            'delivery_cost' => $this->delivery_cost / 100,
            'delivery_address' => $this->when($this->isDelivery(), fn (): array => [
                'city' => $this->delivery_city,
                'street' => $this->delivery_street,
                'building' => $this->delivery_building,
                'apartment' => $this->delivery_apartment,
                'comment' => $this->delivery_comment,
            ]),
            'created_at' => $this->created_at,
            'items' => OrderItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
