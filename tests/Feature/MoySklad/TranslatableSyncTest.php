<?php

declare(strict_types=1);

namespace Tests\Feature\MoySklad;

use App\Jobs\Catalog\SyncProductsJob;
use App\Models\Product;
use App\Services\MoySklad\MoySkladService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * The ERP only supplies ru content; name/description are translatable JSON
 * columns. A re-sync must update the ru value without wiping admin-authored
 * kk translations (highest-risk touchpoint of the i18n migration).
 */
class TranslatableSyncTest extends TestCase
{
    use RefreshDatabase;

    private const BASE = 'https://api.moysklad.ru/api/remap/1.2';

    protected function setUp(): void
    {
        parent::setUp();

        config(['moysklad.token' => 'test-token']);
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function fakeAssortment(array $rows): void
    {
        Http::fake([
            self::BASE.'/entity/assortment*' => Http::response([
                'rows' => $rows,
                'meta' => ['size' => count($rows)],
            ]),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function productRow(string $id, string $name, string $description): array
    {
        return [
            'id' => $id,
            'name' => $name,
            'code' => 'C-'.$id,
            'article' => 'A-'.$id,
            'description' => $description,
            'salePrices' => [],
        ];
    }

    #[Test]
    public function a_resync_updates_ru_but_preserves_the_kk_translation(): void
    {
        $product = Product::factory()->erpSynced('prod-1')->create([
            'name' => 'Диван',
            'description' => 'Описание',
        ]);
        $product->setTranslation('name', 'kk', 'Диван (kk)');
        $product->setTranslation('description', 'kk', 'Сипаттама');
        $product->save();

        $this->fakeAssortment([$this->productRow('prod-1', 'Диван (новое имя)', 'Новое описание')]);

        (new SyncProductsJob)->handle(app(MoySkladService::class));

        $product = Product::query()->whereHas('externalMapping', fn($q) => $q->where('external_id', 'prod-1'))->firstOrFail();

        $this->assertSame('Диван (новое имя)', $product->getTranslation('name', 'ru'));
        $this->assertSame('Диван (kk)', $product->getTranslation('name', 'kk'));
        $this->assertSame('Новое описание', $product->getTranslation('description', 'ru'));
        $this->assertSame('Сипаттама', $product->getTranslation('description', 'kk'));
    }

    #[Test]
    public function a_brand_new_product_is_inserted_with_ru_translations(): void
    {
        $this->fakeAssortment([$this->productRow('prod-9', 'Новый товар', 'Описание нового')]);

        (new SyncProductsJob)->handle(app(MoySkladService::class));

        $product = Product::query()->whereHas('externalMapping', fn($q) => $q->where('external_id', 'prod-9'))->firstOrFail();

        $this->assertSame('Новый товар', $product->name);
        $this->assertSame(['ru' => 'Новый товар'], $product->getTranslations('name'));
    }
}
