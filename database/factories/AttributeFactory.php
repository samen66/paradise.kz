<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Attribute;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Attribute>
 */
class AttributeFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->word();

        return [
            'name' => ['ru' => $name],
            'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(1, 100_000),
            'is_filterable' => false,
        ];
    }

    public function filterable(): static
    {
        return $this->state(fn (array $attributes): array => ['is_filterable' => true]);
    }
}
