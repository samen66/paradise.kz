<?php

declare(strict_types=1);

namespace App\Services\Catalog\Data;

/**
 * A product category (folder) mirrored from an external catalog source.
 */
final readonly class CatalogFolder
{
    public function __construct(
        public string $externalId,
        public string $name,
        public ?string $pathName,
        public ?string $parentExternalId,
    ) {}
}
