<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\Store;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProductStoreStock>
 */
class ProductStoreStockFactory extends Factory
{
    protected $model = ProductStoreStock::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'store_id' => Store::factory(),
            'stock' => fake()->numberBetween(0, 50),
        ];
    }
}
