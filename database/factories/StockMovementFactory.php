<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Store;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockMovement>
 */
class StockMovementFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'store_id' => Store::factory(),
            'product_id' => Product::factory(),
            'batch_id' => null,
            'qty_delta' => fake()->randomFloat(3, 1, 50),
            'type' => StockMovement::TYPE_RECEIPT,
            'unit_cost' => fake()->numberBetween(10_000, 500_000),
            'balance_after' => null,
            'user_id' => null,
            'note' => null,
        ];
    }
}
