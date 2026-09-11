<?php

declare(strict_types=1);

namespace App\Contracts\Catalog;

use App\Contracts\Erp\ErpProvider;
use App\Services\Catalog\Data;
use App\Services\Catalog\Data\CatalogFolder;
use App\Services\Catalog\Data\CatalogImage;
use App\Services\Catalog\Data\CatalogProduct;
use App\Services\Catalog\Data\CatalogStore;
use App\Services\Catalog\Data\CatalogVariant;
use Generator;

/**
 * An external catalog system mirrored into our local tables (products, folders,
 * warehouses, stock, images). No external source is connected today (the
 * `local` provider's source yields nothing); the sync jobs depend only on this
 * contract so a source can be plugged in via the active {@see ErpProvider}
 * (config('erp.provider')). Every method returns source-neutral DTOs from
 * {@see Data}.
 */
interface CatalogSource
{
    /**
     * Stable identifier persisted on every mirrored row's `source` column
     * (e.g. "local"). Lets rows from multiple sources coexist.
     */
    public function key(): string;

    /**
     * Stream product categories (folders).
     *
     * @return Generator<int, CatalogFolder>
     */
    public function productFolders(): Generator;

    /**
     * Stream products. Pass $changedSince ("Y-m-d H:i:s") for an incremental sync.
     *
     * @return Generator<int, CatalogProduct>
     */
    public function products(?string $changedSince = null): Generator;

    /**
     * Fetch a single product by its external id, or null if it no longer exists.
     */
    public function product(string $externalId): ?CatalogProduct;

    /**
     * Stream warehouses (stores).
     *
     * @return Generator<int, CatalogStore>
     */
    public function stores(): Generator;

    /**
     * Current free stock per product, broken down by warehouse.
     *
     * @param  string|null  $changedSince  "Y-m-d H:i:s" for a delta window.
     * @return list<array{externalProductId: string, externalStoreId: string, stock: float}>
     */
    public function stockByStore(?string $changedSince = null): array;

    /**
     * Stream product variants / modifications (size, colour, ...). Each variant
     * carries its parent product's external id. Pass $changedSince ("Y-m-d
     * H:i:s") for an incremental sync.
     *
     * @return Generator<int, CatalogVariant>
     */
    public function productVariants(?string $changedSince = null): Generator;

    /**
     * Download the full-quality binary of a catalog image, ready to be stored
     * locally. The source supplies whatever auth its endpoint needs.
     */
    public function fetchImageBinary(CatalogImage $image): string;
}
