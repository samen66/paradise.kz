<?php

declare(strict_types=1);

namespace App\Services\MoySklad;

use App\Contracts\Catalog\CatalogSource;
use App\Services\Catalog\Data;
use App\Services\Catalog\Data\CatalogFolder;
use App\Services\Catalog\Data\CatalogImage;
use App\Services\Catalog\Data\CatalogProduct;
use App\Services\Catalog\Data\CatalogStore;
use App\Services\Catalog\Data\CatalogVariant;
use Generator;
use Illuminate\Support\Str;

/**
 * MoySklad implementation of the {@see CatalogSource} contract plus the raw
 * order/webhook API calls used by {@see MoySkladOrderTarget} and
 * {@see MoySkladWebhookHandler}.
 *
 * Everything MoySklad-specific (endpoints, payload shapes, price-type lookup)
 * lives here; callers receive only source-neutral DTOs from
 * {@see Data}. Prices are kept in kopecks (minor units),
 * exactly as MoySklad returns them.
 *
 * @see docs/moysklad-integration-notes.md
 */
class MoySkladService implements CatalogSource
{
    /** Enables the faster assortment endpoint that omits stock fields. */
    private const ASSORTMENT_HEADERS = ['X-Lognex-Remap-Beta-Feature' => 'assortmentWithoutStock'];

    public function __construct(
        private readonly MoySkladClient $client,
    ) {}

    public function key(): string
    {
        return 'moysklad';
    }

    /**
     * @return Generator<int, CatalogFolder>
     */
    public function productFolders(): Generator
    {
        foreach ($this->client->paginate('/entity/productfolder') as $row) {
            yield $this->parseFolder($row);
        }
    }

    /**
     * Stream products from the assortment. Pass $changedSince ("Y-m-d H:i:s")
     * for an incremental sync.
     *
     * @return Generator<int, CatalogProduct>
     */
    public function products(?string $changedSince = null): Generator
    {
        $filter = 'type=product';

        if ($changedSince !== null) {
            $filter .= ';updated>='.$changedSince;
        }

        $query = [
            'filter' => $filter,
            'expand' => 'images',
            'fields' => 'downloadPermanentHref',
        ];
        $b2bPriceTypeId = $this->b2bPriceTypeId();

        // MoySklad drops nested images.rows when the parent page limit is ≥500,
        // so we cap at 100 to keep image expand working.
        foreach ($this->client->paginate('/entity/assortment', $query, self::ASSORTMENT_HEADERS, 100) as $row) {
            yield $this->parseProduct($row, $b2bPriceTypeId);
        }
    }

    /**
     * Fetch a single product by its MoySklad id, shaped like an assortment row
     * (used by the webhook-driven targeted sync). Returns null if the product no
     * longer exists.
     */
    public function product(string $externalId): ?CatalogProduct
    {
        $row = $this->client->get("/entity/product/{$externalId}", [
            'expand' => 'images,country,supplier',
            'fields' => 'downloadPermanentHref',
        ]);

        if (! isset($row['id'])) {
            return null;
        }

        return $this->parseProduct($row, $this->b2bPriceTypeId());
    }

    /**
     * @return Generator<int, CatalogStore>
     */
    public function stores(): Generator
    {
        foreach ($this->client->paginate('/entity/store') as $row) {
            yield new CatalogStore(
                externalId: (string) $row['id'],
                name: (string) ($row['name'] ?? ''),
            );
        }
    }

    /**
     * Current free stock per product, broken down by warehouse (store).
     *
     * @param  string|null  $changedSince  "Y-m-d H:i:s", at most 24h in the past.
     * @return list<array{externalProductId: string, externalStoreId: string, stock: float}>
     */
    public function stockByStore(?string $changedSince = null): array
    {
        $query = ['stockType' => 'freeStock', 'include' => 'zeroLines'];

        if ($changedSince !== null) {
            $query['changedSince'] = $changedSince;
        }

        $rows = $this->client->get('/report/stock/bystore/current', $query);

        $result = [];
        foreach ($rows as $row) {
            if (! isset($row['assortmentId'], $row['storeId'])) {
                continue;
            }

            $result[] = [
                'externalProductId' => (string) $row['assortmentId'],
                'externalStoreId' => (string) $row['storeId'],
                'stock' => (float) ($row['freeStock'] ?? 0),
            ];
        }

        return $result;
    }

    /**
     * Stream product variants (modifications). Pass $changedSince ("Y-m-d
     * H:i:s") for an incremental sync.
     *
     * @return Generator<int, CatalogVariant>
     */
    public function productVariants(?string $changedSince = null): Generator
    {
        $query = ['expand' => 'product'];

        if ($changedSince !== null) {
            $query['filter'] = 'updated>='.$changedSince;
        }

        $b2bPriceTypeId = $this->b2bPriceTypeId();

        foreach ($this->client->paginate('/entity/variant', $query) as $row) {
            $parentHref = $row['product']['meta']['href'] ?? null;

            // A variant with no resolvable parent product cannot be linked.
            if (! is_string($parentHref)) {
                continue;
            }

            $salePrices = $row['salePrices'] ?? [];

            yield new CatalogVariant(
                externalId: (string) $row['id'],
                parentExternalId: Str::afterLast($parentHref, '/'),
                name: (string) ($row['name'] ?? ''),
                code: $row['code'] ?? null,
                retailPrice: $this->firstPrice($salePrices),
                b2bPrice: $this->priceForType($salePrices, $b2bPriceTypeId),
                barcodes: $this->parseBarcodes($row['barcodes'] ?? []),
                characteristics: $this->parseCharacteristics($row['characteristics'] ?? []),
            );
        }
    }

    public function fetchImageBinary(CatalogImage $image): string
    {
        return $this->client->fetchBinary($image->downloadHref)->body();
    }

    /**
     * All configured price types (id, name, meta).
     *
     * @return array<int, array<string, mixed>>
     */
    public function priceTypes(): array
    {
        return $this->client->get('/context/companysettings/pricetype');
    }

    /**
     * Create a counterparty (the B2B client inside MoySklad).
     *
     * @param  array<string, mixed>  $data  e.g. name, companyType, inn, email, phone.
     * @return array<string, mixed> The created entity (id, meta, ...).
     */
    public function createCounterparty(array $data): array
    {
        return $this->client->post('/entity/counterparty', $data);
    }

    /**
     * Create a customer order (the order we push from a placed B2B order).
     *
     * Sends the `X-Lognex-WebHook-DisableByPrefix` header so MoySklad does NOT
     * fire our own customerorder webhook back at us for this write — preventing
     * an echo loop with the order-status sync.
     *
     * @param  array<string, mixed>  $payload  Fully-formed customerorder body.
     * @return array<string, mixed> The created order (id, name, sum, meta, ...).
     */
    public function createCustomerOrder(array $payload): array
    {
        return $this->client->post('/entity/customerorder', $payload, $this->disableEchoHeader());
    }

    /**
     * Fetch the current fulfilment state name of a customerorder, used by the
     * webhook-driven status mirror. Returns null when the order no longer exists
     * or carries no state.
     */
    public function customerOrderState(string $id): ?string
    {
        $row = $this->client->get("/entity/customerorder/{$id}", ['expand' => 'state']);

        $name = $row['state']['name'] ?? null;

        return is_string($name) && $name !== '' ? $name : null;
    }

    /**
     * List registered webhooks of the given resource ("webhook" for entity
     * webhooks, "webhookstock" for stock-change webhooks).
     *
     * @return list<array<string, mixed>>
     */
    public function webhooks(string $resource = 'webhook'): array
    {
        return iterator_to_array($this->client->paginate("/entity/{$resource}"), false);
    }

    /**
     * Register a webhook. Body is the raw MoySklad payload.
     *
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function createWebhook(array $body, string $resource = 'webhook'): array
    {
        return $this->client->post("/entity/{$resource}", $body);
    }

    /**
     * Delete a webhook by id.
     */
    public function deleteWebhook(string $id, string $resource = 'webhook'): void
    {
        $this->client->delete("/entity/{$resource}/{$id}");
    }

    /**
     * Build a `meta` reference object for linking entities in request bodies.
     *
     * @return array{meta: array{href: string, type: string, mediaType: string}}
     */
    public static function meta(string $href, string $type): array
    {
        return [
            'meta' => [
                'href' => $href,
                'type' => $type,
                'mediaType' => 'application/json',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $row  An /entity/productfolder row.
     */
    private function parseFolder(array $row): CatalogFolder
    {
        $parentHref = $row['productFolder']['meta']['href'] ?? null;

        return new CatalogFolder(
            externalId: (string) $row['id'],
            name: (string) ($row['name'] ?? ''),
            pathName: $row['pathName'] ?? null,
            parentExternalId: is_string($parentHref) ? Str::afterLast($parentHref, '/') : null,
        );
    }

    /**
     * @param  array<string, mixed>  $row  An /entity/assortment row (type=product), images expanded.
     */
    private function parseProduct(array $row, ?string $b2bPriceTypeId): CatalogProduct
    {
        $salePrices = $row['salePrices'] ?? [];
        $folderHref = $row['productFolder']['meta']['href'] ?? null;

        return new CatalogProduct(
            externalId: (string) $row['id'],
            name: (string) ($row['name'] ?? ''),
            code: $row['code'] ?? null,
            article: $row['article'] ?? null,
            description: $row['description'] ?? null,
            externalFolderId: is_string($folderHref) ? Str::afterLast($folderHref, '/') : null,
            retailPrice: $this->firstPrice($salePrices),
            b2bPrice: $this->priceForType($salePrices, $b2bPriceTypeId),
            purchasePrice: isset($row['buyPrice']['value']) ? (int) round((float) $row['buyPrice']['value']) : null,
            minPrice: isset($row['minPrice']['value']) ? (int) round((float) $row['minPrice']['value']) : null,
            uom: $row['uom']['name'] ?? null,
            weight: isset($row['weight']) ? (float) $row['weight'] : null,
            volume: isset($row['volume']) ? (float) $row['volume'] : null,
            country: $row['country']['name'] ?? null,
            supplier: $row['supplier']['name'] ?? null,
            barcodes: $this->parseBarcodes($row['barcodes'] ?? []),
            attributes: $this->parseAttributes($row['attributes'] ?? []),
            images: $this->parseImages($row['images'] ?? []),
        );
    }

    /**
     * @param  array<int, array<string, mixed>>  $salePrices
     */
    private function firstPrice(array $salePrices): ?int
    {
        $value = $salePrices[0]['value'] ?? null;

        return $value === null ? null : (int) round((float) $value);
    }

    /**
     * @param  array<int, array<string, mixed>>  $salePrices
     */
    private function priceForType(array $salePrices, ?string $b2bPriceTypeId): ?int
    {
        if ($b2bPriceTypeId === null) {
            return null;
        }

        foreach ($salePrices as $price) {
            if (($price['priceType']['id'] ?? null) === $b2bPriceTypeId) {
                return (int) round((float) ($price['value'] ?? 0));
            }
        }

        return null;
    }

    /**
     * MoySklad barcodes arrive as `[{"ean13": "..."}, {"code128": "..."}, ...]`.
     * We flatten them to a plain list of barcode strings.
     *
     * @param  array<int, array<string, mixed>>  $barcodes
     * @return list<string>
     */
    private function parseBarcodes(array $barcodes): array
    {
        $result = [];

        foreach ($barcodes as $entry) {
            if (is_array($entry)) {
                foreach ($entry as $value) {
                    if (is_string($value) && $value !== '') {
                        $result[] = $value;
                    }
                }
            }
        }

        return $result;
    }

    /**
     * MoySklad attributes arrive as `[{"name": "Цвет", "value": "красный"}, ...]`.
     * `value` may itself be an object (e.g. a dictionary entry with its own name).
     *
     * @param  array<int, array<string, mixed>>  $attributes
     * @return array<string, scalar|null>
     */
    private function parseAttributes(array $attributes): array
    {
        $result = [];

        foreach ($attributes as $attribute) {
            $name = $attribute['name'] ?? null;
            if (! is_string($name) || $name === '') {
                continue;
            }

            $value = $attribute['value'] ?? null;
            if (is_array($value)) {
                $value = $value['name'] ?? null;
            }

            $result[$name] = is_scalar($value) ? $value : null;
        }

        return $result;
    }

    /**
     * MoySklad variant characteristics arrive as
     * `[{"name": "Цвет", "value": "красный"}, ...]`.
     *
     * @param  array<int, array<string, mixed>>  $characteristics
     * @return array<string, scalar|null>
     */
    private function parseCharacteristics(array $characteristics): array
    {
        $result = [];

        foreach ($characteristics as $characteristic) {
            $name = $characteristic['name'] ?? null;
            if (! is_string($name) || $name === '') {
                continue;
            }

            $value = $characteristic['value'] ?? null;
            $result[$name] = is_scalar($value) ? $value : null;
        }

        return $result;
    }

    /**
     * Structured image metadata. We mirror the full-quality original (via
     * `meta.downloadHref`) into our own storage and generate conversions there,
     * rather than persisting MoySklad's ephemeral signed URLs.
     *
     * @param  array<string, mixed>  $images  Expanded images MetaArray.
     * @return list<CatalogImage>
     */
    private function parseImages(array $images): array
    {
        $result = [];

        foreach ($images['rows'] ?? [] as $img) {
            $href = $img['meta']['href'] ?? null;
            $downloadHref = $img['meta']['downloadHref'] ?? null;

            if (! is_string($href) || ! is_string($downloadHref)) {
                continue;
            }

            $result[] = new CatalogImage(
                id: Str::afterLast($href, '/'),
                filename: (string) ($img['filename'] ?? 'image'),
                size: (int) ($img['size'] ?? 0),
                updated: isset($img['updated']) ? (string) $img['updated'] : null,
                downloadHref: $downloadHref,
            );
        }

        return $result;
    }

    private function b2bPriceTypeId(): ?string
    {
        $id = config('moysklad.b2b_price_type_id');

        return $id === null ? null : (string) $id;
    }

    /**
     * Header that tells MoySklad to skip firing webhooks whose callback URL
     * starts with our endpoint, for the current write request only.
     *
     * @return array<string, string>
     */
    private function disableEchoHeader(): array
    {
        $url = config('moysklad.webhooks.callback_url')
            ?: rtrim((string) config('app.url'), '/').'/api/moysklad/webhook';

        return ['X-Lognex-WebHook-DisableByPrefix' => (string) $url];
    }
}
