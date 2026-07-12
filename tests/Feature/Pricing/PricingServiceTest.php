<?php

declare(strict_types=1);

namespace Tests\Feature\Pricing;

use App\Models\ClientProductPrice;
use App\Models\PriceType;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\User;
use App\Services\Pricing\PricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PricingServiceTest extends TestCase
{
    use RefreshDatabase;

    private PricingService $pricing;

    protected function setUp(): void
    {
        parent::setUp();
        $this->pricing = new PricingService;
    }

    #[Test]
    public function it_uses_the_b2b_base_price_with_no_discount(): void
    {
        $user = User::factory()->b2b()->approved()->create(['discount_percent' => 0]);
        $product = Product::factory()->create(['b2b_price' => 180_000, 'retail_price' => 250_000]);

        $this->assertSame(180_000, $this->pricing->priceFor($user, $product));
    }

    #[Test]
    public function it_applies_the_client_discount_percent(): void
    {
        $user = User::factory()->b2b()->approved()->create(['discount_percent' => 10]);
        $product = Product::factory()->create(['b2b_price' => 200_000]);

        $this->assertSame(180_000, $this->pricing->priceFor($user, $product));
    }

    #[Test]
    public function an_explicit_override_wins_over_the_discounted_price(): void
    {
        $user = User::factory()->b2b()->approved()->create(['discount_percent' => 50]);
        $product = Product::factory()->create(['b2b_price' => 200_000]);
        ClientProductPrice::factory()->create([
            'user_id' => $user->id,
            'product_id' => $product->id,
            'price' => 123_456,
        ]);

        $this->assertSame(123_456, $this->pricing->priceFor($user, $product));
    }

    #[Test]
    public function it_falls_back_to_retail_when_no_b2b_price_exists(): void
    {
        $user = User::factory()->b2b()->approved()->create(['discount_percent' => 0]);
        $product = Product::factory()->create(['b2b_price' => null, 'retail_price' => 99_000]);

        $this->assertSame(99_000, $this->pricing->priceFor($user, $product));
    }

    #[Test]
    public function it_resolves_many_products_with_overrides(): void
    {
        $user = User::factory()->b2b()->approved()->create(['discount_percent' => 10]);
        $a = Product::factory()->create(['b2b_price' => 100_000]);
        $b = Product::factory()->create(['b2b_price' => 200_000]);
        ClientProductPrice::factory()->create(['user_id' => $user->id, 'product_id' => $b->id, 'price' => 50_000]);

        $prices = $this->pricing->priceForMany($user, [$a, $b]);

        $this->assertSame(90_000, $prices[$a->id]);   // discounted
        $this->assertSame(50_000, $prices[$b->id]);    // override
    }

    #[Test]
    public function a_local_b2b_price_type_wins_over_the_legacy_b2b_price_column(): void
    {
        $user = User::factory()->b2b()->approved()->create(['discount_percent' => 0]);
        $b2bType = PriceType::factory()->b2b()->create();
        $product = Product::factory()->create(['b2b_price' => 180_000]);
        ProductPrice::factory()->create([
            'product_id' => $product->id,
            'price_type_id' => $b2bType->id,
            'price' => 150_000,
        ]);

        $this->assertSame(150_000, $this->pricing->priceFor($user, $product));
    }

    #[Test]
    public function a_local_retail_price_type_is_used_when_no_local_or_legacy_b2b_price_exists(): void
    {
        $user = User::factory()->b2b()->approved()->create(['discount_percent' => 0]);
        $retailType = PriceType::factory()->retail()->create();
        $product = Product::factory()->create(['b2b_price' => null, 'retail_price' => null]);
        ProductPrice::factory()->create([
            'product_id' => $product->id,
            'price_type_id' => $retailType->id,
            'price' => 75_000,
        ]);

        $this->assertSame(75_000, $this->pricing->priceFor($user, $product));
    }

    #[Test]
    public function it_still_falls_back_to_legacy_columns_when_no_local_prices_exist_for_the_product(): void
    {
        // A product with local price types configured for OTHER products, but
        // none for this one, must still resolve from the legacy columns.
        PriceType::factory()->b2b()->create();
        $user = User::factory()->b2b()->approved()->create(['discount_percent' => 0]);
        $product = Product::factory()->create(['b2b_price' => 210_000]);

        $this->assertSame(210_000, $this->pricing->priceFor($user, $product));
    }

    #[Test]
    public function retail_price_for_ignores_the_b2b_tier_entirely(): void
    {
        $b2bType = PriceType::factory()->b2b()->create();
        $product = Product::factory()->create(['retail_price' => 250_000]);
        ProductPrice::factory()->create([
            'product_id' => $product->id,
            'price_type_id' => $b2bType->id,
            'price' => 40_000, // must never leak into the retail/guest price
        ]);

        $this->assertSame(250_000, $this->pricing->retailPriceFor($product));
    }

    #[Test]
    public function retail_price_for_uses_the_local_retail_price_type_over_the_legacy_column(): void
    {
        $retailType = PriceType::factory()->retail()->create();
        $product = Product::factory()->create(['retail_price' => 250_000]);
        ProductPrice::factory()->create([
            'product_id' => $product->id,
            'price_type_id' => $retailType->id,
            'price' => 199_000,
        ]);

        $this->assertSame(199_000, $this->pricing->retailPriceFor($product));
    }

    #[Test]
    public function retail_price_for_many_resolves_without_a_user(): void
    {
        $a = Product::factory()->create(['retail_price' => 100_000]);
        $b = Product::factory()->create(['retail_price' => null]);

        $prices = $this->pricing->retailPriceForMany([$a, $b]);

        $this->assertSame(100_000, $prices[$a->id]);
        $this->assertNull($prices[$b->id]);
    }
}
