<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Store;
use App\Models\WriteOff;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WriteOff>
 */
class WriteOffFactory extends Factory
{
    public function definition(): array
    {
        return [
            'store_id' => Store::factory(),
            'reason' => 'damaged',
            'note' => null,
            'status' => WriteOff::STATUS_DRAFT,
            'posted_at' => null,
            'user_id' => null,
        ];
    }

    public function posted(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => WriteOff::STATUS_POSTED,
            'posted_at' => now(),
        ]);
    }
}
