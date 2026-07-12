<?php

declare(strict_types=1);

namespace App\Services\Catalog\Data;

use App\Jobs\Catalog\SyncProductImagesJob;

/**
 * A single product image described by an external catalog source.
 *
 * We deliberately keep only stable identifiers here, NOT ephemeral display URLs.
 * `downloadHref` is the (re-requestable) endpoint we stream the binary from when
 * mirroring it into our own storage. `id` + (`size`, `updated`) form the change
 * key used by {@see SyncProductImagesJob} to decide whether
 * an image must be (re)downloaded.
 */
final readonly class CatalogImage
{
    public function __construct(
        public string $id,
        public string $filename,
        public int $size,
        public ?string $updated,
        public string $downloadHref,
    ) {}
}
