<?php

declare(strict_types=1);

namespace App\Services\MoySklad\Exceptions;

use Illuminate\Http\Client\Response;
use RuntimeException;

class MoySkladApiException extends RuntimeException
{
    /**
     * @param  array<int, array<string, mixed>>  $errors  Parsed MoySklad `errors` array.
     */
    public function __construct(
        string $message,
        public readonly int $status = 0,
        public readonly array $errors = [],
    ) {
        parent::__construct($message, $status);
    }

    public static function fromResponse(Response $response): self
    {
        $body = $response->json();
        $errors = is_array($body) ? ($body['errors'] ?? []) : [];
        $message = $errors[0]['error'] ?? "MoySklad API request failed with status {$response->status()}";

        return new self($message, $response->status(), is_array($errors) ? $errors : []);
    }

    public static function missingToken(): self
    {
        return new self('MoySklad token is not configured (set MOYSKLAD_TOKEN).', 0);
    }
}
