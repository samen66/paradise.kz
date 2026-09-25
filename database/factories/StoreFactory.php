<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Store;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Store>
 */
class StoreFactory extends Factory
{
    protected $model = Store::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'source' => 'erp',
            'external_id' => (string) Str::uuid(),
            'name' => fake()->city(),
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => ['is_active' => false]);
    }

    /** A filled-in retail point published on the storefront. */
    public function showroom(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => Store::TYPE_RETAIL_POINT,
            'slug' => Str::slug(fake()->unique()->words(3, true)),
            'show_on_site' => true,
            'city' => 'Алматы',
            'address' => 'пр. Аль-Фараби, 77/8',
            'landmark' => ['ru' => 'ТРЦ Esentai Mall, 3 этаж'],
            'phone' => '+7 (727) 355-11-05',
            'whatsapp' => '77001112233',
            'lat' => 43.2205,
            'lng' => 76.928,
            'weekly_hours' => array_fill(0, 7, ['open' => '10:00', 'close' => '21:00']),
            'services' => ['pickup', 'consult'],
        ]);
    }
}
