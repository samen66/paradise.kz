<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Attribute;
use App\Models\ProductVariant;
use App\Models\ProductVariantAttributeValue;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProductVariantAttributeValue>
 */
class ProductVariantAttributeValueFactory extends Factory
{
    protected $model = ProductVariantAttributeValue::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'product_variant_id' => ProductVariant::factory(),
            'attribute_id' => Attribute::factory(),
            'value' => ['ru' => fake()->word()],
        ];
    }
}
