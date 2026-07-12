<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\CatalogSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CatalogSetting>
 */
class CatalogSettingFactory extends Factory
{
    protected $model = CatalogSetting::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'show_stock_quantity' => true,
        ];
    }

    public function hidingStockQuantity(): static
    {
        return $this->state(fn (array $attributes) => ['show_stock_quantity' => false]);
    }
}
