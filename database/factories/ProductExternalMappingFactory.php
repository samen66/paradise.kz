<?php

// database/factories/ProductExternalMappingFactory.php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Product;
use App\Models\ProductExternalMapping;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ProductExternalMapping>
 */
class ProductExternalMappingFactory extends Factory
{
    protected $model = ProductExternalMapping::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'source' => 'erp',
            'external_id' => (string) Str::uuid(),
            'external_folder_id' => null,
            'synced_at' => now(),
            'barcodes' => [],
            'erp_attributes' => [],
        ];
    }
}
