<?php

declare(strict_types=1);

namespace Tests\Feature\Orders;

use App\Contracts\Erp\OrderTarget;
use App\Jobs\Erp\PushOrderJob;
use App\Models\Order;
use App\Models\Store;
use App\Models\User;
use App\Services\MoySklad\Exceptions\MoySkladApiException;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PushOrderJobTest extends TestCase
{
    use RefreshDatabase;

    private const BASE = 'https://api.moysklad.ru/api/remap/1.2';

    private const ORG_HREF = self::BASE.'/entity/organization/org-1';

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
            'moysklad.organization_href' => self::ORG_HREF,
            'moysklad.vat_percent' => 12,
        ]);
    }

    private function service(): OrderTarget
    {
        return app(OrderTarget::class);
    }

    private function orderWithCounterparty(string $counterpartyId, int $price = 180_000): Order
    {
        $user = User::factory()->b2b()->approved()->create([
            'external_counterparty_id' => $counterpartyId,
        ]);

        $store = Store::factory()->create(['external_id' => 'store-1']);

        $order = Order::factory()->for($user)->create([
            'store_id' => $store->id,
            'status' => Order::STATUS_PENDING,
            'total' => $price * 2,
        ]);

        $order->items()->create([
            'product_id' => null,
            'external_product_id' => 'prod-1',
            'name' => 'Диван',
            'quantity' => 2,
            'price' => $price, // already kopecks
        ]);

        return $order->load(['items', 'store']);
    }

    #[Test]
    public function it_pushes_the_order_and_marks_it_synced(): void
    {
        Http::fake([
            self::BASE.'/entity/customerorder' => Http::response([
                'id' => 'mc-order-99',
                'name' => '00042',
                'sum' => 360000,
            ], 200),
        ]);

        $order = $this->orderWithCounterparty('cp-1', 180_000);

        (new PushOrderJob($order))->handle($this->service());

        $order->refresh();

        $this->assertSame(Order::STATUS_SYNCED, $order->status);
        $this->assertSame('mc-order-99', $order->external_order_id);
        $this->assertSame('00042', $order->external_number);
        $this->assertNotNull($order->pushed_at);
        $this->assertNull($order->error);
    }

    #[Test]
    public function the_posted_payload_carries_prices_in_kopecks_and_correct_meta(): void
    {
        Http::fake([
            self::BASE.'/entity/customerorder' => Http::response([
                'id' => 'mc-1',
                'name' => '00001',
            ], 200),
        ]);

        $order = $this->orderWithCounterparty('cp-77', 180_000);

        (new PushOrderJob($order))->handle($this->service());

        Http::assertSent(function (Request $request) use ($order): bool {
            if ($request->url() !== self::BASE.'/entity/customerorder' || $request->method() !== 'POST') {
                return false;
            }

            $body = $request->data();

            // Price must equal the snapshot (180000 kopecks), NOT multiplied again.
            $this->assertSame(180_000, $body['positions'][0]['price']);
            $this->assertSame(12, $body['positions'][0]['vat']);
            $this->assertEqualsWithDelta(2.0, $body['positions'][0]['quantity'], 0.001);

            // assortment / agent / organization / store meta.
            $this->assertSame(
                self::BASE.'/entity/product/prod-1',
                $body['positions'][0]['assortment']['meta']['href'],
            );
            $this->assertSame(
                self::BASE.'/entity/counterparty/cp-77',
                $body['agent']['meta']['href'],
            );
            $this->assertSame('counterparty', $body['agent']['meta']['type']);
            $this->assertSame(self::ORG_HREF, $body['organization']['meta']['href']);
            $this->assertSame(
                self::BASE.'/entity/store/'.$order->store->external_id,
                $body['store']['meta']['href'],
            );
            $this->assertSame('store', $body['store']['meta']['type']);
            $this->assertSame("Заказ #{$order->id} (paradise.kz)", $body['description']);

            return true;
        });
    }

    #[Test]
    public function a_client_without_counterparty_fails_without_any_http_call(): void
    {
        Http::fake();

        $user = User::factory()->b2b()->approved()->create(['external_counterparty_id' => null]);
        $order = Order::factory()->for($user)->create(['status' => Order::STATUS_PENDING]);
        $order->items()->create([
            'product_id' => null,
            'external_product_id' => 'prod-1',
            'name' => 'Диван',
            'quantity' => 1,
            'price' => 100_000,
        ]);

        (new PushOrderJob($order))->handle($this->service());

        $order->refresh();

        $this->assertSame(Order::STATUS_FAILED, $order->status);
        $this->assertSame('client is not linked to an ERP counterparty', $order->error);
        $this->assertNull($order->external_order_id);

        Http::assertNothingSent();
    }

    #[Test]
    public function an_api_error_marks_the_order_failed_and_rethrows_for_retry(): void
    {
        Http::fake([
            self::BASE.'/entity/customerorder' => Http::response([
                'errors' => [['error' => 'Field organization is required']],
            ], 412),
        ]);

        $order = $this->orderWithCounterparty('cp-err', 150_000);

        try {
            (new PushOrderJob($order))->handle($this->service());
            $this->fail('Expected MoySkladApiException to be rethrown for retry.');
        } catch (MoySkladApiException $e) {
            $this->assertSame('Field organization is required', $e->getMessage());
        }

        $order->refresh();

        $this->assertSame(Order::STATUS_FAILED, $order->status);
        $this->assertSame('Field organization is required', $order->error);
    }
}
