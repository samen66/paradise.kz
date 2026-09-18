<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\Order;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\WriteOff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class StoreApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_stores(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/stores');
    }

    #[Test]
    public function it_lists_the_default_store_first_without_erp_fields(): void
    {
        $this->actingAsManager();
        Store::factory()->create(['name' => 'Алматы-1', 'is_default' => false]);
        Store::factory()->create(['name' => 'Шоурум', 'is_default' => true]);

        $this->getJson('/api/admin/stores')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Шоурум')
            ->assertJsonMissingPath('data.0.external_id')
            ->assertJsonMissingPath('data.0.source');
    }

    #[Test]
    public function it_creates_and_partially_updates_a_store(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/stores', [
            'name' => 'Склад на Рыскулова',
            'code' => 'RYS',
            'type' => 'warehouse',
            'address' => 'Алматы, Рыскулова 1',
            'is_active' => true,
        ])->assertCreated()->assertJsonMissingPath('data.external_id')->json('data.id');

        $this->putJson("/api/admin/stores/{$id}", ['address' => 'Алматы, Рыскулова 2'])
            ->assertOk()
            ->assertJsonPath('data.code', 'RYS')
            ->assertJsonPath('data.address', 'Алматы, Рыскулова 2');
    }

    #[Test]
    public function the_type_must_be_known(): void
    {
        $this->actingAsManager();

        $this->postJson('/api/admin/stores', ['name' => 'X', 'type' => 'garage'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('type');
    }

    #[Test]
    public function only_one_store_is_the_default(): void
    {
        $this->actingAsManager();
        $old = Store::factory()->create(['is_default' => true]);
        $new = Store::factory()->create(['is_default' => false]);

        $this->putJson("/api/admin/stores/{$new->id}", ['is_default' => true])->assertOk();

        $this->assertTrue($new->fresh()->is_default);
        $this->assertFalse($old->fresh()->is_default);

        $created = $this->postJson('/api/admin/stores', ['name' => 'Третий', 'is_default' => true])->json('data.id');
        $this->assertSame(1, Store::query()->where('is_default', true)->count());
        $this->assertTrue(Store::findOrFail($created)->is_default);
    }

    #[Test]
    public function the_last_active_store_cannot_be_switched_off_or_deleted(): void
    {
        $this->actingAsManager();
        $only = Store::factory()->create(['is_active' => true]);
        Store::factory()->inactive()->create();

        $this->putJson("/api/admin/stores/{$only->id}", ['is_active' => false])->assertUnprocessable();
        $this->assertTrue($only->fresh()->is_active);

        $this->deleteJson("/api/admin/stores/{$only->id}")->assertUnprocessable();
        $this->assertDatabaseHas('stores', ['id' => $only->id]);
    }

    #[Test]
    public function a_store_can_be_switched_off_while_another_stays_active(): void
    {
        $this->actingAsManager();
        $one = Store::factory()->create(['is_active' => true]);
        Store::factory()->create(['is_active' => true]);

        $this->putJson("/api/admin/stores/{$one->id}", ['is_active' => false])->assertOk();
        $this->assertFalse($one->fresh()->is_active);
    }

    #[Test]
    public function updating_a_store_still_returns_its_fresh_data_under_the_row_lock(): void
    {
        // Guards against a store's last-active/default checks with sqlite's
        // lockForUpdate() being a no-op, this proves the locked read/write
        // path still behaves correctly, not that the lock itself blocks
        // concurrent writers.
        $this->actingAsManager();
        $store = Store::factory()->create(['is_active' => true, 'address' => 'Старый адрес']);
        Store::factory()->create(['is_active' => true]);

        $this->putJson("/api/admin/stores/{$store->id}", ['address' => 'Новый адрес'])
            ->assertOk()
            ->assertJsonPath('data.id', $store->id)
            ->assertJsonPath('data.address', 'Новый адрес');

        $this->assertSame('Новый адрес', $store->fresh()->address);
    }

    #[Test]
    public function an_empty_store_is_deleted(): void
    {
        $this->actingAsManager();
        Store::factory()->create(['is_active' => true]);
        $empty = Store::factory()->inactive()->create();

        $this->deleteJson("/api/admin/stores/{$empty->id}")->assertNoContent();
        $this->assertDatabaseMissing('stores', ['id' => $empty->id]);
    }

    /**
     * @return array<string, array{0: callable(Store): void}>
     */
    public static function history(): array
    {
        return [
            'stock movement' => [fn (Store $store) => StockMovement::factory()->create(['store_id' => $store->id])],
            'goods receipt' => [fn (Store $store) => GoodsReceipt::factory()->create(['store_id' => $store->id])],
            'write-off' => [fn (Store $store) => WriteOff::factory()->create(['store_id' => $store->id])],
            'order' => [fn (Store $store) => Order::factory()->create(['store_id' => $store->id])],
        ];
    }

    #[Test]
    #[DataProvider('history')]
    public function a_store_with_history_cannot_be_deleted(callable $makeHistory): void
    {
        $this->actingAsManager();
        Store::factory()->create(['is_active' => true]);
        $store = Store::factory()->inactive()->create();
        $makeHistory($store);

        $this->deleteJson("/api/admin/stores/{$store->id}")
            ->assertUnprocessable()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseHas('stores', ['id' => $store->id]);
    }
}
