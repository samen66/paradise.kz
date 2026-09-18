<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\ProductCollection;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ProductCollection>
 */
class ProductCollectionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $title = fake()->unique()->words(2, true);

        return [
            'title' => $title,
            'slug' => Str::slug($title),
            'sort_order' => 0,
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes): array => ['is_active' => false]);
    }

    public function onB2bHome(): static
    {
        return $this->state(fn (array $attributes): array => ['show_on_b2b_home' => true]);
    }
}
