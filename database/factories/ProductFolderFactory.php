<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\ProductFolder;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ProductFolder>
 */
class ProductFolderFactory extends Factory
{
    protected $model = ProductFolder::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->randomElement(['Диваны', 'Столы', 'Стулья', 'Шкафы', 'Кровати']);

        return [
            'source' => 'erp',
            'external_id' => (string) Str::uuid(),
            'parent_external_id' => null,
            'name' => $name,
            'path_name' => $name,
        ];
    }
}
