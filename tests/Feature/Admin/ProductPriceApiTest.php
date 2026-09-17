<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\PriceType;
use App\Models\Product;
use App\Models\ProductPrice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ProductPriceApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_prices(): void
    {
        $product = Product::factory()->create();

        $this->assertStaffOnly('GET', "/api/admin/products/{$product->id}/prices");
    }

    #[Test]
    public function a_price_is_sent_in_tenge_and_stored_in_tiyn(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $type = PriceType::factory()->create();

        $id = $this->postJson("/api/admin/products/{$product->id}/prices", [
            'price_type_id' => $type->id,
            'price' => '1500.50',
        ])->assertCreated()->assertJsonPath('data.price_type.id', $type->id)->json('data.id');

        $this->assertSame(150_050, ProductPrice::findOrFail($id)->price);

        $this->putJson("/api/admin/products/{$product->id}/prices/{$id}", [
            'price_type_id' => $type->id,
            'price' => 2000,
        ])->assertOk();

        $this->assertSame(200_000, ProductPrice::findOrFail($id)->price);

        $this->getJson("/api/admin/products/{$product->id}/prices")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.price', 200_000);

        $this->deleteJson("/api/admin/products/{$product->id}/prices/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('product_prices', ['id' => $id]);
    }

    #[Test]
    public function one_price_per_type_per_product(): void
    {
        $this->actingAsManager();
        $existing = ProductPrice::factory()->create();

        $this->postJson("/api/admin/products/{$existing->product_id}/prices", [
            'price_type_id' => $existing->price_type_id,
            'price' => 100,
        ])->assertUnprocessable()->assertJsonValidationErrors('price_type_id');

        // The same row may keep its own type on update.
        $this->putJson("/api/admin/products/{$existing->product_id}/prices/{$existing->id}", [
            'price_type_id' => $existing->price_type_id,
            'price' => 100,
        ])->assertOk();
    }

    #[Test]
    public function a_price_must_be_non_negative_with_two_decimals_at_most(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $type = PriceType::factory()->create();

        $this->postJson("/api/admin/products/{$product->id}/prices", ['price_type_id' => $type->id, 'price' => -1])
            ->assertUnprocessable()->assertJsonValidationErrors('price');
        $this->postJson("/api/admin/products/{$product->id}/prices", ['price_type_id' => $type->id, 'price' => '1.005'])
            ->assertUnprocessable()->assertJsonValidationErrors('price');
    }

    #[Test]
    public function another_products_price_is_not_found(): void
    {
        $this->actingAsManager();
        $foreign = ProductPrice::factory()->create();
        $product = Product::factory()->create();

        $this->deleteJson("/api/admin/products/{$product->id}/prices/{$foreign->id}")->assertNotFound();
        $this->assertDatabaseHas('product_prices', ['id' => $foreign->id]);
    }
}
