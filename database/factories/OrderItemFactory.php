<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<OrderItem>
 */
class OrderItemFactory extends Factory
{
    protected $model = OrderItem::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'product_id' => Product::factory(),
            'external_product_id' => (string) Str::uuid(),
            'name' => fake()->words(3, true),
            'quantity' => fake()->numberBetween(1, 10),
            'price' => fake()->numberBetween(40_000, 400_000), // kopecks
        ];
    }
}
