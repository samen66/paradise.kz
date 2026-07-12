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
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use PHPUnit\Framework\Attributes\Test;
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
}
