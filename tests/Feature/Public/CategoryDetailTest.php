<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\Category;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CategoryDetailTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_returns_the_category_with_children_and_breadcrumb(): void
    {
        $root = Category::factory()->create(['name' => 'Мебель', 'slug' => 'mebel']);
        $mid = Category::factory()->create(['name' => 'Диваны', 'slug' => 'divany', 'parent_id' => $root->id]);
        Category::factory()->create(['name' => 'Угловые', 'slug' => 'uglovye', 'parent_id' => $mid->id]);
        Category::factory()->inactive()->create(['parent_id' => $mid->id]);

        $response = $this->getJson('/api/public/categories/divany')->assertOk();

        $response->assertJsonPath('data.slug', 'divany');
        $this->assertSame(['uglovye'], collect($response->json('data.children'))->pluck('slug')->all());
        $this->assertSame(['mebel', 'divany'], collect($response->json('data.breadcrumb'))->pluck('slug')->all());
    }

    #[Test]
    public function an_inactive_category_is_a_404(): void
    {
        Category::factory()->inactive()->create(['slug' => 'hidden']);

        $this->getJson('/api/public/categories/hidden')->assertNotFound();
    }
}
