<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\CatalogGroup;
use App\Models\CatalogSetting;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CartValidateTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function valid_lines_come_back_with_current_prices_and_totals(): void
    {
        $store = Store::factory()->create(['is_default' => true]);
        $product = Product::factory()->create(['retail_price' => 250_000]); // 2500 ₸
        ProductStoreStock::factory()->for($product)->for($store)->create(['stock' => 10]);
        CatalogSetting::current()->update(['delivery_price' => 100_000, 'free_delivery_from' => null]);

        $response = $this->postJson('/api/public/cart/validate', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ])->assertOk();

        $response->assertJsonPath('data.items.0.available', true)
            ->assertJsonPath('data.items.0.price', 2500)
            ->assertJsonPath('data.subtotal', 5000)
            ->assertJsonPath('data.delivery_cost', 1000)
            ->assertJsonPath('data.total_with_delivery', 6000);
    }

    #[Test]
    public function delivery_is_free_above_the_threshold(): void
    {
        $store = Store::factory()->create(['is_default' => true]);
        $product = Product::factory()->create(['retail_price' => 1_000_000]); // 10 000 ₸
        ProductStoreStock::factory()->for($product)->for($store)->create(['stock' => 5]);
        CatalogSetting::current()->update(['delivery_price' => 100_000, 'free_delivery_from' => 500_000]);

        $this->postJson('/api/public/cart/validate', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])
            ->assertOk()
            ->assertJsonPath('data.delivery_cost', 0);
    }

    #[Test]
    public function problem_lines_are_flagged_without_failing_the_request(): void
    {
        $store = Store::factory()->create(['is_default' => true]);

        $outOfStock = Product::factory()->create();
        ProductStoreStock::factory()->for($outOfStock)->for($store)->create(['stock' => 1]);

        $restricted = Product::factory()->create();
        $restricted->catalogGroups()->attach(CatalogGroup::factory()->create());

        $response = $this->postJson('/api/public/cart/validate', [
            'items' => [
                ['product_id' => $outOfStock->id, 'quantity' => 5],
                ['product_id' => $restricted->id, 'quantity' => 1],
                ['product_id' => 999_999, 'quantity' => 1],
            ],
        ])->assertOk();

        $response->assertJsonPath('data.items.0.available', false)
            ->assertJsonPath('data.items.0.problem', 'insufficient_stock')
            ->assertJsonPath('data.items.1.available', false)
            ->assertJsonPath('data.items.1.problem', 'unavailable')
            ->assertJsonPath('data.items.2.available', false)
            ->assertJsonPath('data.items.2.problem', 'unavailable')
            // Unavailable lines never count towards the subtotal.
            ->assertJsonPath('data.subtotal', 0);
    }

    #[Test]
    public function an_empty_cart_is_a_validation_error(): void
    {
        $this->postJson('/api/public/cart/validate', ['items' => []])
            ->assertUnprocessable();
    }
}
