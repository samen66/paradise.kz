<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Filament\Resources\Stores\Pages\EditStore;
use App\Models\GoodsReceipt;
use App\Models\Order;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\User;
use App\Models\WriteOff;
use Database\Seeders\RolesAndPermissionsSeeder;
use Filament\Actions\DeleteAction;
use Filament\Facades\Filament;
use Filament\Notifications\Notification;
use Filament\Support\Exceptions\Halt;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Mirrors StoreController::destroy()'s refusal rules on EditStore's Filament
 * delete action: deleting a store cascades stock_movements/batches/
 * goods_receipts at the database level, and the last active store must never
 * go (StoreResolver returns null and checkout breaks).
 */
class StoreAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        Filament::setCurrentPanel(Filament::getPanel('admin'));

        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $this->actingAs($admin);
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
    public function the_delete_action_is_hidden_for_a_store_with_history(callable $makeHistory): void
    {
        Store::factory()->create(['is_active' => true]);
        $store = Store::factory()->inactive()->create();
        $makeHistory($store);

        Livewire::test(EditStore::class, ['record' => $store->getRouteKey()])
            ->assertActionHidden(DeleteAction::class);

        $this->assertDatabaseHas('stores', ['id' => $store->id]);
    }

    #[Test]
    public function the_delete_action_is_hidden_for_the_last_active_store(): void
    {
        $only = Store::factory()->create(['is_active' => true]);
        Store::factory()->inactive()->create();

        Livewire::test(EditStore::class, ['record' => $only->getRouteKey()])
            ->assertActionHidden(DeleteAction::class);

        $this->assertDatabaseHas('stores', ['id' => $only->id]);
    }

    #[Test]
    public function a_store_without_history_can_still_be_deleted(): void
    {
        Store::factory()->create(['is_active' => true]);
        $empty = Store::factory()->inactive()->create();

        Livewire::test(EditStore::class, ['record' => $empty->getRouteKey()])
            ->assertActionVisible(DeleteAction::class)
            ->callAction(DeleteAction::class);

        $this->assertDatabaseMissing('stores', ['id' => $empty->id]);
    }

    /**
     * Exercises EditStore::haltIfNotDeletable() directly, the way
     * RefusesPostedDocumentsTest exercises whileDraft() and
     * GoodsReceiptAdminTest exercises haltIfReceiptPosted() directly, rather
     * than through a full delete round trip.
     *
     * As with the goods-receipt guard, Filament's own callMountedAction()
     * re-runs isDisabled() (-> ->visible()) against a freshly rehydrated
     * $record before running any ->before() hook, so a genuinely separate
     * Livewire request (open the page, then history/last-active status
     * changes, then click delete) is already caught by ->visible() itself
     * and never reaches ->before() — there is nothing left for a Livewire
     * test to observe on that path. What ->before() uniquely adds is
     * protection against a second request racing inside the same
     * already-open action transaction, which a single-threaded PHPUnit run
     * cannot reproduce. So these tests verify the guard's own behaviour in
     * isolation instead.
     */
    #[Test]
    public function halt_if_not_deletable_is_a_noop_for_an_empty_non_last_active_store(): void
    {
        Store::factory()->create(['is_active' => true]);
        $store = Store::factory()->inactive()->create();

        $component = Livewire::test(EditStore::class, ['record' => $store->getRouteKey()]);
        $guard = $this->haltIfNotDeletableMethod();

        $guard->invoke($component->instance(), DeleteAction::make(), $store);

        Notification::assertNotNotified();
    }

    #[Test]
    public function halt_if_not_deletable_refuses_a_store_with_history(): void
    {
        Store::factory()->create(['is_active' => true]);
        $store = Store::factory()->inactive()->create();
        GoodsReceipt::factory()->create(['store_id' => $store->id]);

        $component = Livewire::test(EditStore::class, ['record' => $store->getRouteKey()]);
        $guard = $this->haltIfNotDeletableMethod();

        $halted = false;

        try {
            $guard->invoke($component->instance(), DeleteAction::make(), $store);
        } catch (Halt) {
            $halted = true;
        }

        $this->assertTrue($halted, 'Expected the guard to halt for a store with history.');
        Notification::assertNotified('У склада есть история (движения, приёмки, списания или заказы) — удалить нельзя, выключите его.');
    }

    #[Test]
    public function halt_if_not_deletable_refuses_the_last_active_store(): void
    {
        $lastActive = Store::factory()->create(['is_active' => true]);
        Store::factory()->inactive()->create();

        $component = Livewire::test(EditStore::class, ['record' => $lastActive->getRouteKey()]);
        $guard = $this->haltIfNotDeletableMethod();

        $halted = false;

        try {
            $guard->invoke($component->instance(), DeleteAction::make(), $lastActive);
        } catch (Halt) {
            $halted = true;
        }

        $this->assertTrue($halted, 'Expected the guard to halt for the last active store.');
        Notification::assertNotified('Это последний активный склад — удалить нельзя.');
    }

    private function haltIfNotDeletableMethod(): ReflectionMethod
    {
        $method = new ReflectionMethod(EditStore::class, 'haltIfNotDeletable');
        $method->setAccessible(true);

        return $method;
    }
}
