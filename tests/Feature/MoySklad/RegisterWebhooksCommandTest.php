<?php

declare(strict_types=1);

namespace Tests\Feature\MoySklad;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RegisterWebhooksCommandTest extends TestCase
{
    private const BASE = 'https://api.moysklad.ru/api/remap/1.2';

    private const CALLBACK = 'https://paradise.kz/api/moysklad/webhook';

    protected function setUp(): void
    {
        parent::setUp();

        // The app now runs on the `local` provider by default (config/erp.php);
        // this suite covers the legacy MoySklad integration, so it opts back in
        // explicitly. Delete this file together with app/Services/MoySklad (D4).
        config(['erp.provider' => 'moysklad']);

        config([
            'moysklad.token' => 'test-token',
            'moysklad.webhook_secret' => 'shh',
            'moysklad.webhooks.callback_url' => self::CALLBACK,
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $entityRows
     * @param  list<array<string, mixed>>  $stockRows
     */
    private function fakeWith(array $entityRows = [], array $stockRows = []): void
    {
        // webhookstock is matched first so it doesn't fall through to webhook*.
        Http::fake([
            self::BASE.'/entity/webhookstock*' => fn (Request $request) => $request->method() === 'GET'
                ? Http::response(['rows' => $stockRows, 'meta' => ['size' => count($stockRows)]])
                : Http::response(['id' => 'stock-new']),
            self::BASE.'/entity/webhook*' => fn (Request $request) => $request->method() === 'GET'
                ? Http::response(['rows' => $entityRows, 'meta' => ['size' => count($entityRows)]])
                : Http::response(['id' => 'wh-new']),
        ]);
    }

    #[Test]
    public function it_creates_missing_entity_and_stock_webhooks(): void
    {
        $this->fakeWith();

        $this->artisan('moysklad:webhooks')->assertSuccessful();

        foreach (['CREATE', 'UPDATE', 'DELETE'] as $action) {
            Http::assertSent(fn (Request $r): bool => $r->method() === 'POST'
                && $r->url() === self::BASE.'/entity/webhook'
                && ($r->data()['entityType'] ?? null) === 'product'
                && ($r->data()['action'] ?? null) === $action);
        }

        // UPDATE asks for changed-field details.
        Http::assertSent(fn (Request $r): bool => ($r->data()['action'] ?? null) === 'UPDATE'
            && ($r->data()['diffType'] ?? null) === 'FIELDS');

        // Stock webhook created on its own endpoint with the configured report type.
        Http::assertSent(fn (Request $r): bool => $r->method() === 'POST'
            && $r->url() === self::BASE.'/entity/webhookstock'
            && ($r->data()['reportType'] ?? null) === 'bystore');

        // Callback URL carries the secret.
        Http::assertSent(fn (Request $r): bool => $r->method() === 'POST'
            && str_contains((string) ($r->data()['url'] ?? ''), 'secret=shh'));
    }

    #[Test]
    public function it_is_idempotent_when_webhooks_already_exist(): void
    {
        $this->fakeWith(
            entityRows: [
                ['id' => 'a', 'url' => self::CALLBACK.'?secret=shh', 'entityType' => 'product', 'action' => 'CREATE'],
                ['id' => 'b', 'url' => self::CALLBACK.'?secret=shh', 'entityType' => 'product', 'action' => 'UPDATE'],
                ['id' => 'c', 'url' => self::CALLBACK.'?secret=shh', 'entityType' => 'product', 'action' => 'DELETE'],
                ['id' => 'd', 'url' => self::CALLBACK.'?secret=shh', 'entityType' => 'store', 'action' => 'CREATE'],
                ['id' => 'e', 'url' => self::CALLBACK.'?secret=shh', 'entityType' => 'store', 'action' => 'UPDATE'],
                ['id' => 'f', 'url' => self::CALLBACK.'?secret=shh', 'entityType' => 'customerorder', 'action' => 'UPDATE'],
            ],
            stockRows: [
                ['id' => 's', 'url' => self::CALLBACK.'?secret=shh', 'reportType' => 'bystore'],
            ],
        );

        $this->artisan('moysklad:webhooks')->assertSuccessful();

        Http::assertNotSent(fn (Request $r): bool => $r->method() === 'POST');
    }
}
