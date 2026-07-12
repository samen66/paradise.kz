<?php

declare(strict_types=1);

namespace Tests\Unit\MoySklad;

use App\Services\MoySklad\Webhook\WebhookEvent;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class WebhookEventTest extends TestCase
{
    private const BASE = 'https://api.moysklad.ru/api/remap/1.2';

    #[Test]
    public function it_parses_type_action_and_id_from_the_href(): void
    {
        $event = WebhookEvent::fromArray([
            'meta' => ['type' => 'product', 'href' => self::BASE.'/entity/product/abc-123'],
            'action' => 'update',
        ]);

        $this->assertNotNull($event);
        $this->assertSame('product', $event->entityType);
        $this->assertSame('UPDATE', $event->action);
        $this->assertSame('abc-123', $event->entityId);
    }

    #[Test]
    public function it_tolerates_a_trailing_slash_in_the_href(): void
    {
        $event = WebhookEvent::fromArray([
            'meta' => ['type' => 'product', 'href' => self::BASE.'/entity/product/abc-123/'],
            'action' => 'DELETE',
        ]);

        $this->assertNotNull($event);
        $this->assertSame('abc-123', $event->entityId);
    }

    #[Test]
    public function it_returns_null_when_required_fields_are_missing(): void
    {
        $this->assertNull(WebhookEvent::fromArray(['action' => 'UPDATE']));
        $this->assertNull(WebhookEvent::fromArray(['meta' => ['type' => 'product'], 'action' => 'UPDATE']));
        $this->assertNull(WebhookEvent::fromArray(['meta' => ['href' => self::BASE.'/x/y'], 'action' => 'UPDATE']));
    }

    #[Test]
    public function collect_skips_unparseable_entries(): void
    {
        $events = WebhookEvent::collect([
            ['meta' => ['type' => 'product', 'href' => self::BASE.'/entity/product/1'], 'action' => 'UPDATE'],
            ['garbage' => true],
            'not-an-array',
        ]);

        $this->assertCount(1, $events);
        $this->assertSame('1', $events[0]->entityId);
    }

    #[Test]
    public function collect_returns_empty_for_non_arrays(): void
    {
        $this->assertSame([], WebhookEvent::collect(null));
        $this->assertSame([], WebhookEvent::collect('events'));
    }
}
