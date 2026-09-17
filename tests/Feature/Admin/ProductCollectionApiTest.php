<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Models\ProductCollection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ProductCollectionApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_collections(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/product-collections');
    }

    #[Test]
    public function it_creates_updates_and_deletes_a_translatable_collection(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/product-collections', [
            'title' => ['ru' => 'Хиты', 'kk' => 'Хиттер'],
            'slug' => 'hits',
            'sort_order' => 1,
            'is_active' => true,
        ])->assertCreated()->json('data.id');

        $collection = ProductCollection::findOrFail($id);
        $this->assertSame('Хиттер', $collection->getTranslation('title', 'kk'));

        $this->putJson("/api/admin/product-collections/{$id}", [
            'title' => ['ru' => 'Хиты продаж'],
            'slug' => 'hits',
            'is_active' => false,
        ])->assertOk();

        $this->assertFalse($collection->fresh()->is_active);
        $this->assertSame('Хиты продаж', $collection->fresh()->getTranslation('title', 'ru'));

        $this->deleteJson("/api/admin/product-collections/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('product_collections', ['id' => $id]);
    }

    #[Test]
    public function the_russian_title_and_a_unique_slug_are_required(): void
    {
        $this->actingAsManager();
        ProductCollection::factory()->create(['slug' => 'hits']);

        $this->postJson('/api/admin/product-collections', ['title' => ['kk' => 'Хиттер'], 'slug' => 'hits'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title.ru', 'slug']);
    }

    #[Test]
    public function products_are_added_reordered_and_removed(): void
    {
        $this->actingAsManager();
        $collection = ProductCollection::factory()->create();
        [$first, $second] = Product::factory()->count(2)->create();

        $this->putJson("/api/admin/product-collections/{$collection->id}/products/{$first->id}", ['sort_order' => 2])->assertNoContent();
        $this->putJson("/api/admin/product-collections/{$collection->id}/products/{$second->id}", ['sort_order' => 1])->assertNoContent();

        $this->getJson("/api/admin/product-collections/{$collection->id}")
            ->assertOk()
            ->assertJsonPath('data.products.0.id', $second->id)
            ->assertJsonPath('data.products.1.pivot.sort_order', 2);

        // Same endpoint again only moves it — no duplicate row.
        $this->putJson("/api/admin/product-collections/{$collection->id}/products/{$first->id}", ['sort_order' => 0])->assertNoContent();
        $this->assertSame(2, $collection->products()->count());
        $this->assertSame($first->id, $collection->products()->first()->id);

        $this->deleteJson("/api/admin/product-collections/{$collection->id}/products/{$first->id}")->assertNoContent();
        $this->assertSame(1, $collection->products()->count());
    }
}
