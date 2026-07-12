<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\CatalogSetting;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_exposes_delivery_pricing_in_tenge_and_contacts(): void
    {
        CatalogSetting::current()->update([
            'delivery_price' => 150_000,      // 1500 ₸ in kopecks
            'free_delivery_from' => 1_000_000, // 10 000 ₸
            'contact_phone' => '+7 700 000 00 00',
            'whatsapp_url' => 'https://wa.me/77000000000',
        ]);

        $response = $this->getJson('/api/public/settings')->assertOk();

        $this->assertEqualsWithDelta(1500.0, $response->json('data.delivery_price'), 0.001);
        $this->assertEqualsWithDelta(10000.0, $response->json('data.free_delivery_from'), 0.001);
        $response->assertJsonPath('data.contacts.phone', '+7 700 000 00 00')
            ->assertJsonPath('data.contacts.whatsapp_url', 'https://wa.me/77000000000');
    }

    #[Test]
    public function it_lists_active_stores_with_the_default_first(): void
    {
        Store::factory()->create(['name' => 'А-склад', 'is_default' => false]);
        $default = Store::factory()->create(['name' => 'Я-склад', 'is_default' => true]);
        Store::factory()->create(['name' => 'Закрытый', 'is_active' => false]);

        $response = $this->getJson('/api/public/settings')->assertOk();

        $stores = collect($response->json('data.stores'));
        $this->assertSame($default->id, $stores->first()['id']);
        $this->assertNotContains('Закрытый', $stores->pluck('name'));
    }
}
