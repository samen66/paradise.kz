<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\PriceType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PriceType>
 */
class PriceTypeFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $code = fake()->unique()->word();

        return [
            'code' => $code,
            'name' => ucfirst($code),
            'sort_order' => 0,
        ];
    }

    public function retail(): static
    {
        return $this->state(fn (array $attributes): array => ['code' => 'retail', 'name' => 'Розничная']);
    }

    public function b2b(): static
    {
        return $this->state(fn (array $attributes): array => ['code' => 'b2b', 'name' => 'Оптовая (B2B)']);
    }
}
