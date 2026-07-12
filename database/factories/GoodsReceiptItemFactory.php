<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GoodsReceiptItem>
 */
class GoodsReceiptItemFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'goods_receipt_id' => GoodsReceipt::factory(),
            'product_id' => Product::factory(),
            'quantity' => fake()->randomFloat(3, 1, 50),
            'unit_cost' => fake()->numberBetween(10_000, 500_000),
        ];
    }
}
