<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\CatalogGroup;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CatalogGroup>
 */
class CatalogGroupFactory extends Factory
{
    protected $model = CatalogGroup::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
        ];
    }
}
