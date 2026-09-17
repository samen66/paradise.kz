<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Product;
use App\Models\WriteOff;
use App\Models\WriteOffItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WriteOffItem>
 */
class WriteOffItemFactory extends Factory
{
    public function definition(): array
    {
        return [
            'write_off_id' => WriteOff::factory(),
            'product_id' => Product::factory(),
            'quantity' => fake()->randomFloat(3, 1, 5),
        ];
    }
}
