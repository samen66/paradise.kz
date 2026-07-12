<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class OrderTrackingTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function an_order_is_found_by_number_and_matching_phone(): void
    {
        $guest = User::factory()->guest()->create(['phone' => '+77071234567']);
        $order = Order::factory()->create(['user_id' => $guest->id]);

        $this->getJson('/api/public/orders/track?number='.$order->fresh()->number.'&phone=8 707 123 45 67')
            ->assertOk()
            ->assertJsonPath('data.id', $order->id)
            ->assertJsonPath('data.number', $order->fresh()->number);
    }

    #[Test]
    public function a_wrong_phone_is_a_404(): void
    {
        $guest = User::factory()->guest()->create(['phone' => '+77071234567']);
        $order = Order::factory()->create(['user_id' => $guest->id]);

        $this->getJson('/api/public/orders/track?number='.$order->fresh()->number.'&phone=+77779998877')
            ->assertNotFound();
    }

    #[Test]
    public function an_unknown_number_is_a_404(): void
    {
        $this->getJson('/api/public/orders/track?number=P-999999&phone=+77071234567')
            ->assertNotFound();
    }
}
