<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\Page;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PagesTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function an_active_page_is_returned_by_slug(): void
    {
        Page::factory()->create([
            'slug' => 'delivery',
            'title' => 'Доставка и оплата',
            'body' => '<p>Условия доставки</p>',
        ]);

        $this->getJson('/api/public/pages/delivery')
            ->assertOk()
            ->assertJsonPath('data.title', 'Доставка и оплата')
            ->assertJsonPath('data.body', '<p>Условия доставки</p>');
    }

    #[Test]
    public function pages_are_localized(): void
    {
        $page = Page::factory()->create(['slug' => 'about', 'title' => 'О нас']);
        $page->setTranslation('title', 'kk', 'Біз туралы');
        $page->save();

        $this->getJson('/api/public/pages/about?locale=kk')
            ->assertOk()
            ->assertJsonPath('data.title', 'Біз туралы');
    }

    #[Test]
    public function an_inactive_page_is_a_404(): void
    {
        Page::factory()->inactive()->create(['slug' => 'draft']);

        $this->getJson('/api/public/pages/draft')->assertNotFound();
    }

    #[Test]
    public function the_index_lists_only_active_pages(): void
    {
        Page::factory()->create(['slug' => 'about']);
        Page::factory()->inactive()->create(['slug' => 'draft']);

        $response = $this->getJson('/api/public/pages')->assertOk();

        $this->assertSame(['about'], collect($response->json('data'))->pluck('slug')->all());
    }
}
