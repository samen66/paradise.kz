<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Address;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Address>
 */
class AddressFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'city' => fake()->city(),
            'street' => fake()->streetName(),
            'building' => (string) fake()->buildingNumber(),
            'apartment' => (string) fake()->numberBetween(1, 200),
            'comment' => null,
            'is_default' => false,
        ];
    }

    public function default(): static
    {
        return $this->state(fn (array $attributes): array => ['is_default' => true]);
    }
}
