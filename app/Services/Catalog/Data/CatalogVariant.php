<?php

declare(strict_types=1);

namespace App\Services\Catalog\Data;

use App\Contracts\Catalog\CatalogSource;

/**
 * A product variant / modification mirrored from an external catalog source
 * (e.g. a size/colour of a parent product). Carries its own external id,
 * barcodes, characteristics and — when the source provides them — its own price
 * and stock. Prices are kept in kopecks (minor units).
 *
 * Source-neutral: parsing a concrete API payload into this shape lives in the
 * {@see CatalogSource} implementation, not here.
 */
final readonly class CatalogVariant
{
    /**
     * @param  list<string>  $barcodes
     * @param  array<string, scalar|null>  $characteristics  name => value (e.g. "Цвет" => "красный").
     */
    public function __construct(
        public string $externalId,
        public string $parentExternalId,
        public string $name,
        public ?string $code,
        public ?int $retailPrice,
        public ?int $b2bPrice,
        public array $barcodes,
        public array $characteristics,
    ) {}
}
