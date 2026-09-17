<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ProductVariantApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_variants(): void
    {
        $product = Product::factory()->create();

        $this->assertStaffOnly('GET', "/api/admin/products/{$product->id}/variants");
    }

    #[Test]
    public function a_variant_is_created_locally_with_prices_in_tiyn(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();

        $response = $this->postJson("/api/admin/products/{$product->id}/variants", [
            'name' => 'Диван, серый',
            'code' => 'SOFA-GREY',
            'retail_price' => '150000',
            'b2b_price' => 120000.5,
            'barcodes' => ['4870000000011'],
            'characteristics' => ['Цвет' => 'Серый'],
        ])->assertCreated();

        $variant = ProductVariant::findOrFail($response->json('data.id'));

        $this->assertSame('local', $variant->source);
        $this->assertNotEmpty($variant->external_id);
        $this->assertSame(15_000_000, $variant->retail_price);
        $this->assertSame(12_000_050, $variant->b2b_price);
        $this->assertSame(['4870000000011'], $variant->barcodes);
        $this->assertSame(['Цвет' => 'Серый'], $variant->characteristics);

        $response->assertJsonMissingPath('data.external_id')
            ->assertJsonMissingPath('data.source')
            ->assertJsonMissingPath('data.synced_at');
    }

    #[Test]
    public function stock_and_erp_fields_are_not_accepted(): void
    {
        $this->actingAsManager();
        $variant = ProductVariant::factory()->create(['stock' => 3, 'external_id' => 'keep-me']);

        $this->putJson("/api/admin/products/{$variant->product_id}/variants/{$variant->id}", [
            'name' => 'Новое имя',
            'stock' => 999,
            'external_id' => 'changed',
            'source' => 'changed',
        ])->assertOk();

        $variant->refresh();
        $this->assertSame('Новое имя', $variant->name);
        $this->assertSame('3.000', $variant->stock);
        $this->assertSame('keep-me', $variant->external_id);
    }

    #[Test]
    public function a_variant_is_listed_and_deleted(): void
    {
        $this->actingAsManager();
        $variant = ProductVariant::factory()->create();

        $this->getJson("/api/admin/products/{$variant->product_id}/variants")->assertOk()->assertJsonCount(1, 'data');
        $this->deleteJson("/api/admin/products/{$variant->product_id}/variants/{$variant->id}")->assertNoContent();
        $this->assertDatabaseMissing('product_variants', ['id' => $variant->id]);
    }

    #[Test]
    public function another_products_variant_is_not_found(): void
    {
        $this->actingAsManager();
        $foreign = ProductVariant::factory()->create();
        $product = Product::factory()->create();

        $this->putJson("/api/admin/products/{$product->id}/variants/{$foreign->id}", ['name' => 'x'])->assertNotFound();
    }
}
