<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\ClientProductPrice;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ClientProductPrice>
 */
class ClientProductPriceFactory extends Factory
{
    protected $model = ClientProductPrice::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'product_id' => Product::factory(),
            'price' => fake()->numberBetween(40_000, 400_000), // kopecks
        ];
    }
}
