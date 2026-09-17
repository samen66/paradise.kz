<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\ClientProductPrice;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ClientProductPriceApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_client_prices(): void
    {
        $product = Product::factory()->create();

        $this->assertStaffOnly('GET', "/api/admin/products/{$product->id}/client-prices");
    }

    #[Test]
    public function a_client_price_round_trips_in_tenge(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $client = User::factory()->b2b()->approved()->create();

        $id = $this->postJson("/api/admin/products/{$product->id}/client-prices", [
            'user_id' => $client->id,
            'price' => 990,
        ])->assertCreated()->assertJsonPath('data.user.id', $client->id)->json('data.id');

        $this->assertSame(99_000, ClientProductPrice::findOrFail($id)->price);

        $this->putJson("/api/admin/products/{$product->id}/client-prices/{$id}", [
            'user_id' => $client->id,
            'price' => '950.25',
        ])->assertOk();

        $this->assertSame(95_025, ClientProductPrice::findOrFail($id)->price);

        $this->getJson("/api/admin/products/{$product->id}/client-prices")->assertOk()->assertJsonCount(1, 'data');

        $this->deleteJson("/api/admin/products/{$product->id}/client-prices/{$id}")->assertNoContent();
    }

    #[Test]
    public function only_a_b2b_client_gets_a_personal_price(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $retail = User::factory()->retail()->create();

        $this->postJson("/api/admin/products/{$product->id}/client-prices", ['user_id' => $retail->id, 'price' => 1])
            ->assertUnprocessable()->assertJsonValidationErrors('user_id');
    }

    #[Test]
    public function one_personal_price_per_client_per_product(): void
    {
        $this->actingAsManager();
        $client = User::factory()->b2b()->approved()->create();
        $existing = ClientProductPrice::factory()->create(['user_id' => $client->id]);

        $this->postJson("/api/admin/products/{$existing->product_id}/client-prices", ['user_id' => $client->id, 'price' => 1])
            ->assertUnprocessable()->assertJsonValidationErrors('user_id');
    }

    #[Test]
    public function another_products_client_price_is_not_found(): void
    {
        $this->actingAsManager();
        $foreign = ClientProductPrice::factory()->create();
        $product = Product::factory()->create();

        $this->deleteJson("/api/admin/products/{$product->id}/client-prices/{$foreign->id}")->assertNotFound();
    }
}
