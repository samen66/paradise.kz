<?php

declare(strict_types=1);

namespace App\Services\Erp\Data;

use App\Contracts\Erp\OrderTarget;

/**
 * The external reference returned after an order is pushed to an
 * {@see OrderTarget}. Source-neutral: every provider maps its
 * created-order response into this shape.
 */
final readonly class PushedOrder
{
    public function __construct(
        public string $externalId,
        public ?string $number,
    ) {}
}
