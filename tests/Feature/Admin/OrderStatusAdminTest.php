<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class OrderStatusAdminTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

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

    #[Test]
    public function an_allowed_transition_goes_through(): void
    {
        $this->actingAsManager();

        $order = Order::factory()->create(['status' => Order::STATUS_PENDING]);

        $this->patchJson("/api/admin/orders/{$order->id}", ['status' => Order::STATUS_CONFIRMED])
            ->assertOk();

        $this->assertSame(Order::STATUS_CONFIRMED, $order->fresh()->status);
    }

    #[Test]
    public function a_completed_order_cannot_be_rolled_back(): void
    {
        $this->actingAsManager();

        $order = Order::factory()->create(['status' => Order::STATUS_COMPLETED]);

        $this->patchJson("/api/admin/orders/{$order->id}", ['status' => Order::STATUS_PENDING])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');

        $this->assertSame(Order::STATUS_COMPLETED, $order->fresh()->status);
    }

    #[Test]
    public function a_cancelled_order_is_terminal(): void
    {
        $this->actingAsManager();

        $order = Order::factory()->create(['status' => Order::STATUS_CANCELLED]);

        $this->patchJson("/api/admin/orders/{$order->id}", ['status' => Order::STATUS_CONFIRMED])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    /**
     * Отмена возможна только оттуда, откуда её пускает OrderCancellationService.
     * Если бы матрица разрешала больше, менеджеру рисовали бы пункт меню,
     * который гарантированно падает.
     */
    #[Test]
    public function an_order_out_for_delivery_cannot_be_cancelled(): void
    {
        $this->actingAsManager();

        $order = Order::factory()->create(['status' => Order::STATUS_IN_DELIVERY]);

        $this->patchJson("/api/admin/orders/{$order->id}", ['status' => Order::STATUS_CANCELLED])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');

        $this->assertSame(Order::STATUS_IN_DELIVERY, $order->fresh()->status);
    }

    /**
     * Обратный ход — единственный путь к отмене заказа, который уже уехал.
     */
    #[Test]
    public function an_order_out_for_delivery_can_go_back_to_confirmed(): void
    {
        $this->actingAsManager();

        $order = Order::factory()->create(['status' => Order::STATUS_IN_DELIVERY]);

        $this->patchJson("/api/admin/orders/{$order->id}", ['status' => Order::STATUS_CONFIRMED])
            ->assertOk();

        $this->assertSame(Order::STATUS_CONFIRMED, $order->fresh()->status);
    }

    #[Test]
    public function legacy_statuses_can_never_be_assigned(): void
    {
        $this->actingAsManager();

        $order = Order::factory()->create(['status' => Order::STATUS_PENDING]);

        foreach ([Order::STATUS_SYNCED, Order::STATUS_FAILED] as $legacy) {
            $this->patchJson("/api/admin/orders/{$order->id}", ['status' => $legacy])
                ->assertStatus(422)
                ->assertJsonValidationErrors('status');
        }
    }

    /**
     * Спасательный люк для исторических заказов внешней системы.
     */
    #[Test]
    public function a_legacy_order_can_be_rescued_into_the_working_flow(): void
    {
        $this->actingAsManager();

        $order = Order::factory()->synced()->create();

        $this->patchJson("/api/admin/orders/{$order->id}", ['status' => Order::STATUS_CONFIRMED])
            ->assertOk();

        $this->assertSame(Order::STATUS_CONFIRMED, $order->fresh()->status);
    }

    /**
     * Повторная отмена — не «ничего не изменилось», а отказ: иначе клиент
     * решит, что операция прошла, а склад второй раз ничего не вернёт.
     */
    #[Test]
    public function cancelling_an_already_cancelled_order_is_refused(): void
    {
        $this->actingAsManager();

        $order = Order::factory()->create(['status' => Order::STATUS_CANCELLED]);

        $this->patchJson("/api/admin/orders/{$order->id}", ['status' => Order::STATUS_CANCELLED])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }
}
