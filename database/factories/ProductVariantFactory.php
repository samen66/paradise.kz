<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ProductVariant>
 */
class ProductVariantFactory extends Factory
{
    protected $model = ProductVariant::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $retail = fake()->numberBetween(50_000, 500_000); // kopecks

        return [
            'product_id' => Product::factory(),
            'source' => 'moysklad',
            'external_id' => (string) Str::uuid(),
            'name' => fake()->words(3, true),
            'code' => (string) fake()->unique()->numerify('#####'),
            'retail_price' => $retail,
            'b2b_price' => (int) round($retail * 0.8),
            'stock' => fake()->numberBetween(0, 50),
            'barcodes' => [(string) fake()->ean13()],
            'characteristics' => ['Цвет' => fake()->safeColorName()],
            'synced_at' => now(),
        ];
    }
}
