<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    protected $model = Order::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'status' => Order::STATUS_PENDING,
            'total' => fake()->numberBetween(50_000, 1_000_000), // kopecks
            'comment' => null,
            'external_order_id' => null,
            'external_number' => null,
            'error' => null,
            'pushed_at' => null,
        ];
    }

    public function synced(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => Order::STATUS_SYNCED,
            'external_order_id' => (string) fake()->uuid(),
            'external_number' => (string) fake()->numerify('#####'),
            'pushed_at' => now(),
        ]);
    }

    public function failed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => Order::STATUS_FAILED,
            'error' => 'push rejected',
        ]);
    }
}
