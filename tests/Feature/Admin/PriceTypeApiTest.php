<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\PriceType;
use App\Models\ProductPrice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class PriceTypeApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
    }

    #[Test]
    public function only_staff_may_manage_price_types(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/price-types');
    }

    #[Test]
    public function it_lists_price_types_in_sort_order(): void
    {
        $this->actingAsManager();
        PriceType::factory()->create(['code' => 'b', 'name' => 'Опт', 'sort_order' => 2]);
        PriceType::factory()->create(['code' => 'a', 'name' => 'Розница', 'sort_order' => 1]);

        $this->getJson('/api/admin/price-types')
            ->assertOk()
            ->assertJsonPath('data.0.code', 'a')
            ->assertJsonPath('data.1.code', 'b');
    }

    #[Test]
    public function it_creates_updates_and_deletes_a_price_type(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/price-types', ['code' => 'dealer', 'name' => 'Дилер', 'sort_order' => 3])
            ->assertCreated()->json('data.id');

        $this->putJson("/api/admin/price-types/{$id}", ['code' => 'dealer', 'name' => 'Дилерская', 'sort_order' => 4])
            ->assertOk()->assertJsonPath('data.name', 'Дилерская');

        $this->deleteJson("/api/admin/price-types/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('price_types', ['id' => $id]);
    }

    #[Test]
    public function updating_without_sort_order_keeps_it(): void
    {
        $this->actingAsManager();
        $priceType = PriceType::factory()->create(['sort_order' => 5]);

        $this->putJson("/api/admin/price-types/{$priceType->id}", [
            'code' => $priceType->code,
            'name' => 'Дилерская',
        ])->assertOk();

        $this->assertSame(5, $priceType->fresh()->sort_order);
    }

    #[Test]
    public function the_code_is_unique(): void
    {
        $this->actingAsManager();
        PriceType::factory()->create(['code' => 'dealer']);

        $this->postJson('/api/admin/price-types', ['code' => 'dealer', 'name' => 'Дилер'])
            ->assertUnprocessable()->assertJsonValidationErrors('code');
    }

    #[Test]
    public function a_price_type_with_prices_cannot_be_deleted(): void
    {
        $this->actingAsManager();
        $price = ProductPrice::factory()->create();

        $this->deleteJson("/api/admin/price-types/{$price->price_type_id}")->assertUnprocessable();
        $this->assertDatabaseHas('price_types', ['id' => $price->price_type_id]);
    }
}
