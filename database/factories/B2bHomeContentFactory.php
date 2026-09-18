<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\B2bHomeContent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<B2bHomeContent>
 */
class B2bHomeContentFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'about_title' => ['ru' => 'Paradise — мебель со склада в Алматы'],
            'about_text' => ['ru' => fake()->paragraph()],
        ];
    }
}
