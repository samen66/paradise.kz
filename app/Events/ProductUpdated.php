<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Product;
use App\Services\Catalog\PublicProductPresenter;
use App\Services\Catalog\StoreResolver;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Live price/stock update for open storefront and B2B pages. Dispatched only
 * after the surrounding transaction commits, so the queued broadcast never
 * reloads the product before its new stock is visible.
 */
class ProductUpdated implements ShouldBroadcast, ShouldDispatchAfterCommit
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
            new Channel('product.'.$this->product->id),
        ];
    }

    /**
     * `price`/`old_price` and `retail_*` are what the storefront shows a
     * guest: retail price, stock at the warehouse a guest's catalog resolves
     * (the default one), and `retail_stock` only when the catalog setting
     * allows exact quantities. `stock`/`in_stock` stay the all-warehouse
     * aggregate for the B2B portal.
     *
     * @return array{id: int, price: float|null, old_price: float|null, stock: float, in_stock: bool, retail_stock: float|null, retail_in_stock: bool}
     */
    public function broadcastWith(): array
    {
        $retail = clone $this->product;
        app(PublicProductPresenter::class)->enrich(
            $retail->newCollection([$retail]),
            app(StoreResolver::class)->resolve(null, null),
        );

        $retailPriceInKopecks = $retail->resolved_price;
        $retailStock = (float) $retail->resolved_stock;

        $oldPrice = null;
        if ($this->product->compare_at_price !== null && $this->product->compare_at_price > ($retailPriceInKopecks ?? 0)) {
            $oldPrice = $this->product->compare_at_price / 100;
        }

        return [
            'id' => $this->product->id,
            'price' => $retailPriceInKopecks !== null ? $retailPriceInKopecks / 100 : null,
            'old_price' => $oldPrice,
            'stock' => (float) $this->product->stock,
            'in_stock' => $this->product->stock > 0,
            'retail_stock' => $retail->show_stock_quantity ? $retailStock : null,
            'retail_in_stock' => $retailStock > 0,
        ];
    }
}
