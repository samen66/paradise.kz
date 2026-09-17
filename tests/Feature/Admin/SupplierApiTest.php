<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class SupplierApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_suppliers(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/suppliers');
    }

    #[Test]
    public function it_lists_and_searches_suppliers_by_name_or_bin(): void
    {
        $this->actingAsManager();
        Supplier::factory()->create(['name' => 'ТОО Мебель', 'bin' => '111111111111']);
        Supplier::factory()->create(['name' => 'ИП Диваны', 'bin' => '222222222222']);

        $this->getJson('/api/admin/suppliers')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'ИП Диваны');

        // PHP's parse_url() corrupts raw multibyte UTF-8 in a query string
        // (mb_internal_encoding does not help), so the Cyrillic term is
        // percent-encoded here; the assertion is unchanged.
        $this->getJson('/api/admin/suppliers?filter[search]='.rawurlencode('Мебель'))->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/suppliers?filter[search]=2222')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'ИП Диваны');
    }

    #[Test]
    public function it_creates_updates_partially_and_deletes_a_supplier(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/suppliers', [
            'name' => 'ТОО Мебель',
            'bin' => '123456789012',
            'phone' => '+77010000000',
            'email' => 'sales@mebel.kz',
            'note' => 'Оплата по факту',
            'is_active' => true,
        ])->assertCreated()->json('data.id');

        $this->putJson("/api/admin/suppliers/{$id}", ['name' => 'ТОО Мебель-Про'])
            ->assertOk()
            ->assertJsonPath('data.name', 'ТОО Мебель-Про')
            ->assertJsonPath('data.bin', '123456789012');

        $this->deleteJson("/api/admin/suppliers/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('suppliers', ['id' => $id]);
    }

    #[Test]
    public function name_is_required_and_email_must_be_valid(): void
    {
        $this->actingAsManager();

        $this->postJson('/api/admin/suppliers', ['name' => '', 'email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email']);
    }

    #[Test]
    public function a_supplier_with_receipts_cannot_be_deleted(): void
    {
        $this->actingAsManager();
        $receipt = GoodsReceipt::factory()->create();

        $this->deleteJson("/api/admin/suppliers/{$receipt->supplier_id}")
            ->assertUnprocessable()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseHas('suppliers', ['id' => $receipt->supplier_id]);
    }
}
