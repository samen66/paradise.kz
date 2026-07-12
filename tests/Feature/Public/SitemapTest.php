<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\CatalogGroup;
use App\Models\Category;
use App\Models\Page;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SitemapTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_lists_public_products_categories_and_pages(): void
    {
        $product = Product::factory()->create(['name' => 'Диван']);
        Category::factory()->create(['slug' => 'divany']);
        Page::factory()->create(['slug' => 'about']);

        $entries = collect($this->getJson('/api/public/sitemap')->assertOk()->json('data'));

        $this->assertTrue($entries->contains(fn (array $entry): bool => $entry['type'] === 'product' && $entry['slug'] === $product->fresh()->slug));
        $this->assertTrue($entries->contains(fn (array $entry): bool => $entry['type'] === 'category' && $entry['slug'] === 'divany'));
        $this->assertTrue($entries->contains(fn (array $entry): bool => $entry['type'] === 'page' && $entry['slug'] === 'about'));
    }

    #[Test]
    public function hidden_content_never_appears(): void
    {
        $restricted = Product::factory()->create();
        $restricted->catalogGroups()->attach(CatalogGroup::factory()->create());
        $inactiveProduct = Product::factory()->inactive()->create();
        Category::factory()->inactive()->create(['slug' => 'hidden-cat']);
        Page::factory()->inactive()->create(['slug' => 'hidden-page']);

        $entries = collect($this->getJson('/api/public/sitemap')->assertOk()->json('data'));

        $this->assertFalse($entries->contains(fn (array $entry): bool => in_array($entry['slug'], [
            $restricted->fresh()->slug,
            $inactiveProduct->fresh()->slug,
            'hidden-cat',
            'hidden-page',
        ], true)));
    }
}
