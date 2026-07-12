<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Filament\Pages\CatalogSettings;
use App\Models\CatalogSetting;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CatalogSettingsPageTest extends TestCase
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
    public function the_page_renders_with_the_current_value(): void
    {
        CatalogSetting::factory()->hidingStockQuantity()->create();

        Livewire::test(CatalogSettings::class)
            ->assertOk()
            ->assertSchemaStateSet(['show_stock_quantity' => false]);
    }

    #[Test]
    public function saving_persists_the_toggle(): void
    {
        CatalogSetting::factory()->create(['show_stock_quantity' => true]);

        Livewire::test(CatalogSettings::class)
            ->fillForm(['show_stock_quantity' => false])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertFalse(CatalogSetting::current()->show_stock_quantity);
    }

    #[Test]
    public function saving_persists_the_delivery_fields(): void
    {
        CatalogSetting::factory()->create();

        Livewire::test(CatalogSettings::class)
            ->fillForm(['delivery_price' => 150_000, 'free_delivery_from' => 500_000])
            ->call('save')
            ->assertHasNoFormErrors();

        $settings = CatalogSetting::current();
        $this->assertSame(150_000, $settings->delivery_price);
        $this->assertSame(500_000, $settings->free_delivery_from);
    }
}
