<?php

declare(strict_types=1);

namespace App\Services\Catalog\Data;

/**
 * A warehouse (store) mirrored from an external catalog source.
 */
final readonly class CatalogStore
{
    public function __construct(
        public string $externalId,
        public string $name,
    ) {}
}
