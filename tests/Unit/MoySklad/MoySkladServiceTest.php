<?php

declare(strict_types=1);

namespace Tests\Unit\MoySklad;

use App\Services\Catalog\Data\CatalogProduct;
use App\Services\MoySklad\MoySkladClient;
use App\Services\MoySklad\MoySkladService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class MoySkladServiceTest extends TestCase
{
    private const B2B_TYPE = '672559f1-cbf3-11e1-9eb9-889ffa6f49fd';

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('moysklad.b2b_price_type_id', self::B2B_TYPE);
    }

    private function service(): MoySkladService
    {
        return new MoySkladService(new MoySkladClient(
            baseUrl: 'https://api.moysklad.ru/api/remap/1.2',
            token: 'test-token',
        ));
    }

    #[Test]
    public function it_maps_assortment_rows_and_extracts_the_b2b_price(): void
    {
        Http::fake([
            '*entity/assortment*' => Http::response([
                'rows' => [[
                    'id' => 'prod-1',
                    'name' => 'Диван',
                    'code' => '00001',
                    'article' => 'A-1',
                    'productFolder' => ['meta' => ['href' => 'https://x/entity/productfolder/folder-1']],
                    'salePrices' => [
                        ['value' => 250000, 'priceType' => ['id' => 'retail-type']],
                        ['value' => 180000, 'priceType' => ['id' => self::B2B_TYPE]],
                    ],
                    'images' => ['rows' => [[
                        'meta' => [
                            'href' => 'https://api.moysklad.ru/api/remap/1.2/entity/product/prod-1/images/img-1',
                            'downloadHref' => 'https://api.moysklad.ru/api/remap/1.2/download/img-1',
                        ],
                        'filename' => 'sofa.png',
                        'size' => 14052,
                        'updated' => '2026-06-26 10:00:00.000',
                    ]]],
                ]],
            ], 200),
        ]);

        /** @var CatalogProduct $product */
        $product = iterator_to_array($this->service()->products())[0];

        $this->assertSame('prod-1', $product->externalId);
        $this->assertSame('Диван', $product->name);
        $this->assertSame('folder-1', $product->externalFolderId);
        $this->assertSame(250000, $product->retailPrice);
        $this->assertSame(180000, $product->b2bPrice);   // the B2B price type, not the first one

        $this->assertCount(1, $product->images);
        $image = $product->images[0];
        $this->assertSame('img-1', $image->id);
        $this->assertSame('sofa.png', $image->filename);
        $this->assertSame(14052, $image->size);
        $this->assertSame('https://api.moysklad.ru/api/remap/1.2/download/img-1', $image->downloadHref);

        Http::assertSent(fn (Request $r): bool => str_contains($r->url(), 'filter=type%3Dproduct')
            && $r->hasHeader('X-Lognex-Remap-Beta-Feature', 'assortmentWithoutStock'));
    }

    #[Test]
    public function b2b_price_is_null_when_the_type_is_absent(): void
    {
        Http::fake([
            '*entity/assortment*' => Http::response([
                'rows' => [[
                    'id' => 'prod-2',
                    'name' => 'Стол',
                    'salePrices' => [['value' => 99000, 'priceType' => ['id' => 'retail-type']]],
                ]],
            ], 200),
        ]);

        $product = iterator_to_array($this->service()->products())[0];

        $this->assertSame(99000, $product->retailPrice);
        $this->assertNull($product->b2bPrice);
    }

    #[Test]
    public function it_maps_store_rows(): void
    {
        Http::fake([
            '*entity/store*' => Http::response([
                'rows' => [
                    ['id' => 'store-1', 'name' => 'Астана'],
                    ['id' => 'store-2', 'name' => 'Алматы'],
                ],
            ], 200),
        ]);

        $stores = iterator_to_array($this->service()->stores());

        $this->assertCount(2, $stores);
        $this->assertSame('store-1', $stores[0]->externalId);
        $this->assertSame('Астана', $stores[0]->name);
    }

    #[Test]
    public function it_returns_free_stock_broken_down_by_store(): void
    {
        Http::fake([
            '*report/stock/bystore/current*' => Http::response([
                ['assortmentId' => 'prod-1', 'storeId' => 'store-1', 'freeStock' => 11],
                ['assortmentId' => 'prod-1', 'storeId' => 'store-2', 'freeStock' => 0],
                // No storeId → can't be attributed to a warehouse, skipped.
                ['assortmentId' => 'prod-2', 'storeId' => null, 'freeStock' => 5],
            ], 200),
        ]);

        $rows = $this->service()->stockByStore();

        $this->assertSame([
            ['externalProductId' => 'prod-1', 'externalStoreId' => 'store-1', 'stock' => 11.0],
            ['externalProductId' => 'prod-1', 'externalStoreId' => 'store-2', 'stock' => 0.0],
        ], $rows);
        Http::assertSent(fn (Request $r): bool => str_contains($r->url(), 'stockType=freeStock')
            && str_contains($r->url(), 'include=zeroLines'));
    }

    #[Test]
    public function it_posts_a_counterparty_and_returns_the_created_entity(): void
    {
        Http::fake([
            '*entity/counterparty' => Http::response(['id' => 'cp-1', 'name' => 'ТОО Тест'], 200),
        ]);

        $result = $this->service()->createCounterparty(['name' => 'ТОО Тест', 'companyType' => 'legalKZ']);

        $this->assertSame('cp-1', $result['id']);
        Http::assertSent(fn (Request $r): bool => $r->method() === 'POST'
            && $r['companyType'] === 'legalKZ');
    }

    #[Test]
    public function it_returns_the_customer_order_state_name(): void
    {
        Http::fake([
            '*entity/customerorder/mc-1*' => Http::response([
                'id' => 'mc-1',
                'state' => ['name' => 'Отгружен'],
            ], 200),
        ]);

        $this->assertSame('Отгружен', $this->service()->customerOrderState('mc-1'));
        Http::assertSent(fn (Request $r): bool => $r['expand'] === 'state');
    }

    #[Test]
    public function customer_order_state_is_null_when_absent(): void
    {
        Http::fake([
            '*entity/customerorder/mc-2*' => Http::response(['id' => 'mc-2'], 200),
        ]);

        $this->assertNull($this->service()->customerOrderState('mc-2'));
    }

    #[Test]
    public function creating_a_customer_order_suppresses_the_echo_webhook(): void
    {
        config(['moysklad.webhooks.callback_url' => 'https://paradise.kz/api/moysklad/webhook']);

        Http::fake([
            '*entity/customerorder' => Http::response(['id' => 'mc-9', 'name' => '00009'], 200),
        ]);

        $this->service()->createCustomerOrder(['organization' => []]);

        Http::assertSent(fn (Request $r): bool => $r->method() === 'POST'
            && $r->hasHeader('X-Lognex-WebHook-DisableByPrefix', 'https://paradise.kz/api/moysklad/webhook'));
    }

    #[Test]
    public function meta_builds_a_reference_object(): void
    {
        $meta = MoySkladService::meta('https://x/entity/store/s-1', 'store');

        $this->assertSame('store', $meta['meta']['type']);
        $this->assertSame('application/json', $meta['meta']['mediaType']);
    }
}
