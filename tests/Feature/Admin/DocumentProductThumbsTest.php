<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\Store;
use App\Models\WriteOff;
use App\Models\WriteOffItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

/**
 * Фото товара в выборе и в строках документа: менеджер узнаёт товар по
 * картинке, а не только по названию и коду.
 */
class DocumentProductThumbsTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        Storage::fake(config('media-library.disk_name'));
        $this->actingAsManager();
    }

    private function withPhoto(Product $product): Product
    {
        $product->addMedia(UploadedFile::fake()->image('sofa.jpg', 200, 200))->toMediaCollection(Product::IMAGE_COLLECTION);

        return $product;
    }

    #[Test]
    public function the_picker_shows_the_first_photo(): void
    {
        $store = Store::factory()->create();
        $sofa = $this->withPhoto(Product::factory()->create(['name' => ['ru' => 'А диван']]));
        Product::factory()->create(['name' => ['ru' => 'Б без фото']]);

        $rows = $this->getJson("/api/admin/product-picker?store_id={$store->id}")->assertOk()->json('data');

        $this->assertSame($sofa->id, $rows[0]['id']);
        $this->assertIsString($rows[0]['thumb_url']);
        $this->assertStringContainsString('sofa', $rows[0]['thumb_url']);
        $this->assertNull($rows[1]['thumb_url']);
    }

    #[Test]
    public function receipt_lines_carry_the_product_photo(): void
    {
        $receipt = GoodsReceipt::factory()->create();
        $sofa = $this->withPhoto(Product::factory()->create());
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create(['product_id' => $sofa->id]);
        GoodsReceiptItem::factory()->for($receipt, 'goodsReceipt')->create();

        $lines = $this->getJson("/api/admin/goods-receipts/{$receipt->id}/items")->assertOk()->json('data');

        $this->assertIsString($lines[0]['product']['thumb_url']);
        $this->assertNull($lines[1]['product']['thumb_url']);
        $this->assertArrayNotHasKey('media', $lines[0]['product']);
    }

    #[Test]
    public function write_off_lines_carry_the_product_photo(): void
    {
        $writeOff = WriteOff::factory()->create();
        $sofa = $this->withPhoto(Product::factory()->create());
        WriteOffItem::factory()->for($writeOff, 'writeOff')->create(['product_id' => $sofa->id]);

        $this->getJson("/api/admin/write-offs/{$writeOff->id}/items")
            ->assertOk()
            ->assertJsonPath('data.0.available', 0);

        $line = $this->getJson("/api/admin/write-offs/{$writeOff->id}/items")->json('data.0');
        $this->assertIsString($line['product']['thumb_url']);
    }
}
