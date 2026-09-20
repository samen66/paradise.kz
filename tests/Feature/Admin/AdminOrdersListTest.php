<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

/**
 * Список заказов админки: сегменты, архив и счётчики вкладок.
 */
class AdminOrdersListTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    /** @return array{b2b: Order, retail: Order, guest: Order} */
    private function seedOneOrderPerSegment(): array
    {
        return [
            'b2b' => Order::factory()->for(User::factory()->b2b()->approved())->create(),
            'retail' => Order::factory()->for(User::factory()->retail())->create(),
            'guest' => Order::factory()->for(User::factory()->guest())->create(),
        ];
    }

    #[Test]
    public function the_b2b_segment_returns_only_partner_orders(): void
    {
        $this->actingAsManager();
        $orders = $this->seedOneOrderPerSegment();

        $ids = collect(
            $this->getJson('/api/admin/orders?filter[segment]=b2b')->assertOk()->json('data')
        )->pluck('id');

        $this->assertContains($orders['b2b']->id, $ids);
        $this->assertNotContains($orders['retail']->id, $ids);
        $this->assertNotContains($orders['guest']->id, $ids);
    }

    #[Test]
    public function the_retail_segment_includes_guest_checkouts(): void
    {
        $this->actingAsManager();
        $orders = $this->seedOneOrderPerSegment();

        $ids = collect(
            $this->getJson('/api/admin/orders?filter[segment]=retail')->assertOk()->json('data')
        )->pluck('id');

        $this->assertContains($orders['retail']->id, $ids);
        $this->assertContains($orders['guest']->id, $ids);
        $this->assertNotContains($orders['b2b']->id, $ids);
    }

    #[Test]
    public function without_a_segment_both_sides_come_back(): void
    {
        $this->actingAsManager();
        $orders = $this->seedOneOrderPerSegment();

        $ids = collect(
            $this->getJson('/api/admin/orders')->assertOk()->json('data')
        )->pluck('id');

        $this->assertContains($orders['b2b']->id, $ids);
        $this->assertContains($orders['retail']->id, $ids);
        $this->assertContains($orders['guest']->id, $ids);
    }

    /**
     * `archived` — выдумка интерфейса: такого значения в колонке status нет,
     * оно разворачивается в пару легаси-статусов.
     */
    #[Test]
    public function the_archived_pseudo_status_expands_to_both_legacy_statuses(): void
    {
        $this->actingAsManager();

        $synced = Order::factory()->synced()->create();
        $failed = Order::factory()->failed()->create();
        $working = Order::factory()->create(['status' => Order::STATUS_PENDING]);

        $ids = collect(
            $this->getJson('/api/admin/orders?filter[status]=archived')->assertOk()->json('data')
        )->pluck('id');

        $this->assertContains($synced->id, $ids);
        $this->assertContains($failed->id, $ids);
        $this->assertNotContains($working->id, $ids);
    }

    #[Test]
    public function a_real_status_still_filters_exactly(): void
    {
        $this->actingAsManager();

        $pending = Order::factory()->create(['status' => Order::STATUS_PENDING]);
        $completed = Order::factory()->create(['status' => Order::STATUS_COMPLETED]);

        $ids = collect(
            $this->getJson('/api/admin/orders?filter[status]=pending')->assertOk()->json('data')
        )->pluck('id');

        $this->assertContains($pending->id, $ids);
        $this->assertNotContains($completed->id, $ids);
    }

    #[Test]
    public function the_list_is_staff_only(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/orders');
    }

    /**
     * У модели User нет $hidden, поэтому отношение, загруженное целиком,
     * вынесло бы в JSON хеш пароля. Список отдаёт только нужные колонки.
     */
    #[Test]
    public function the_list_never_leaks_user_secrets(): void
    {
        $this->actingAsManager();

        Order::factory()->for(User::factory()->retail())->create();

        $user = $this->getJson('/api/admin/orders')->assertOk()->json('data.0.user');

        $this->assertArrayNotHasKey('password', $user);
        $this->assertArrayNotHasKey('remember_token', $user);
        $this->assertArrayHasKey('type', $user);
    }
}
