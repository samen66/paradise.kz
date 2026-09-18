<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Filament\Resources\GoodsReceipts\Pages\EditGoodsReceipt;
use App\Filament\Resources\GoodsReceipts\Pages\ListGoodsReceipts;
use App\Filament\Resources\GoodsReceipts\RelationManagers\ItemsRelationManager;
use App\Filament\Resources\Suppliers\Pages\ListSuppliers;
use App\Models\Batch;
use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\Supplier;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Filament\Actions\CreateAction;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Filament\Notifications\Notification;
use Filament\Support\Exceptions\Halt;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use PHPUnit\Framework\Attributes\Test;
use ReflectionMethod;
use Tests\TestCase;

class GoodsReceiptAdminTest extends TestCase
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

    #[Test]
    public function the_supplier_and_goods_receipt_list_pages_render(): void
    {
        Supplier::factory()->create();
        GoodsReceipt::factory()->create();

        Livewire::test(ListSuppliers::class)->assertOk();
        Livewire::test(ListGoodsReceipts::class)->assertOk();
    }

    #[Test]
    public function the_goods_receipt_edit_page_and_items_relation_manager_render(): void
    {
        $receipt = GoodsReceipt::factory()->create();
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create();

        Livewire::test(EditGoodsReceipt::class, ['record' => $receipt->getRouteKey()])->assertOk();

        Livewire::test(ItemsRelationManager::class, [
            'ownerRecord' => $receipt,
            'pageClass' => EditGoodsReceipt::class,
        ])->assertOk();
    }

    #[Test]
    public function posting_a_receipt_from_the_admin_writes_stock(): void
    {
        $store = Store::factory()->create();
        $product = Product::factory()->create();

        $receipt = GoodsReceipt::factory()->for($store, 'store')->create();
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create([
            'product_id' => $product->id,
            'quantity' => 8,
            'unit_cost' => 12_000,
        ]);

        Livewire::test(EditGoodsReceipt::class, ['record' => $receipt->getRouteKey()])
            ->callAction('post')
            ->assertHasNoActionErrors();

        $this->assertTrue($receipt->refresh()->isPosted());
        $this->assertSame(1, Batch::query()->where('product_id', $product->id)->count());
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $product->id,
            'store_id' => $store->id,
            'type' => StockMovement::TYPE_RECEIPT,
        ]);
    }

    #[Test]
    public function a_posted_receipts_create_edit_and_delete_actions_are_hidden_on_the_items_relation_manager(): void
    {
        $receipt = GoodsReceipt::factory()->posted()->create();
        $item = GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create();

        Livewire::test(ItemsRelationManager::class, [
            'ownerRecord' => $receipt,
            'pageClass' => EditGoodsReceipt::class,
        ])
            ->assertActionHidden(TestAction::make(CreateAction::class)->table())
            ->assertActionHidden(TestAction::make(EditAction::class)->table($item))
            ->assertActionHidden(TestAction::make(DeleteAction::class)->table($item));
    }

    #[Test]
    public function the_edit_pages_delete_action_is_hidden_for_a_posted_receipt(): void
    {
        $receipt = GoodsReceipt::factory()->posted()->create();

        Livewire::test(EditGoodsReceipt::class, ['record' => $receipt->getRouteKey()])
            ->assertActionHidden(DeleteAction::class);
    }

    /**
     * Exercises ItemsRelationManager::haltIfReceiptPosted() directly, the way
     * RefusesPostedDocumentsTest exercises whileDraft() directly, rather than
     * through a full create/edit/delete round trip.
     *
     * Tracing an actual `->callAction()` race (mount the delete action while
     * draft, post the receipt behind its back, then call the mounted action)
     * showed Filament's own `callMountedAction()` re-runs `isDisabled()` —
     * which reads `->visible()`, i.e. `getOwnerRecord()->isPosted()` — before
     * running any `->before()` hook, and `getOwnerRecord()` comes back
     * genuinely fresh from the database on that second Livewire request. That
     * pre-existing check already blocks this particular race and shadows our
     * new hook entirely, so a Livewire-level test cannot reach
     * `haltIfReceiptPosted()` through that path — there's nothing left for it
     * to catch once Filament's own gate has already refused.
     *
     * What `->before()` uniquely adds is the case Filament's gate can't
     * cover: two requests racing inside the same already-open action
     * transaction (`beginDatabaseTransaction()`), where a `SELECT ... FOR
     * UPDATE` on the receipt row is what actually serialises them against a
     * concurrent `post`. That can't be reproduced by a single-threaded
     * PHPUnit run, so this test instead verifies the guard's own behaviour in
     * isolation: it lets a draft receipt's action continue, and refuses
     * (notifies + halts) a posted one.
     */
    #[Test]
    public function halt_if_receipt_posted_refuses_a_posted_receipt_and_allows_a_draft_one(): void
    {
        $receipt = GoodsReceipt::factory()->create();

        $component = Livewire::test(ItemsRelationManager::class, [
            'ownerRecord' => $receipt,
            'pageClass' => EditGoodsReceipt::class,
        ]);

        $guard = new ReflectionMethod(ItemsRelationManager::class, 'haltIfReceiptPosted');
        $guard->setAccessible(true);
        $action = DeleteAction::make();

        // Draft: the guard is a no-op, no notification, no halt.
        $guard->invoke($component->instance(), $action, $receipt);
        Notification::assertNotNotified();

        // A concurrent `post` lands between this instance being loaded and
        // the guard running; it re-reads the row under lock instead of
        // trusting the $receipt it was handed.
        GoodsReceipt::whereKey($receipt->id)->update(['status' => GoodsReceipt::STATUS_POSTED]);

        $halted = false;

        try {
            $guard->invoke($component->instance(), $action, $receipt);
        } catch (Halt) {
            $halted = true;
        }

        $this->assertTrue($halted, 'Expected the guard to halt the action for a posted receipt.');
        Notification::assertNotified('Документ проведён — изменить нельзя.');
    }
}
