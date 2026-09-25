<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Models\Store;
use App\Models\WriteOff;
use App\Models\WriteOffItem;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class WriteOffItemApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_write_off_lines(): void
    {
        $writeOff = WriteOff::factory()->create();

        $this->assertStaffOnly('GET', "/api/admin/write-offs/{$writeOff->id}/items");
    }

    #[Test]
    public function lines_show_what_is_available_at_the_documents_store(): void
    {
        $this->actingAsManager();
        $store = Store::factory()->create();
        $elsewhere = Store::factory()->create();
        $product = Product::factory()->create();
        $inventory = app(FifoInventoryService::class);
        $inventory->receive($product, $store, 4, 10_000);
        $inventory->receive($product, $elsewhere, 9, 10_000);

        $writeOff = WriteOff::factory()->for($store, 'store')->create();

        $id = $this->postJson("/api/admin/write-offs/{$writeOff->id}/items", [
            'product_id' => $product->id,
            'quantity' => '1.5',
        ])->assertCreated()->assertJsonPath('data.product.id', $product->id)->json('data.id');

        $this->getJson("/api/admin/write-offs/{$writeOff->id}/items")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.available', 4);

        $this->putJson("/api/admin/write-offs/{$writeOff->id}/items/{$id}", ['quantity' => 2])->assertOk();
        $this->assertSame('2.000', WriteOffItem::findOrFail($id)->quantity);

        $this->deleteJson("/api/admin/write-offs/{$writeOff->id}/items/{$id}")->assertNoContent();
    }

    #[Test]
    public function a_product_never_received_there_has_nothing_available(): void
    {
        $this->actingAsManager();
        $writeOff = WriteOff::factory()->create();
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create();

        $this->getJson("/api/admin/write-offs/{$writeOff->id}/items")->assertJsonPath('data.0.available', 0);
    }

    #[Test]
    public function quantity_is_validated(): void
    {
        $this->actingAsManager();
        $writeOff = WriteOff::factory()->create();

        $this->postJson("/api/admin/write-offs/{$writeOff->id}/items", [
            'product_id' => Product::factory()->create()->id,
            'quantity' => -1,
        ])->assertUnprocessable()->assertJsonValidationErrors('quantity');
    }

    #[Test]
    public function lines_of_a_posted_write_off_are_frozen(): void
    {
        $this->actingAsManager();
        $writeOff = WriteOff::factory()->posted()->create();
        $item = WriteOffItem::factory()->for($writeOff, 'writeOff')->create();

        $this->postJson("/api/admin/write-offs/{$writeOff->id}/items", [
            'product_id' => Product::factory()->create()->id, 'quantity' => 1,
        ])->assertUnprocessable();
        $this->putJson("/api/admin/write-offs/{$writeOff->id}/items/{$item->id}", ['quantity' => 5])->assertUnprocessable();
        $this->deleteJson("/api/admin/write-offs/{$writeOff->id}/items/{$item->id}")->assertUnprocessable();
    }

    #[Test]
    public function another_write_offs_line_is_not_found(): void
    {
        $this->actingAsManager();
        $foreign = WriteOffItem::factory()->create();
        $writeOff = WriteOff::factory()->create();

        $this->deleteJson("/api/admin/write-offs/{$writeOff->id}/items/{$foreign->id}")->assertNotFound();
    }

    #[Test]
    public function a_write_off_line_needs_only_the_product_and_repeats_merge(): void
    {
        $this->actingAsManager();
        $writeOff = WriteOff::factory()->create();
        $product = Product::factory()->create();

        $id = $this->postJson("/api/admin/write-offs/{$writeOff->id}/items", ['product_id' => $product->id])
            ->assertCreated()
            ->assertJsonPath('data.quantity', '1.000')
            ->json('data.id');

        $this->postJson("/api/admin/write-offs/{$writeOff->id}/items", ['product_id' => $product->id, 'quantity' => '0.5'])
            ->assertOk()
            ->assertJsonPath('data.id', $id)
            ->assertJsonPath('data.quantity', '1.500');

        $this->assertSame(1, $writeOff->items()->count());
    }
}
