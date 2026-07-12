<?php

declare(strict_types=1);

namespace App\Services\MoySklad\Webhook;

use Illuminate\Support\Str;

/**
 * A single normalised entry from a MoySklad entity-webhook payload's `events[]`.
 *
 * Stock-change webhooks use a different payload shape (no `events[]`) and are
 * handled separately by the controller.
 *
 * @see docs/moysklad-api/md/dictionaries/_webhook.md
 */
final readonly class WebhookEvent
{
    public function __construct(
        public string $entityType,
        public string $action,
        public string $entityId,
    ) {}

    /**
     * Build from a single `events[]` element. Returns null when the element is
     * missing the type, action or a parseable entity id.
     *
     * @param  array<string, mixed>  $event
     */
    public static function fromArray(array $event): ?self
    {
        $type = $event['meta']['type'] ?? null;
        $href = $event['meta']['href'] ?? null;
        $action = $event['action'] ?? null;

        if (! is_string($type) || ! is_string($action) || ! is_string($href)) {
            return null;
        }

        $id = Str::afterLast(rtrim($href, '/'), '/');

        if ($id === '' || $id === $href) {
            return null;
        }

        return new self($type, strtoupper($action), $id);
    }

    /**
     * Normalise a whole webhook request payload into typed events.
     *
     * @param  mixed  $events  The payload's `events` value.
     * @return list<self>
     */
    public static function collect(mixed $events): array
    {
        if (! is_array($events)) {
            return [];
        }

        $result = [];

        foreach ($events as $event) {
            if (is_array($event) && ($parsed = self::fromArray($event)) !== null) {
                $result[] = $parsed;
            }
        }

        return $result;
    }
}
