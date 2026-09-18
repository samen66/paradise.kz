<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Models\ProductCollection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
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
        $this->assertSame(1, $collection->fresh()->sort_order);

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

    #[Test]
    public function it_saves_the_description_and_where_the_collection_shows(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/product-collections', [
            'title' => ['ru' => 'Лофт'],
            'slug' => 'loft',
            'description' => ['ru' => 'Металл и дерево', 'kk' => 'Металл мен ағаш'],
            'is_active' => true,
            'show_on_storefront' => false,
            'show_on_b2b_home' => true,
        ])->assertCreated()->json('data.id');

        $collection = ProductCollection::findOrFail($id);
        $this->assertSame('Металл мен ағаш', $collection->getTranslation('description', 'kk'));
        $this->assertFalse($collection->show_on_storefront);
        $this->assertTrue($collection->show_on_b2b_home);

        $this->getJson("/api/admin/product-collections/{$id}")
            ->assertOk()
            ->assertJsonPath('data.show_on_b2b_home', true)
            ->assertJsonPath('data.cover_url', null);
    }

    #[Test]
    public function a_cover_is_uploaded_and_removed(): void
    {
        Storage::fake(config('media-library.disk_name'));
        $this->actingAsManager();
        $collection = ProductCollection::factory()->create();

        $this->post("/api/admin/product-collections/{$collection->id}/cover", ['file' => UploadedFile::fake()->image('loft.jpg', 1920, 1080)], ['Accept' => 'application/json'])
            ->assertOk();
        $this->assertNotNull($this->getJson("/api/admin/product-collections/{$collection->id}")->json('data.cover_url'));

        $this->deleteJson("/api/admin/product-collections/{$collection->id}/cover")->assertOk()->assertJsonPath('data.cover_url', null);
    }

    #[Test]
    public function clearing_one_locale_of_the_description_removes_only_that_translation(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/product-collections', [
            'title' => ['ru' => 'Лофт'],
            'slug' => 'loft',
            'description' => ['ru' => 'Металл и дерево', 'kk' => 'Металл мен ағаш'],
        ])->assertCreated()->json('data.id');

        $this->putJson("/api/admin/product-collections/{$id}", [
            'title' => ['ru' => 'Лофт'],
            'slug' => 'loft',
            'description' => ['ru' => 'Металл и дерево', 'kk' => ''],
        ])->assertOk();

        $this->assertSame(['ru' => 'Металл и дерево'], ProductCollection::findOrFail($id)->getTranslations('description'));
    }

    #[Test]
    public function a_put_without_the_description_keeps_it(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/product-collections', [
            'title' => ['ru' => 'Лофт'],
            'slug' => 'loft',
            'description' => ['ru' => 'Металл и дерево', 'kk' => 'Металл мен ағаш'],
        ])->assertCreated()->json('data.id');

        $this->putJson("/api/admin/product-collections/{$id}", [
            'title' => ['ru' => 'Лофт'],
            'slug' => 'loft',
        ])->assertOk();

        $this->assertSame(
            ['ru' => 'Металл и дерево', 'kk' => 'Металл мен ағаш'],
            ProductCollection::findOrFail($id)->getTranslations('description'),
        );
    }
}
