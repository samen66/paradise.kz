<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ProductVariantTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_groups_variants_in_catalog(): void
    {
        $parent = Product::factory()->create();
        $variant1 = \App\Models\ProductVariant::factory()->create([
            'product_id' => $parent->id,
            'name' => 'Variant 1',
        ]);
        $variant2 = \App\Models\ProductVariant::factory()->create([
            'product_id' => $parent->id,
            'name' => 'Variant 2',
        ]);

        // When we fetch the parent, variants should be grouped
        $this->getJson("/api/public/products/{$parent->id}")
            ->assertOk()
            ->assertJsonPath('data.variants.0.id', $variant1->id)
            ->assertJsonPath('data.variants.1.id', $variant2->id);
    }
}
