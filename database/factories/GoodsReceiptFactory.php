<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\GoodsReceipt;
use App\Models\Store;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GoodsReceipt>
 */
class GoodsReceiptFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'supplier_id' => Supplier::factory(),
            'store_id' => Store::factory(),
            'number' => null,
            'status' => GoodsReceipt::STATUS_DRAFT,
            'received_at' => now(),
            'note' => null,
            'user_id' => null,
            'posted_at' => null,
        ];
    }

    public function posted(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => GoodsReceipt::STATUS_POSTED,
            'posted_at' => now(),
        ]);
    }
}
