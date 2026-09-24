<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

/**
 * «Мин. остаток» товара — порог, ниже которого товар попадает в
 * «Заканчивается». Пусто — действует общий порог из config/inventory.php.
 */
class ProductMinStockTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        $this->actingAsManager();
    }

    #[Test]
    public function it_saves_the_minimum_on_create_and_update(): void
    {
        $id = $this->postJson('/api/admin/products', [
            'name' => ['ru' => 'Стул Вена'],
            'min_stock' => '10',
        ])->assertCreated()->json('data.id');

        $this->assertSame('10.000', Product::find($id)->min_stock);

        $this->putJson("/api/admin/products/{$id}", [
            'name' => ['ru' => 'Стул Вена'],
            'min_stock' => '2.5',
        ])->assertOk();

        $this->assertSame('2.500', Product::find($id)->min_stock);
    }

    #[Test]
    public function a_blank_minimum_falls_back_to_the_default(): void
    {
        $product = Product::factory()->create(['min_stock' => 4]);

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Стул Вена'],
            'min_stock' => '',
        ])->assertOk();

        $this->assertNull($product->fresh()->min_stock);
    }

    #[Test]
    public function a_negative_minimum_is_rejected(): void
    {
        $product = Product::factory()->create();

        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => ['ru' => 'Стул Вена'],
            'min_stock' => '-1',
        ])->assertUnprocessable()->assertJsonValidationErrors('min_stock');
    }

    #[Test]
    public function the_product_card_carries_its_minimum_and_the_default(): void
    {
        config(['inventory.low_stock_threshold' => 3]);
        $product = Product::factory()->create(['min_stock' => 7]);

        $this->getJson("/api/admin/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.min_stock', '7.000')
            ->assertJsonPath('data.min_stock_default', 3);
    }
}
