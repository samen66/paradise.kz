<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Security regression: retail (storefront) accounts are auto-approved, so the
 * `approved` gate alone would let their tokens read wholesale prices. The
 * `b2b` middleware must block them from every B2B endpoint.
 */
class RetailCannotAccessB2bTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function a_retail_token_is_forbidden_from_b2b_catalog_and_orders(): void
    {
        $retail = User::factory()->retail()->create();

        $this->actingAs($retail, 'sanctum');

        $this->getJson('/api/products')->assertForbidden();
        $this->getJson('/api/categories')->assertForbidden();
        $this->getJson('/api/orders')->assertForbidden();
        $this->getJson('/api/addresses')->assertForbidden();
    }

    #[Test]
    public function a_guest_checkout_user_token_is_forbidden_as_well(): void
    {
        $guest = User::factory()->guest()->create();

        $this->actingAs($guest, 'sanctum');

        $this->getJson('/api/products')->assertForbidden();
    }

    #[Test]
    public function an_approved_b2b_client_still_has_access(): void
    {
        $b2b = User::factory()->b2b()->approved()->create();

        $this->actingAs($b2b, 'sanctum');

        $this->getJson('/api/products')->assertOk();
    }

    #[Test]
    public function a_retail_token_can_still_use_the_account_area(): void
    {
        $retail = User::factory()->retail()->create();

        $this->actingAs($retail, 'sanctum');

        $this->getJson('/api/account/me')->assertOk();
        $this->getJson('/api/account/orders')->assertOk();
        $this->getJson('/api/account/addresses')->assertOk();
    }
}
