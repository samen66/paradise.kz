<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Jobs\RevalidateStorefrontCacheJob;
use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ShowroomApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        Queue::fake();
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Paradise Есентай',
            'slug' => 'esentai',
            'address' => 'пр. Аль-Фараби, 77/8',
            'city' => 'Алматы',
            'show_on_site' => true,
            'landmark' => ['ru' => 'ТРЦ Esentai Mall', 'kk' => ''],
            'parking' => ['ru' => 'Паркинг ТРЦ', 'kk' => 'СОО паркингі'],
            'description' => ['ru' => '', 'kk' => ''],
            'phone' => '+7 (727) 355-11-05',
            'whatsapp' => '77273551105',
            'lat' => 43.2205,
            'lng' => 76.928,
            'weekly_hours' => [
                ['open' => '10:00', 'close' => '22:00'], ['open' => '10:00', 'close' => '22:00'],
                ['open' => '10:00', 'close' => '22:00'], ['open' => '10:00', 'close' => '22:00'],
                ['open' => '10:00', 'close' => '22:00'], ['open' => '11:00', 'close' => '20:00'], null,
            ],
            'services' => ['consult', 'card', 'cafe'],
            'area' => '540 м²',
            'floors' => '1 этаж',
            'is_flagship' => true,
            'sort_order' => 3,
        ], $overrides);
    }

    #[Test]
    public function only_staff_may_manage_showrooms(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/showrooms');
    }

    #[Test]
    public function the_list_holds_only_retail_points(): void
    {
        $this->actingAsManager();
        $showroom = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT, 'name' => 'Шоурум']);
        Store::factory()->create(['type' => 'warehouse', 'name' => 'Склад']);

        $this->getJson('/api/admin/showrooms')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $showroom->id)
            ->assertJsonPath('data.0.cover_url', null);
    }

    #[Test]
    public function creating_makes_an_unpublished_active_retail_point(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/showrooms', ['name' => 'Paradise Mega', 'address' => 'Розыбакиева, 247а', 'show_on_site' => true])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'paradise-mega')
            ->assertJsonPath('data.show_on_site', false)
            ->json('data.id');

        $store = Store::findOrFail($id);
        $this->assertSame(Store::TYPE_RETAIL_POINT, $store->type);
        $this->assertTrue($store->is_active);
        $this->assertFalse($store->is_default);
    }

    #[Test]
    public function a_generated_slug_gets_a_suffix_on_collision(): void
    {
        $this->actingAsManager();
        Store::factory()->create(['slug' => 'paradise-mega']);

        $this->postJson('/api/admin/showrooms', ['name' => 'Paradise Mega'])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'paradise-mega-2');
    }

    #[Test]
    public function a_legacy_retail_point_opens_with_empty_hours_and_services(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT]);
        $product = Product::factory()->create();
        ProductStoreStock::factory()->for($product)->for($store)->create(['stock' => 3]);
        ProductStoreStock::factory()->for(Product::factory())->for($store)->create(['stock' => 0]);

        $this->getJson("/api/admin/showrooms/{$store->id}")
            ->assertOk()
            ->assertJsonPath('data.weekly_hours', [null, null, null, null, null, null, null])
            ->assertJsonPath('data.services', [])
            ->assertJsonPath('data.landmark', ['ru' => '', 'kk' => ''])
            ->assertJsonPath('data.products_in_stock', 1)
            ->assertJsonPath('data.public_url', null);
    }

    #[Test]
    public function a_warehouse_is_not_a_showroom(): void
    {
        $this->actingAsManager();
        $warehouse = Store::factory()->create(['type' => 'warehouse']);

        $this->getJson("/api/admin/showrooms/{$warehouse->id}")->assertNotFound();
        $this->putJson("/api/admin/showrooms/{$warehouse->id}", $this->payload())->assertNotFound();
    }

    #[Test]
    public function the_card_is_updated_and_the_storefront_purged(): void
    {
        $this->actingAsManager();
        config(['services.storefront.url' => 'https://shop.paradise.kz']);
        $store = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT, 'slug' => 'old-slug']);

        $this->putJson("/api/admin/showrooms/{$store->id}", $this->payload())
            ->assertOk()
            ->assertJsonPath('data.slug', 'esentai')
            ->assertJsonPath('data.landmark', ['ru' => 'ТРЦ Esentai Mall', 'kk' => ''])
            ->assertJsonPath('data.parking.kk', 'СОО паркингі')
            ->assertJsonPath('data.weekly_hours.5', ['open' => '11:00', 'close' => '20:00'])
            ->assertJsonPath('data.weekly_hours.6', null)
            ->assertJsonPath('data.lat', 43.2205)
            ->assertJsonPath('data.public_url', 'https://shop.paradise.kz/showrooms/esentai');

        $store->refresh();
        $this->assertSame(['consult', 'card', 'cafe'], $store->services);
        $this->assertTrue($store->is_flagship);
        $this->assertSame(3, $store->sort_order);

        Queue::assertPushed(
            RevalidateStorefrontCacheJob::class,
            fn (RevalidateStorefrontCacheJob $job): bool => (fn () => $this->tags)->call($job) === ['showrooms', 'showroom:esentai', 'showroom:old-slug'],
        );
    }

    #[Test]
    public function accounting_fields_are_not_changed_here(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT, 'is_active' => true, 'is_default' => false, 'code' => 'SR1']);

        $this->putJson("/api/admin/showrooms/{$store->id}", $this->payload([
            'is_active' => false, 'is_default' => true, 'type' => 'warehouse', 'code' => 'HACK',
        ]))->assertOk();

        $store->refresh();
        $this->assertTrue($store->is_active);
        $this->assertFalse($store->is_default);
        $this->assertSame(Store::TYPE_RETAIL_POINT, $store->type);
        $this->assertSame('SR1', $store->code);
    }

    #[Test]
    public function publishing_uses_the_saved_slug_when_none_is_sent(): void
    {
        $this->actingAsManager();
        $withSlug = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT, 'slug' => 'kept']);
        $withoutSlug = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT, 'slug' => null]);

        $this->putJson("/api/admin/showrooms/{$withSlug->id}", ['name' => 'X', 'show_on_site' => true])->assertOk();
        $this->assertTrue($withSlug->fresh()->show_on_site);

        $this->putJson("/api/admin/showrooms/{$withoutSlug->id}", ['name' => 'X', 'show_on_site' => true])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('show_on_site');
    }

    /**
     * @return array<string, array{array<string, mixed>, string}>
     */
    public static function invalidPayloads(): array
    {
        return [
            'slug with capitals' => [['slug' => 'Esentai'], 'slug'],
            'whatsapp with plus' => [['whatsapp' => '+77001112233'], 'whatsapp'],
            'lat without lng' => [['lng' => null], 'lng'],
            'lat out of range' => [['lat' => 91], 'lat'],
            'six days' => [['weekly_hours' => array_fill(0, 6, null)], 'weekly_hours'],
            'bad time' => [['weekly_hours' => [['open' => '9', 'close' => '21:00'], null, null, null, null, null, null]], 'weekly_hours.0'],
            'closes before opening' => [['weekly_hours' => [['open' => '21:00', 'close' => '10:00'], null, null, null, null, null, null]], 'weekly_hours.0'],
            'unknown service' => [['services' => ['spa']], 'services.0'],
            'duplicate service' => [['services' => ['cafe', 'cafe']], 'services.0'],
            'no name' => [['name' => ''], 'name'],
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    #[Test]
    #[DataProvider('invalidPayloads')]
    public function invalid_cards_are_rejected(array $overrides, string $field): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT]);

        $this->putJson("/api/admin/showrooms/{$store->id}", $this->payload($overrides))
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);
    }

    #[Test]
    public function a_slug_must_be_unique_among_stores(): void
    {
        $this->actingAsManager();
        Store::factory()->create(['slug' => 'esentai']);
        $store = Store::factory()->create(['type' => Store::TYPE_RETAIL_POINT]);

        $this->putJson("/api/admin/showrooms/{$store->id}", $this->payload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('slug');
    }
}
