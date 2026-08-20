<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Filament\Resources\CatalogGroups\Pages\ListCatalogGroups;
use App\Filament\Resources\Orders\Pages\EditOrder;
use App\Filament\Resources\Orders\Pages\ListOrders;
use App\Filament\Resources\Products\Pages\EditProduct;
use App\Filament\Resources\Products\Pages\ListProducts;
use App\Filament\Resources\Products\RelationManagers\VariantsRelationManager;
use App\Filament\Resources\Stores\Pages\ListStores;
use App\Filament\Resources\Users\Pages\EditUser;
use App\Filament\Resources\Users\Pages\ListUsers;
use App\Filament\Resources\Users\RelationManagers\AddressesRelationManager;
use App\Models\Address;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AdminPagesRenderTest extends TestCase
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
    public function the_resource_list_pages_render(): void
    {
        // Seed a little data so the tables render real rows.
        User::factory()->b2b()->create();
        Product::factory()->create();
        Store::factory()->create();
        $order = Order::factory()->synced()->create();
        OrderItem::factory()->create(['order_id' => $order->id]);

        Livewire::test(ListUsers::class)->assertOk();
        Livewire::test(ListProducts::class)->assertOk();
        Livewire::test(ListCatalogGroups::class)->assertOk();
        Livewire::test(ListOrders::class)->assertOk();
        Livewire::test(ListStores::class)->assertOk();
    }

    #[Test]
    public function the_product_edit_page_and_variants_relation_manager_render(): void
    {
        // Mirrored ERP fields: barcodes/attributes (JSON) feed TagsInput/KeyValue,
        // and the variant feeds the relation manager — render to catch misconfig.
        $product = Product::factory()->create([
            'country' => 'Казахстан',
            'supplier' => 'ТОО Поставщик',
        ]);
        $product->externalMapping()->save(\App\Models\ProductExternalMapping::factory()->make([
            'barcodes' => ['4600000000017'],
            'erp_attributes' => ['Материал' => 'дерево'],
        ]));
        ProductVariant::factory()->for($product)->create([
            'characteristics' => ['Цвет' => 'красный'],
            'barcodes' => ['4600000000024'],
        ]);

        Livewire::test(EditProduct::class, ['record' => $product->getRouteKey()])->assertOk();

        Livewire::test(VariantsRelationManager::class, [
            'ownerRecord' => $product,
            'pageClass' => EditProduct::class,
        ])->assertOk();
    }

    #[Test]
    public function the_order_edit_page_renders_with_a_delivery_order(): void
    {
        $order = Order::factory()->create([
            'delivery_method' => 'delivery',
            'delivery_city' => 'Алматы',
            'delivery_street' => 'Абая',
            'delivery_building' => '10',
        ]);

        Livewire::test(EditOrder::class, ['record' => $order->getRouteKey()])->assertOk();
    }

    #[Test]
    public function the_user_edit_page_and_addresses_relation_manager_render(): void
    {
        $user = User::factory()->b2b()->approved()->create();
        Address::factory()->for($user)->create();

        Livewire::test(EditUser::class, ['record' => $user->getRouteKey()])->assertOk();

        Livewire::test(AddressesRelationManager::class, [
            'ownerRecord' => $user,
            'pageClass' => EditUser::class,
        ])->assertOk();
    }
}
