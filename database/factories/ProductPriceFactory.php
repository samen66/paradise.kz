<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\PriceType;
use App\Models\Product;
use App\Models\ProductPrice;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProductPrice>
 */
class ProductPriceFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'price_type_id' => PriceType::factory(),
            'price' => fake()->numberBetween(10_000, 500_000),
        ];
    }
}
