<?php
// tests/Feature/Migrations/ProductExternalMappingsMigrationTest.php

declare(strict_types=1);

namespace Tests\Feature\Migrations;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProductExternalMappingsMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_external_mappings_table_exists(): void
    {
        $this->assertTrue(Schema::hasTable('product_external_mappings'));
    }

    public function test_product_external_mappings_has_expected_columns(): void
    {
        $columns = Schema::getColumnListing('product_external_mappings');

        $this->assertContains('id', $columns);
        $this->assertContains('product_id', $columns);
        $this->assertContains('source', $columns);
        $this->assertContains('external_id', $columns);
        $this->assertContains('external_folder_id', $columns);
        $this->assertContains('synced_at', $columns);
        $this->assertContains('barcodes', $columns);
        $this->assertContains('erp_attributes', $columns);
    }

    public function test_products_table_no_longer_has_erp_columns(): void
    {
        $columns = Schema::getColumnListing('products');

        $this->assertNotContains('source', $columns);
        $this->assertNotContains('external_id', $columns);
        $this->assertNotContains('external_folder_id', $columns);
        $this->assertNotContains('synced_at', $columns);
        $this->assertNotContains('barcodes', $columns);
        $this->assertNotContains('attributes', $columns);
    }

    public function test_products_table_retains_catalog_columns(): void
    {
        $columns = Schema::getColumnListing('products');

        $this->assertContains('name', $columns);
        $this->assertContains('slug', $columns);
        $this->assertContains('retail_price', $columns);
        $this->assertContains('b2b_price', $columns);
        $this->assertContains('is_active', $columns);
        $this->assertContains('category_id', $columns);
        $this->assertContains('brand_id', $columns);
    }
}
