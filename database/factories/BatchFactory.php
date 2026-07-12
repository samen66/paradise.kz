<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Batch;
use App\Models\Product;
use App\Models\Store;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Batch>
 */
class BatchFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $quantity = fake()->randomFloat(3, 1, 100);

        return [
            'product_id' => Product::factory(),
            'store_id' => Store::factory(),
            'unit_cost' => fake()->numberBetween(10_000, 500_000),
            'qty_in' => $quantity,
            'qty_left' => $quantity,
            'received_at' => now(),
            'expires_at' => null,
            'note' => null,
        ];
    }

    public function depleted(): static
    {
        return $this->state(fn (array $attributes): array => ['qty_left' => 0]);
    }
}
