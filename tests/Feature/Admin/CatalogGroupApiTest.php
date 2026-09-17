<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\CatalogGroup;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class CatalogGroupApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_catalog_groups(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/catalog-groups');
    }

    #[Test]
    public function it_lists_groups_with_member_counts(): void
    {
        $this->actingAsManager();
        $group = CatalogGroup::factory()->create(['name' => 'Дилеры']);
        $group->products()->attach(Product::factory()->count(2)->create());

        $this->getJson('/api/admin/catalog-groups')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Дилеры')
            ->assertJsonPath('data.0.products_count', 2)
            ->assertJsonPath('data.0.users_count', 0);
    }

    #[Test]
    public function it_creates_renames_and_deletes_a_group(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/catalog-groups', ['name' => 'Дилеры'])->assertCreated()->json('data.id');
        $this->putJson("/api/admin/catalog-groups/{$id}", ['name' => 'Крупные дилеры'])
            ->assertOk()->assertJsonPath('data.name', 'Крупные дилеры');

        $this->postJson('/api/admin/catalog-groups', ['name' => ''])->assertUnprocessable()->assertJsonValidationErrors('name');

        $this->deleteJson("/api/admin/catalog-groups/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('catalog_groups', ['id' => $id]);
    }

    #[Test]
    public function products_are_attached_and_detached_idempotently(): void
    {
        $this->actingAsManager();
        $group = CatalogGroup::factory()->create();
        $product = Product::factory()->create();

        $this->postJson("/api/admin/catalog-groups/{$group->id}/products/{$product->id}")->assertNoContent();
        $this->postJson("/api/admin/catalog-groups/{$group->id}/products/{$product->id}")->assertNoContent();
        $this->assertSame(1, $group->products()->count());

        $this->getJson("/api/admin/catalog-groups/{$group->id}")
            ->assertOk()
            ->assertJsonPath('data.products.0.id', $product->id);

        $this->deleteJson("/api/admin/catalog-groups/{$group->id}/products/{$product->id}")->assertNoContent();
        $this->assertSame(0, $group->products()->count());
    }

    #[Test]
    public function only_b2b_clients_can_join_a_group(): void
    {
        $this->actingAsManager();
        $group = CatalogGroup::factory()->create();
        $client = User::factory()->b2b()->approved()->create();
        $retail = User::factory()->retail()->create();

        $this->postJson("/api/admin/catalog-groups/{$group->id}/users/{$client->id}")->assertNoContent();
        $this->postJson("/api/admin/catalog-groups/{$group->id}/users/{$retail->id}")->assertUnprocessable();

        $this->getJson("/api/admin/catalog-groups/{$group->id}")
            ->assertJsonCount(1, 'data.users')
            ->assertJsonPath('data.users.0.id', $client->id);

        $this->deleteJson("/api/admin/catalog-groups/{$group->id}/users/{$client->id}")->assertNoContent();
        $this->assertSame(0, $group->users()->count());
    }
}
