<?php

declare(strict_types=1);

namespace App\Services\Local;

use App\Contracts\Catalog\CatalogSource;
use App\Services\Catalog\Data\CatalogImage;
use App\Services\Catalog\Data\CatalogProduct;
use Generator;
use RuntimeException;

/**
 * The "no external catalog" catalog source.
 *
 * paradise.kz owns its catalog: products, categories, prices and images are
 * created in the admin panel, and stock is derived from the local FIFO ledger
 * (see {@see \App\Services\Inventory\FifoInventoryService}). Nothing is
 * mirrored from an outside system, so every read here is deliberately empty.
 *
 * The sync jobs in App\Jobs\Catalog are written against this contract rather
 * than against a concrete provider, so they simply become no-ops instead of
 * needing to be deleted — which keeps the door open for importing from another
 * ERP later without rewriting the pipeline.
 */
class LocalCatalogSource implements CatalogSource
{
    public function key(): string
    {
        return 'local';
    }

    public function productFolders(): Generator
    {
        yield from [];
    }

    public function products(?string $changedSince = null): Generator
    {
        yield from [];
    }

    public function product(string $externalId): ?CatalogProduct
    {
        return null;
    }

    public function stores(): Generator
    {
        yield from [];
    }

    /**
     * Stock is never imported: it is the sum of the local FIFO layers, kept in
     * `product_store_stock` by FifoInventoryService. Returning an empty list
     * makes SyncStockJob a no-op instead of zeroing real balances.
     */
    public function stockByStore(?string $changedSince = null): array
    {
        return [];
    }

    public function productVariants(?string $changedSince = null): Generator
    {
        yield from [];
    }

    public function fetchImageBinary(CatalogImage $image): string
    {
        throw new RuntimeException(
            'Изображения хранятся локально (media library) — внешний источник не настроен.'
        );
    }
}
