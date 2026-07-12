<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\CatalogGroup;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ProductSlugTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function a_slug_is_generated_from_the_russian_name_on_create(): void
    {
        $product = Product::factory()->create(['name' => 'Диван Атланта']);

        $this->assertSame('divan-atlanta-'.$product->id, $product->fresh()->slug);
    }

    #[Test]
    public function the_slug_stays_stable_when_the_name_changes(): void
    {
        $product = Product::factory()->create(['name' => 'Диван Атланта']);
        $slug = $product->fresh()->slug;

        $product->update(['name' => 'Совсем другое имя']);

        $this->assertSame($slug, $product->fresh()->slug);
    }

    #[Test]
    public function product_detail_is_addressable_by_slug_and_by_id(): void
    {
        $product = Product::factory()->create(['name' => 'Диван Атланта']);
        $slug = $product->fresh()->slug;

        $this->getJson('/api/public/products/'.$slug)
            ->assertOk()
            ->assertJsonPath('data.id', $product->id)
            ->assertJsonPath('data.slug', $slug);

        $this->getJson('/api/public/products/'.$product->id)
            ->assertOk()
            ->assertJsonPath('data.id', $product->id);
    }

    #[Test]
    public function a_restricted_product_is_a_404_by_slug_as_well(): void
    {
        $product = Product::factory()->create(['name' => 'Оптовый диван']);
        $product->catalogGroups()->attach(CatalogGroup::factory()->create());

        $this->getJson('/api/public/products/'.$product->fresh()->slug)
            ->assertNotFound();
    }

    #[Test]
    public function the_backfill_command_fills_missing_slugs(): void
    {
        $product = Product::factory()->create(['name' => 'Диван Атланта']);
        // Simulate a row inserted by the sync's bulk upsert (bypasses events).
        Product::query()->whereKey($product->id)->update(['slug' => null]);

        Artisan::call('catalog:generate-product-slugs');

        $this->assertSame('divan-atlanta-'.$product->id, $product->fresh()->slug);
    }
}
