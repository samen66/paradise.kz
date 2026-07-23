<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderStatusAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_has_expanded_status_constants(): void
    {
        $this->assertSame('pending', Order::STATUS_PENDING);
        $this->assertSame('confirmed', Order::STATUS_CONFIRMED);
        $this->assertSame('in_delivery', Order::STATUS_IN_DELIVERY);
        $this->assertSame('completed', Order::STATUS_COMPLETED);
        $this->assertSame('cancelled', Order::STATUS_CANCELLED);
        $this->assertSame('synced', Order::STATUS_SYNCED);
        $this->assertSame('failed', Order::STATUS_FAILED);
    }

    public function test_all_statuses_returns_all_values(): void
    {
        $statuses = Order::ALL_STATUSES;

        $this->assertContains('pending', $statuses);
        $this->assertContains('confirmed', $statuses);
        $this->assertContains('in_delivery', $statuses);
        $this->assertContains('completed', $statuses);
        $this->assertContains('cancelled', $statuses);
        $this->assertContains('synced', $statuses);
        $this->assertContains('failed', $statuses);
    }
}
