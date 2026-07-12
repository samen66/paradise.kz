<?php

declare(strict_types=1);

namespace Tests\Feature\MoySklad;

use App\Jobs\Catalog\DeactivateProductJob;
use App\Jobs\Catalog\SyncSingleProductJob;
use App\Jobs\Catalog\SyncStockJob;
use App\Jobs\Catalog\SyncStoresJob;
use App\Jobs\Erp\SyncOrderStatusJob;
use Illuminate\Support\Facades\Bus;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class WebhookTest extends TestCase
{
    private const SECRET = 'super-secret';

    private const BASE = 'https://api.moysklad.ru/api/remap/1.2';

    protected function setUp(): void
    {
        parent::setUp();

        config(['moysklad.webhook_secret' => self::SECRET]);
        Bus::fake();
    }

    /**
     * @param  list<array{type: string, id: string, action?: string}>  $events
     * @return array<string, mixed>
     */
    private function entityPayload(array $events): array
    {
        return [
            'events' => array_map(fn (array $event): array => [
                'meta' => [
                    'type' => $event['type'],
                    'href' => self::BASE.'/entity/'.$event['type'].'/'.$event['id'],
                ],
                'action' => $event['action'] ?? 'UPDATE',
            ], $events),
        ];
    }

    #[Test]
    public function product_update_dispatches_a_targeted_single_product_sync(): void
    {
        $this->postJson('/api/moysklad/webhook?secret='.self::SECRET, $this->entityPayload([
            ['type' => 'product', 'id' => 'prod-1', 'action' => 'UPDATE'],
        ]))->assertNoContent();

        Bus::assertDispatched(SyncSingleProductJob::class, fn (SyncSingleProductJob $job): bool => $this->jobId($job) === 'prod-1');
        Bus::assertNotDispatched(DeactivateProductJob::class);
    }

    #[Test]
    public function product_delete_dispatches_a_deactivate_job(): void
    {
        $this->postJson('/api/moysklad/webhook?secret='.self::SECRET, $this->entityPayload([
            ['type' => 'product', 'id' => 'prod-9', 'action' => 'DELETE'],
        ]))->assertNoContent();

        Bus::assertDispatched(DeactivateProductJob::class, fn (DeactivateProductJob $job): bool => $this->jobId($job) === 'prod-9');
        Bus::assertNotDispatched(SyncSingleProductJob::class);
    }

    #[Test]
    public function stock_webhook_dispatches_stock_sync_with_changed_since_from_report_url(): void
    {
        $this->postJson('/api/moysklad/webhook?secret='.self::SECRET, [
            'stockType' => 'stock',
            'reportType' => 'bystore',
            'reportUrl' => self::BASE.'/report/stock/bystore/current?changedSince=2026-06-30 12:00:00',
        ])->assertNoContent();

        Bus::assertDispatched(SyncStockJob::class, fn (SyncStockJob $job): bool => $this->jobChangedSince($job) === '2026-06-30 12:00:00');
    }

    #[Test]
    public function store_change_dispatches_a_stores_re_sync(): void
    {
        $this->postJson('/api/moysklad/webhook?secret='.self::SECRET, $this->entityPayload([
            ['type' => 'store', 'id' => 'store-7', 'action' => 'CREATE'],
        ]))->assertNoContent();

        Bus::assertDispatched(SyncStoresJob::class);
    }

    #[Test]
    public function customerorder_update_dispatches_a_targeted_order_status_sync(): void
    {
        $this->postJson('/api/moysklad/webhook?secret='.self::SECRET, $this->entityPayload([
            ['type' => 'customerorder', 'id' => 'order-5', 'action' => 'UPDATE'],
        ]))->assertNoContent();

        Bus::assertDispatched(
            SyncOrderStatusJob::class,
            fn (SyncOrderStatusJob $job): bool => (new \ReflectionProperty($job, 'externalOrderId'))->getValue($job) === 'order-5',
        );
    }

    #[Test]
    public function duplicate_request_id_is_processed_only_once(): void
    {
        $url = '/api/moysklad/webhook?secret='.self::SECRET.'&requestId=req-123';
        $payload = $this->entityPayload([['type' => 'product', 'id' => 'prod-1']]);

        $this->postJson($url, $payload)->assertNoContent();
        $this->postJson($url, $payload)->assertNoContent();

        Bus::assertDispatchedTimes(SyncSingleProductJob::class, 1);
    }

    #[Test]
    public function secret_may_be_supplied_via_header(): void
    {
        $this->postJson(
            '/api/moysklad/webhook',
            $this->entityPayload([['type' => 'product', 'id' => 'prod-1']]),
            ['X-Webhook-Secret' => self::SECRET],
        )->assertNoContent();

        Bus::assertDispatched(SyncSingleProductJob::class);
    }

    #[Test]
    public function wrong_secret_is_rejected_with_401(): void
    {
        $this->postJson('/api/moysklad/webhook?secret=wrong', $this->entityPayload([
            ['type' => 'product', 'id' => 'prod-1'],
        ]))->assertStatus(401);

        Bus::assertNothingDispatched();
    }

    #[Test]
    public function malformed_payload_still_returns_204(): void
    {
        $this->postJson('/api/moysklad/webhook?secret='.self::SECRET, ['garbage' => true])
            ->assertNoContent();

        Bus::assertNothingDispatched();
    }

    #[Test]
    public function unknown_entity_types_are_ignored(): void
    {
        $this->postJson('/api/moysklad/webhook?secret='.self::SECRET, $this->entityPayload([
            ['type' => 'counterparty', 'id' => 'cp-1'],
        ]))->assertNoContent();

        Bus::assertNothingDispatched();
    }

    #[Test]
    public function check_is_skipped_when_no_secret_is_configured(): void
    {
        config(['moysklad.webhook_secret' => null]);

        $this->postJson('/api/moysklad/webhook', $this->entityPayload([
            ['type' => 'product', 'id' => 'prod-1'],
        ]))->assertNoContent();

        Bus::assertDispatched(SyncSingleProductJob::class);
    }

    private function jobId(SyncSingleProductJob|DeactivateProductJob $job): string
    {
        return (new \ReflectionProperty($job, 'externalId'))->getValue($job);
    }

    private function jobChangedSince(SyncStockJob $job): ?string
    {
        return (new \ReflectionProperty($job, 'changedSince'))->getValue($job);
    }
}
