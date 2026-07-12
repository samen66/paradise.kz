<?php

declare(strict_types=1);

namespace App\Services\Catalog\Data;

use App\Contracts\Catalog\CatalogSource;

/**
 * A product mirrored from an external catalog source, normalised to the fields
 * our application stores. Prices are kept in kopecks (minor units).
 *
 * Source-neutral: the parsing of a concrete API payload into this shape lives in
 * the {@see CatalogSource} implementation, not here.
 */
final readonly class CatalogProduct
{
    /**
     * @param  list<string>  $barcodes
     * @param  array<string, scalar|null>  $attributes  Extra source attributes / characteristics, name => value.
     * @param  list<CatalogImage>  $images
     * @param  list<CatalogVariant>  $variants  Modifications (size/colour/...) of this product.
     */
    public function __construct(
        public string $externalId,
        public string $name,
        public ?string $code,
        public ?string $article,
        public ?string $description,
        public ?string $externalFolderId,
        public ?int $retailPrice,
        public ?int $b2bPrice,
        public ?int $purchasePrice,
        public ?int $minPrice,
        public ?string $uom,
        public ?float $weight,
        public ?float $volume,
        public ?string $country,
        public ?string $supplier,
        public array $barcodes,
        public array $attributes,
        public array $images,
        public array $variants = [],
    ) {}
}
