<?php
// tests/Unit/Models/ProductExternalMappingTest.php

declare(strict_types=1);

namespace Tests\Unit\Models;

use App\Models\Product;
use App\Models\ProductExternalMapping;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductExternalMappingTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_has_external_mapping_relationship(): void
    {
        $product = Product::factory()->create();
        $mapping = ProductExternalMapping::factory()->create(['product_id' => $product->id]);

        $this->assertTrue($product->externalMapping->is($mapping));
    }

    public function test_mapping_belongs_to_product(): void
    {
        $product = Product::factory()->create();
        $mapping = ProductExternalMapping::factory()->create(['product_id' => $product->id]);

        $this->assertTrue($mapping->product->is($product));
    }

    public function test_is_erp_synced_returns_true_when_mapping_exists(): void
    {
        $product = Product::factory()->create();
        ProductExternalMapping::factory()->create(['product_id' => $product->id]);

        $this->assertTrue($product->fresh()->isErpSynced());
    }

    public function test_is_erp_synced_returns_false_when_no_mapping(): void
    {
        $product = Product::factory()->create();

        $this->assertFalse($product->isErpSynced());
    }

    public function test_product_can_be_created_without_erp_fields(): void
    {
        $product = Product::factory()->create();

        $this->assertDatabaseHas('products', ['id' => $product->id]);
        $this->assertFalse($product->isErpSynced());
    }

    public function test_erp_attributes_and_barcodes_are_cast_to_array(): void
    {
        $product = Product::factory()->create();
        $mapping = ProductExternalMapping::factory()->create([
            'product_id' => $product->id,
            'barcodes' => ['123456789', '987654321'],
            'erp_attributes' => ['Цвет' => 'красный'],
        ]);

        $fresh = $mapping->fresh();
        $this->assertIsArray($fresh->barcodes);
        $this->assertIsArray($fresh->erp_attributes);
        $this->assertEquals(['123456789', '987654321'], $fresh->barcodes);
        $this->assertEquals(['Цвет' => 'красный'], $fresh->erp_attributes);
    }

    public function test_cascade_delete_removes_mapping(): void
    {
        $product = Product::factory()->create();
        ProductExternalMapping::factory()->create(['product_id' => $product->id]);

        $product->delete();

        $this->assertDatabaseMissing('product_external_mappings', ['product_id' => $product->id]);
    }
}
