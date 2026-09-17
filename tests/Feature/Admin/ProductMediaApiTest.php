<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Jobs\RevalidateStorefrontCacheJob;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ProductMediaApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        Storage::fake(config('media-library.disk_name'));
    }

    private function upload(Product $product, string $name = 'sofa.jpg'): int
    {
        return $this->post(
            "/api/admin/products/{$product->id}/media",
            ['file' => UploadedFile::fake()->image($name)],
            ['Accept' => 'application/json'],
        )->assertCreated()->json('data.id');
    }

    #[Test]
    public function only_staff_may_manage_media(): void
    {
        $product = Product::factory()->create();

        $this->assertStaffOnly('GET', "/api/admin/products/{$product->id}/media");
    }

    #[Test]
    public function an_image_is_uploaded_listed_and_deleted(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();

        $id = $this->upload($product);

        $this->getJson("/api/admin/products/{$product->id}/media")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonStructure(['data' => [['id', 'file_name', 'url', 'thumb_url', 'order']]]);

        $this->getJson("/api/admin/products/{$product->id}")->assertJsonPath('data.images.0.id', $id);

        $this->deleteJson("/api/admin/products/{$product->id}/media/{$id}")->assertNoContent();
        $this->assertCount(0, $product->fresh()->getMedia(Product::IMAGE_COLLECTION));
    }

    #[Test]
    public function uploading_adds_rather_than_replaces(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();

        $this->upload($product, 'a.jpg');
        $this->upload($product, 'b.jpg');

        $this->assertCount(2, $product->fresh()->getMedia(Product::IMAGE_COLLECTION));
    }

    #[Test]
    public function only_images_within_the_size_limit_are_accepted(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();

        $this->post("/api/admin/products/{$product->id}/media", [
            'file' => UploadedFile::fake()->create('price.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');

        $this->post("/api/admin/products/{$product->id}/media", [
            'file' => UploadedFile::fake()->image('huge.jpg')->size(11_000),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');
    }

    #[Test]
    public function images_are_reordered(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $first = $this->upload($product, 'a.jpg');
        $second = $this->upload($product, 'b.jpg');

        $this->putJson("/api/admin/products/{$product->id}/media/order", ['ids' => [$second, $first]])
            ->assertOk()
            ->assertJsonPath('data.0.id', $second)
            ->assertJsonPath('data.1.id', $first);

        $this->assertSame($second, $product->fresh()->getFirstMedia(Product::IMAGE_COLLECTION)->id);
    }

    #[Test]
    public function reordering_must_name_exactly_the_products_images(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $other = Product::factory()->create();
        $mine = $this->upload($product);
        $foreign = $this->upload($other);

        $this->putJson("/api/admin/products/{$product->id}/media/order", ['ids' => [$mine, $foreign]])->assertUnprocessable();
        $this->putJson("/api/admin/products/{$product->id}/media/order", ['ids' => []])->assertUnprocessable();
    }

    #[Test]
    public function another_products_image_is_not_found(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $foreign = $this->upload(Product::factory()->create());

        $this->deleteJson("/api/admin/products/{$product->id}/media/{$foreign}")->assertNotFound();
    }

    #[Test]
    public function media_outside_the_image_collection_is_not_deleted(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $media = $product->addMedia(UploadedFile::fake()->image('doc.jpg'))->toMediaCollection('other');

        $this->deleteJson("/api/admin/products/{$product->id}/media/{$media->id}")->assertNotFound();
        $this->assertNotNull(Media::find($media->id));
    }

    #[Test]
    public function uploading_an_image_refreshes_the_storefront_cache(): void
    {
        Queue::fake();
        $this->actingAsManager();
        $product = Product::factory()->create();

        $this->upload($product);

        Queue::assertPushed(RevalidateStorefrontCacheJob::class);
    }

    #[Test]
    public function reordering_images_refreshes_the_storefront_cache(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $first = $this->upload($product, 'a.jpg');
        $second = $this->upload($product, 'b.jpg');

        Queue::fake();

        $this->putJson("/api/admin/products/{$product->id}/media/order", ['ids' => [$second, $first]])->assertOk();

        Queue::assertPushed(RevalidateStorefrontCacheJob::class);
    }

    #[Test]
    public function deleting_an_image_refreshes_the_storefront_cache(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $id = $this->upload($product);

        Queue::fake();

        $this->deleteJson("/api/admin/products/{$product->id}/media/{$id}")->assertNoContent();

        Queue::assertPushed(RevalidateStorefrontCacheJob::class);
    }
}
