<?php

declare(strict_types=1);

namespace Tests\Feature\Account;

use App\Models\CatalogGroup;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FavoritesTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function a_product_can_be_added_listed_and_removed(): void
    {
        $user = User::factory()->retail()->create();
        $product = Product::factory()->create(['retail_price' => 150_000]);

        $this->actingAs($user, 'sanctum');

        $this->putJson('/api/account/favorites/'.$product->id)->assertCreated();
        // Adding twice stays idempotent.
        $this->putJson('/api/account/favorites/'.$product->id)->assertCreated();

        $response = $this->getJson('/api/account/favorites')->assertOk()->assertJsonCount(1, 'data');
        $this->assertSame($product->id, $response->json('data.0.id'));
        $this->assertEqualsWithDelta(1500.0, $response->json('data.0.price'), 0.001);

        $this->deleteJson('/api/account/favorites/'.$product->id)->assertNoContent();
        $this->getJson('/api/account/favorites')->assertOk()->assertJsonCount(0, 'data');
    }

    #[Test]
    public function products_that_left_the_public_catalog_drop_out_of_the_list(): void
    {
        $user = User::factory()->retail()->create();
        $product = Product::factory()->create();

        $this->actingAs($user, 'sanctum');
        $this->putJson('/api/account/favorites/'.$product->id)->assertCreated();

        $product->catalogGroups()->attach(CatalogGroup::factory()->create());

        $this->getJson('/api/account/favorites')->assertOk()->assertJsonCount(0, 'data');
    }

    #[Test]
    public function favorites_are_per_user(): void
    {
        $product = Product::factory()->create();
        $owner = User::factory()->retail()->create();
        $other = User::factory()->retail()->create();

        $this->actingAs($owner, 'sanctum')->putJson('/api/account/favorites/'.$product->id)->assertCreated();

        $this->actingAs($other, 'sanctum')->getJson('/api/account/favorites')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }
}
