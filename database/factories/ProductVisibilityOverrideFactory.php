<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Product;
use App\Models\ProductVisibilityOverride;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProductVisibilityOverride>
 */
class ProductVisibilityOverrideFactory extends Factory
{
    protected $model = ProductVisibilityOverride::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'product_id' => Product::factory(),
            'mode' => fake()->randomElement([
                ProductVisibilityOverride::MODE_ALLOW,
                ProductVisibilityOverride::MODE_HIDE,
            ]),
        ];
    }

    public function allow(): static
    {
        return $this->state(fn (array $attributes) => ['mode' => ProductVisibilityOverride::MODE_ALLOW]);
    }

    public function hide(): static
    {
        return $this->state(fn (array $attributes) => ['mode' => ProductVisibilityOverride::MODE_HIDE]);
    }
}
