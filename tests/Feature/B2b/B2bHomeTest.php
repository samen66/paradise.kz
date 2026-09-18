<?php

declare(strict_types=1);

namespace Tests\Feature\B2b;

use App\Models\B2bHomeContent;
use App\Models\Banner;
use App\Models\CatalogGroup;
use App\Models\Product;
use App\Models\ProductCollection;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class B2bHomeTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_is_open_without_a_token_and_lists_only_active_b2b_banners(): void
    {
        Banner::factory()->b2bHome()->create(['title' => 'Второй', 'sort_order' => 2]);
        Banner::factory()->b2bHome()->create(['title' => 'Первый', 'sort_order' => 1]);
        Banner::factory()->b2bHome()->inactive()->create(['title' => 'Скрытый']);
        Banner::factory()->create(['title' => 'Магазин']);

        $response = $this->getJson('/api/b2b/home')->assertOk();

        $this->assertSame(['Первый', 'Второй'], collect($response->json('data.banners'))->pluck('title')->all());
    }

    #[Test]
    public function collections_are_the_active_ones_flagged_for_b2b_home(): void
    {
        ProductCollection::factory()->onB2bHome()->create(['title' => 'Лофт', 'description' => 'Металл и дерево']);
        ProductCollection::factory()->onB2bHome()->inactive()->create(['title' => 'Черновик']);
        ProductCollection::factory()->create(['title' => 'Хиты']);

        $response = $this->getJson('/api/b2b/home')->assertOk();

        $response->assertJsonCount(1, 'data.collections')
            ->assertJsonPath('data.collections.0.title', 'Лофт')
            ->assertJsonPath('data.collections.0.description', 'Металл и дерево')
            ->assertJsonPath('data.collections.0.cover', null);
    }

    #[Test]
    public function products_come_without_prices_and_only_from_the_public_catalog(): void
    {
        $collection = ProductCollection::factory()->onB2bHome()->create();
        $visible = Product::factory()->create(['b2b_price' => 200_000, 'retail_price' => 250_000]);
        $restricted = Product::factory()->create();
        $restricted->catalogGroups()->attach(CatalogGroup::factory()->create());
        $collection->products()->attach([$visible->id => ['sort_order' => 1], $restricted->id => ['sort_order' => 2]]);

        $response = $this->getJson('/api/b2b/home')->assertOk();

        $this->assertSame([$visible->id], collect($response->json('data.collections.0.products'))->pluck('id')->all());

        $product = $response->json('data.collections.0.products.0');
        foreach (['price', 'old_price', 'stock', 'in_stock', 'showrooms'] as $key) {
            $this->assertArrayNotHasKey($key, $product);
        }
    }

    #[Test]
    public function about_is_null_until_filled_in_and_then_returned(): void
    {
        $this->getJson('/api/b2b/home')->assertOk()->assertJsonPath('data.about', null);

        B2bHomeContent::current()->update([
            'about_title' => ['ru' => 'Кто мы'],
            'about_text' => ['ru' => 'Шоурум и склад в Алматы'],
        ]);

        $this->getJson('/api/b2b/home')
            ->assertOk()
            ->assertJsonPath('data.about.title', 'Кто мы')
            ->assertJsonPath('data.about.text', 'Шоурум и склад в Алматы')
            ->assertJsonPath('data.about.image', null);
    }

    #[Test]
    public function photos_fall_back_to_the_original_until_the_conversions_exist(): void
    {
        Storage::fake(config('media-library.disk_name'));
        // Conversions are queued; with the queue faked none is generated.
        Queue::fake();

        $banner = Banner::factory()->b2bHome()->create();
        $banner->addMedia(UploadedFile::fake()->image('hero.jpg', 1920, 800))->toMediaCollection(Banner::IMAGE_COLLECTION);
        $collection = ProductCollection::factory()->onB2bHome()->create();
        $collection->addMedia(UploadedFile::fake()->image('loft.jpg', 1600, 900))->toMediaCollection(ProductCollection::COVER_COLLECTION);
        $content = B2bHomeContent::current();
        $content->update(['about_title' => ['ru' => 'Кто мы']]);
        $content->addMedia(UploadedFile::fake()->image('showroom.jpg', 1600, 1200))->toMediaCollection(B2bHomeContent::ABOUT_IMAGE_COLLECTION);

        $this->assertFalse($banner->getFirstMedia(Banner::IMAGE_COLLECTION)->hasGeneratedConversion('wide'));
        $bannerUrl = $banner->getFirstMedia(Banner::IMAGE_COLLECTION)->getUrl();
        $coverUrl = $collection->getFirstMedia(ProductCollection::COVER_COLLECTION)->getUrl();

        $this->getJson('/api/b2b/home')
            ->assertOk()
            ->assertJsonPath('data.banners.0.image', $bannerUrl)
            ->assertJsonPath('data.banners.0.image_mobile', $bannerUrl)
            ->assertJsonPath('data.collections.0.cover', $coverUrl)
            ->assertJsonPath('data.collections.0.cover_card', $coverUrl)
            ->assertJsonPath('data.about.image', $content->getFirstMedia(B2bHomeContent::ABOUT_IMAGE_COLLECTION)->getUrl());
    }

    #[Test]
    public function collection_products_load_their_external_mapping_in_one_query(): void
    {
        $collection = ProductCollection::factory()->onB2bHome()->create();
        $collection->products()->attach(Product::factory()->count(3)->create()->pluck('id'));

        $mappingQueries = 0;
        DB::listen(function (QueryExecuted $query) use (&$mappingQueries): void {
            if (str_contains($query->sql, 'product_external_mappings')) {
                $mappingQueries++;
            }
        });

        $this->getJson('/api/b2b/home')->assertOk()->assertJsonCount(3, 'data.collections.0.products');

        $this->assertSame(1, $mappingQueries);
    }
}
