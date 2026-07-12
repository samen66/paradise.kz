<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Filament\Resources\Attributes\Pages\ListAttributes;
use App\Filament\Resources\Brands\Pages\ListBrands;
use App\Filament\Resources\Categories\Pages\CreateCategory;
use App\Filament\Resources\Categories\Pages\ListCategories;
use App\Filament\Resources\PriceTypes\Pages\ListPriceTypes;
use App\Filament\Resources\Products\Pages\EditProduct;
use App\Filament\Resources\Products\RelationManagers\AttributeValuesRelationManager;
use App\Filament\Resources\Products\RelationManagers\PricesRelationManager;
use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Brand;
use App\Models\Category;
use App\Models\PriceType;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CatalogAdminTest extends TestCase
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
    public function the_category_brand_and_attribute_list_pages_render(): void
    {
        Category::factory()->create();
        Brand::factory()->create();
        Attribute::factory()->create();

        Livewire::test(ListCategories::class)->assertOk();
        Livewire::test(ListBrands::class)->assertOk();
        Livewire::test(ListAttributes::class)->assertOk();
    }

    #[Test]
    public function the_price_type_list_page_renders(): void
    {
        PriceType::factory()->create();

        Livewire::test(ListPriceTypes::class)->assertOk();
    }

    #[Test]
    public function the_prices_relation_manager_renders_and_can_add_a_price(): void
    {
        $product = Product::factory()->create();
        $priceType = PriceType::factory()->b2b()->create();
        ProductPrice::factory()->for($product)->for($priceType, 'priceType')->create(['price' => 123_456]);

        Livewire::test(PricesRelationManager::class, [
            'ownerRecord' => $product,
            'pageClass' => EditProduct::class,
        ])->assertOk();
    }

    #[Test]
    public function a_category_can_be_created_with_a_parent(): void
    {
        $parent = Category::factory()->create(['name' => 'Мебель']);

        Livewire::test(CreateCategory::class)
            ->fillForm([
                'parent_id' => $parent->id,
                'name' => 'Диваны',
                'slug' => 'divany',
                'sort_order' => 1,
                'is_active' => true,
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        // `name` is a translatable JSON column ({"ru": ...}), so assert via
        // the model rather than a raw column match.
        $created = Category::query()->where('parent_id', $parent->id)->firstOrFail();
        $this->assertSame('Диваны', $created->name);
    }

    #[Test]
    public function the_product_edit_page_and_attribute_values_relation_manager_render(): void
    {
        $product = Product::factory()->create();
        $attribute = Attribute::factory()->create(['name' => 'Материал']);
        AttributeValue::factory()->for($product)->for($attribute)->create(['value' => 'Дерево']);

        Livewire::test(EditProduct::class, ['record' => $product->getRouteKey()])->assertOk();

        Livewire::test(AttributeValuesRelationManager::class, [
            'ownerRecord' => $product,
            'pageClass' => EditProduct::class,
        ])->assertOk();
    }

    #[Test]
    public function assigning_a_category_and_brand_to_a_product_persists(): void
    {
        $category = Category::factory()->create();
        $brand = Brand::factory()->create();
        $product = Product::factory()->create();

        Livewire::test(EditProduct::class, ['record' => $product->getRouteKey()])
            ->fillForm([
                'category_id' => $category->id,
                'brand_id' => $brand->id,
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'category_id' => $category->id,
            'brand_id' => $brand->id,
        ]);
    }
}
