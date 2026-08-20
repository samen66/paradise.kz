<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $retail = fake()->numberBetween(50_000, 500_000); // kopecks

        return [
            'name' => fake()->words(3, true),
            'code' => (string) fake()->unique()->numerify('#####'),
            'article' => fake()->bothify('ART-####'),
            'description' => fake()->sentence(),
            'retail_price' => $retail,
            'b2b_price' => (int) round($retail * 0.8),
            'stock' => fake()->numberBetween(0, 50),
            'uom' => 'шт',
            'is_active' => true,
        ];
    }

    /**
     * Product with an ERP external mapping (simulates МойСклад sync).
     */
    public function erpSynced(?string $externalId = null): static
    {
        return $this->afterCreating(function (Product $product) use ($externalId): void {
            \App\Models\ProductExternalMapping::factory()->create(array_filter([
                'product_id' => $product->id,
                'external_id' => $externalId,
            ]));
        });
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => ['is_active' => false]);
    }

    public function outOfStock(): static
    {
        return $this->state(fn (array $attributes) => ['stock' => 0]);
    }

    /**
     * Attach mirrored product images to the media collection. Call
     * Storage::fake(config('media-library.disk_name')) in the test first.
     */
    public function withImage(int $count = 1): static
    {
        return $this->afterCreating(function (Product $product) use ($count): void {
            for ($i = 0; $i < $count; $i++) {
                $product->addMediaFromString(UploadedFile::fake()->image("image-{$i}.jpg")->getContent())
                    ->usingFileName("image-{$i}.jpg")
                    ->withCustomProperties(['moysklad_image_id' => (string) Str::uuid()])
                    ->toMediaCollection(Product::IMAGE_COLLECTION);
            }
        });
    }
}
