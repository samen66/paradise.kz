<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Banner;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Banner>
 */
class BannerFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'placement' => Banner::PLACEMENT_HOME_HERO,
            'title' => fake()->sentence(3),
            'subtitle' => fake()->sentence(6),
            'url' => '/catalog',
            'sort_order' => 0,
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes): array => ['is_active' => false]);
    }

    public function b2bHome(): static
    {
        return $this->state(fn (array $attributes): array => ['placement' => Banner::PLACEMENT_B2B_HOME]);
    }
}
