<?php

declare(strict_types=1);

namespace App\Services\MoySklad;

use App\Services\MoySklad\Exceptions\MoySkladApiException;
use Generator;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Low-level HTTP client for the MoySklad JSON API (remap 1.2).
 *
 * Handles auth, gzip, rate-limit (429) back-off and pagination. Higher-level,
 * domain-specific calls live in {@see MoySkladService}.
 *
 * @see docs/moysklad-integration-notes.md
 */
class MoySkladClient
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly ?string $token,
        private readonly int $timeout = 30,
        private readonly int $maxRetries = 3,
        private readonly int $pageLimit = 1000,
    ) {}

    /**
     * @param  array<string, mixed>  $query
     * @param  array<string, string>  $headers
     * @return array<string, mixed>
     */
    public function get(string $path, array $query = [], array $headers = []): array
    {
        return $this->send('get', $path, ['query' => $query], $headers)->json() ?? [];
    }

    /**
     * @param  array<string, mixed>  $body
     * @param  array<string, string>  $headers
     * @return array<string, mixed>
     */
    public function post(string $path, array $body = [], array $headers = []): array
    {
        return $this->send('post', $path, ['json' => $body], $headers)->json() ?? [];
    }

    /**
     * Issue a DELETE against the given path. MoySklad answers 200/204 with no
     * meaningful body, so nothing is returned.
     *
     * @param  array<string, string>  $headers
     */
    public function delete(string $path, array $headers = []): void
    {
        $this->send('delete', $path, [], $headers);
    }

    /**
     * Stream every row of a paged list resource, page by page.
     *
     * @param  array<string, mixed>  $query
     * @param  array<string, string>  $headers
     * @param  int|null  $limit  Override default page limit (e.g. when expand causes MoySklad to drop nested rows at high limits).
     * @return Generator<int, array<string, mixed>>
     */
    public function paginate(string $path, array $query = [], array $headers = [], ?int $limit = null): Generator
    {
        $pageLimit = $limit ?? $this->pageLimit;
        $offset = 0;

        do {
            $page = $this->get($path, [...$query, 'limit' => $pageLimit, 'offset' => $offset], $headers);
            $rows = $page['rows'] ?? [];

            foreach ($rows as $row) {
                yield $row;
            }

            $offset += $pageLimit;
        } while (count($rows) === $pageLimit);
    }

    /**
     * Fetch a binary resource (e.g. an image) from an absolute MoySklad URL
     * using the configured token. Does not prepend baseUrl.
     */
    public function fetchBinary(string $absoluteUrl): Response
    {
        if (blank($this->token)) {
            throw MoySkladApiException::missingToken();
        }

        return $this->withRetry(fn (): Response => Http::withToken($this->token)
            ->timeout($this->timeout)
            ->withOptions(['decode_content' => true])
            ->withHeaders([
                'Accept' => '*/*',
                'Accept-Encoding' => 'gzip',
            ])
            ->get($absoluteUrl));
    }

    /**
     * @param  array{query?: array<string, mixed>, json?: array<string, mixed>}  $options
     * @param  array<string, string>  $headers
     */
    private function send(string $method, string $path, array $options, array $headers): Response
    {
        if (blank($this->token)) {
            throw MoySkladApiException::missingToken();
        }

        return $this->withRetry(function () use ($method, $path, $options, $headers): Response {
            $request = $this->request($headers);

            return match ($method) {
                'post' => $request->post($path, $options['json'] ?? []),
                'delete' => $request->delete($path),
                default => $request->get($path, $options['query'] ?? []),
            };
        });
    }

    /**
     * Run a request closure with shared 429 back-off and failure handling.
     *
     * @param  callable(): Response  $perform
     */
    private function withRetry(callable $perform): Response
    {
        $attempt = 0;

        while (true) {
            $response = $perform();

            if ($response->status() === 429 && $attempt < $this->maxRetries) {
                $attempt++;
                $this->backoff($response, $attempt);

                continue;
            }

            if ($response->failed()) {
                throw MoySkladApiException::fromResponse($response);
            }

            return $response;
        }
    }

    /**
     * @param  array<string, string>  $headers
     */
    private function request(array $headers): PendingRequest
    {
        return Http::baseUrl(rtrim($this->baseUrl, '/'))
            ->timeout($this->timeout)
            ->withToken($this->token)
            ->withHeaders([
                'Accept' => 'application/json;charset=utf-8',
                'Content-Type' => 'application/json',
                'Accept-Encoding' => 'gzip',
                ...$headers,
            ])
            ->withOptions(['decode_content' => true]);
    }

    private function backoff(Response $response, int $attempt): void
    {
        // MoySklad returns the wait window (ms) in X-Lognex-Retry-After.
        $waitMs = (int) $response->header('X-Lognex-Retry-After');
        $waitMs = $waitMs > 0 ? $waitMs : 1000 * $attempt;

        usleep($waitMs * 1000);
    }
}
