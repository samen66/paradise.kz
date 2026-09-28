<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StoreShowroomFieldsTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function showroom_fields_are_cast_and_translated(): void
    {
        $store = Store::factory()->create([
            'type' => Store::TYPE_RETAIL_POINT,
            'weekly_hours' => [['open' => '10:00', 'close' => '21:00'], null, null, null, null, null, null],
            'services' => ['pickup', 'cafe'],
            'lat' => 43.2735,
            'lng' => 76.943,
            'landmark' => ['ru' => 'У метро', 'kk' => 'Метро жанында'],
        ])->fresh();

        $this->assertSame('10:00', $store->weekly_hours[0]['open']);
        $this->assertNull($store->weekly_hours[1]);
        $this->assertSame(['pickup', 'cafe'], $store->services);
        $this->assertSame(43.2735, $store->lat);
        $this->assertSame('Метро жанында', $store->getTranslation('landmark', 'kk'));
        $this->assertFalse($store->show_on_site);
        $this->assertFalse($store->is_flagship);
        $this->assertSame(0, $store->sort_order);
    }

    #[Test]
    public function only_active_published_retail_points_with_a_slug_are_showrooms(): void
    {
        $published = Store::factory()->showroom()->create(['name' => 'Б', 'sort_order' => 1]);
        $first = Store::factory()->showroom()->create(['name' => 'А', 'sort_order' => 1]);
        $top = Store::factory()->showroom()->create(['name' => 'Я', 'sort_order' => 0]);
        Store::factory()->showroom()->create(['type' => 'warehouse']);
        Store::factory()->showroom()->create(['is_active' => false]);
        Store::factory()->showroom()->create(['show_on_site' => false]);
        Store::factory()->showroom()->create(['slug' => null]);

        $this->assertSame(
            [$top->id, $first->id, $published->id],
            Store::query()->publishedShowrooms()->pluck('id')->all(),
        );
        $this->assertTrue($published->isPublishedShowroom());
        $this->assertFalse(Store::factory()->showroom()->create(['show_on_site' => false])->isPublishedShowroom());
    }

    #[Test]
    public function cache_tags_cover_the_list_and_both_slugs(): void
    {
        $store = Store::factory()->showroom()->create(['slug' => 'esentai']);

        $this->assertSame(['showrooms', 'showroom:esentai'], $store->storefrontCacheTags());
        $this->assertSame(['showrooms', 'showroom:esentai', 'showroom:old'], $store->storefrontCacheTags('old'));
        $this->assertSame(['showrooms', 'showroom:esentai'], $store->storefrontCacheTags('esentai'));
    }
}
