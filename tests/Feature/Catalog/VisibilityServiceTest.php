<?php

declare(strict_types=1);

namespace Tests\Feature\Catalog;

use App\Models\CatalogGroup;
use App\Models\Product;
use App\Models\ProductVisibilityOverride;
use App\Models\User;
use App\Services\Catalog\VisibilityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class VisibilityServiceTest extends TestCase
{
    use RefreshDatabase;

    private VisibilityService $visibility;

    protected function setUp(): void
    {
        parent::setUp();
        $this->visibility = new VisibilityService;
    }

    #[Test]
    public function an_ungrouped_active_product_is_visible_to_everyone(): void
    {
        $user = User::factory()->b2b()->approved()->create();
        $product = Product::factory()->create();

        $this->assertVisible($user, $product);
    }

    #[Test]
    public function an_inactive_product_is_hidden_from_everyone(): void
    {
        $user = User::factory()->b2b()->approved()->create();
        $product = Product::factory()->inactive()->create();

        $this->assertHidden($user, $product);
    }

    #[Test]
    public function a_grouped_product_is_hidden_from_non_members_but_visible_to_members(): void
    {
        $member = User::factory()->b2b()->approved()->create();
        $stranger = User::factory()->b2b()->approved()->create();

        $group = CatalogGroup::factory()->create();
        $group->users()->attach($member);

        $product = Product::factory()->create();
        $product->catalogGroups()->attach($group);

        $this->assertVisible($member, $product);
        $this->assertHidden($stranger, $product);
    }

    #[Test]
    public function a_hide_override_removes_an_otherwise_visible_product(): void
    {
        $user = User::factory()->b2b()->approved()->create();
        $product = Product::factory()->create();

        ProductVisibilityOverride::factory()->hide()->create([
            'user_id' => $user->id,
            'product_id' => $product->id,
        ]);

        $this->assertHidden($user, $product);
    }

    #[Test]
    public function an_allow_override_grants_an_otherwise_restricted_product(): void
    {
        $user = User::factory()->b2b()->approved()->create();

        $group = CatalogGroup::factory()->create();
        $product = Product::factory()->create();
        $product->catalogGroups()->attach($group); // restricted; user is not a member

        $this->assertHidden($user, $product);

        ProductVisibilityOverride::factory()->allow()->create([
            'user_id' => $user->id,
            'product_id' => $product->id,
        ]);

        $this->assertVisible($user, $product);
    }

    #[Test]
    public function a_hide_override_beats_an_allow_grant_path(): void
    {
        // Even an ungrouped (otherwise-open) product must disappear when hidden.
        $user = User::factory()->b2b()->approved()->create();
        $product = Product::factory()->create();

        ProductVisibilityOverride::factory()->hide()->create([
            'user_id' => $user->id,
            'product_id' => $product->id,
        ]);

        $this->assertHidden($user, $product);
    }

    #[Test]
    public function can_see_agrees_with_visible_product_query(): void
    {
        $user = User::factory()->b2b()->approved()->create();

        $open = Product::factory()->create();
        $inactive = Product::factory()->inactive()->create();

        $restricted = Product::factory()->create();
        $restricted->catalogGroups()->attach(CatalogGroup::factory()->create());

        $hidden = Product::factory()->create();
        ProductVisibilityOverride::factory()->hide()->create([
            'user_id' => $user->id,
            'product_id' => $hidden->id,
        ]);

        $visibleIds = $this->visibility->visibleProductQuery($user)->pluck('id')->all();

        foreach ([$open, $inactive, $restricted, $hidden] as $product) {
            $this->assertSame(
                in_array($product->id, $visibleIds, true),
                $this->visibility->canSee($user, $product),
                "canSee disagrees with the query for product {$product->id}",
            );
        }
    }

    #[Test]
    public function public_query_includes_only_active_ungrouped_products(): void
    {
        $open = Product::factory()->create();
        $inactive = Product::factory()->inactive()->create();
        $restricted = Product::factory()->create();
        $restricted->catalogGroups()->attach(CatalogGroup::factory()->create());

        $ids = $this->visibility->publicProductQuery()->pluck('id')->all();

        $this->assertContains($open->id, $ids);
        $this->assertNotContains($inactive->id, $ids);
        $this->assertNotContains($restricted->id, $ids);
    }

    #[Test]
    public function can_see_publicly_agrees_with_the_public_query(): void
    {
        $open = Product::factory()->create();
        $restricted = Product::factory()->create();
        $restricted->catalogGroups()->attach(CatalogGroup::factory()->create());

        $this->assertTrue($this->visibility->canSeePublicly($open));
        $this->assertFalse($this->visibility->canSeePublicly($restricted));
    }

    private function assertVisible(User $user, Product $product): void
    {
        $this->assertTrue($this->visibility->canSee($user, $product));
        $this->assertContains(
            $product->id,
            $this->visibility->visibleProductQuery($user)->pluck('id')->all(),
        );
    }

    private function assertHidden(User $user, Product $product): void
    {
        $this->assertFalse($this->visibility->canSee($user, $product));
        $this->assertNotContains(
            $product->id,
            $this->visibility->visibleProductQuery($user)->pluck('id')->all(),
        );
    }
}
