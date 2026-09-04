<?php

declare(strict_types=1);

namespace Tests\Feature\MoySklad;

use App\Contracts\Erp\OrderTarget;
use App\Jobs\Erp\SyncOrderStatusJob;
use App\Models\Order;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SyncOrderStatusJobTest extends TestCase
{
    use RefreshDatabase;

    private const BASE = 'https://api.moysklad.ru/api/remap/1.2';

    protected function setUp(): void
    {
        parent::setUp();

        // The app now runs on the `local` provider by default (config/erp.php);
        // this suite covers the legacy MoySklad integration, so it opts back in
        // explicitly. Delete this file together with app/Services/MoySklad (D4).
        config(['erp.provider' => 'moysklad']);
        $this->seed(RolesAndPermissionsSeeder::class);

        config([
            'moysklad.base_url' => self::BASE,
            'moysklad.token' => 'test-token',
        ]);
    }

    private function service(): OrderTarget
    {
        return app(OrderTarget::class);
    }

    private function orderWithMoyskladId(string $moyskladOrderId): Order
    {
        $user = User::factory()->b2b()->approved()->create();

        return Order::factory()->for($user)->create([
            'external_order_id' => $moyskladOrderId,
            'external_state' => null,
        ]);
    }

    #[Test]
    public function it_mirrors_the_external_state_name_onto_the_order(): void
    {
        Http::fake([
            self::BASE.'/entity/customerorder/mc-1*' => Http::response([
                'id' => 'mc-1',
                'state' => ['name' => 'Подтверждён'],
            ], 200),
        ]);

        $order = $this->orderWithMoyskladId('mc-1');

        (new SyncOrderStatusJob('mc-1'))->handle($this->service());

        $this->assertSame('Подтверждён', $order->refresh()->external_state);
    }

    #[Test]
    public function an_unknown_order_id_makes_no_api_call(): void
    {
        Http::fake();

        (new SyncOrderStatusJob('not-ours'))->handle($this->service());

        Http::assertNothingSent();
    }

    #[Test]
    public function a_missing_state_leaves_the_order_untouched(): void
    {
        Http::fake([
            self::BASE.'/entity/customerorder/mc-2*' => Http::response(['id' => 'mc-2'], 200),
        ]);

        $order = $this->orderWithMoyskladId('mc-2');

        (new SyncOrderStatusJob('mc-2'))->handle($this->service());

        $this->assertNull($order->refresh()->external_state);
    }
}
