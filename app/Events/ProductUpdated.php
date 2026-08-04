<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Product;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ProductUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * Create a new event instance.
     */
    public function __construct(
        public readonly Product $product,
    ) {}

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('product.' . $this->product->id),
        ];
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        // For B2C frontend, we broadcast the retail price from PricingService (which checks product_prices).
        // It casts kopecks to major units (₸) similar to ProductResource.
        /** @var \App\Services\Pricing\PricingService $pricingService */
        $pricingService = app(\App\Services\Pricing\PricingService::class);
        $retailPriceInKopecks = $pricingService->retailPriceFor($this->product);

        $price = $retailPriceInKopecks !== null ? $retailPriceInKopecks / 100 : null;
        
        $oldPrice = null;
        if ($this->product->compare_at_price !== null && $this->product->compare_at_price > ($retailPriceInKopecks ?? 0)) {
            $oldPrice = $this->product->compare_at_price / 100;
        }

        return [
            'id' => $this->product->id,
            'price' => $price,
            'old_price' => $oldPrice,
            'stock' => (float) $this->product->stock,
            'in_stock' => $this->product->stock > 0,
        ];
    }
}
