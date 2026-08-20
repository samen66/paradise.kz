<?php

declare(strict_types=1);

namespace Tests\Feature\MoySklad;

use App\Jobs\Catalog\SyncProductImagesJob;
use App\Models\Product;
use App\Services\Catalog\Data\CatalogImage;
use App\Services\MoySklad\MoySkladClient;
use App\Services\MoySklad\MoySkladService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SyncProductImagesJobTest extends TestCase
{
    use RefreshDatabase;

    private const BASE = 'https://api.moysklad.ru/api/remap/1.2';

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake(config('media-library.disk_name'));
    }

    private function source(): MoySkladService
    {
        return new MoySkladService(new MoySkladClient(baseUrl: self::BASE, token: 'test-token'));
    }

    private function fakeDownloads(): void
    {
        // Real image bytes so Media Library conversions can run on a sync queue.
        $png = UploadedFile::fake()->image('x.png')->getContent();

        Http::fake(['*download*' => Http::response($png, 200)]);
    }

    private function image(string $id, int $size = 14052, ?string $updated = '2026-06-26 10:00:00.000'): CatalogImage
    {
        return new CatalogImage(
            id: $id,
            filename: $id.'.png',
            size: $size,
            updated: $updated,
            downloadHref: self::BASE.'/download/'.$id,
        );
    }

    #[Test]
    public function it_downloads_and_stores_new_images_with_custom_properties(): void
    {
        $this->fakeDownloads();
        $product = Product::factory()->erpSynced('prod-1')->create();

        (new SyncProductImagesJob('moysklad', 'prod-1', [$this->image('img-1'), $this->image('img-2')]))
            ->handle($this->source());

        $media = $product->fresh()->getMedia(Product::IMAGE_COLLECTION);

        $this->assertCount(2, $media);
        $this->assertEqualsCanonicalizing(
            ['img-1', 'img-2'],
            $media->map(fn ($m) => $m->getCustomProperty('external_image_id'))->all(),
        );
        $this->assertSame(14052, $media->first()->getCustomProperty('size'));
        $this->assertTrue(
            Storage::disk(config('media-library.disk_name'))->exists($media->first()->getPathRelativeToRoot()),
        );
        $downloads = collect(Http::recorded())->filter(fn ($r) => str_contains($r[0]->url(), 'download'))->count();
        $this->assertSame(2, $downloads);
    }

    #[Test]
    public function it_skips_unchanged_images_on_resync(): void
    {
        $this->fakeDownloads();
        $product = Product::factory()->erpSynced('prod-1')->create();

        (new SyncProductImagesJob('moysklad', 'prod-1', [$this->image('img-1')]))->handle($this->source());
        $firstMediaId = $product->fresh()->getMedia(Product::IMAGE_COLLECTION)->first()->id;

        // Identical image set → no delete, no re-download.
        (new SyncProductImagesJob('moysklad', 'prod-1', [$this->image('img-1')]))->handle($this->source());

        $media = $product->fresh()->getMedia(Product::IMAGE_COLLECTION);
        $this->assertCount(1, $media);
        $this->assertSame($firstMediaId, $media->first()->id, 'unchanged media must not be recreated');
        $downloads = collect(Http::recorded())->filter(fn ($r) => str_contains($r[0]->url(), 'download'))->count();
        $this->assertSame(1, $downloads);
    }

    #[Test]
    public function it_replaces_an_image_whose_size_changed(): void
    {
        $this->fakeDownloads();
        $product = Product::factory()->erpSynced('prod-1')->create();

        (new SyncProductImagesJob('moysklad', 'prod-1', [$this->image('img-1', size: 100)]))->handle($this->source());
        $firstMediaId = $product->fresh()->getMedia(Product::IMAGE_COLLECTION)->first()->id;

        (new SyncProductImagesJob('moysklad', 'prod-1', [$this->image('img-1', size: 200)]))->handle($this->source());

        $media = $product->fresh()->getMedia(Product::IMAGE_COLLECTION);
        $this->assertCount(1, $media);
        $this->assertNotSame($firstMediaId, $media->first()->id, 'stale media must be replaced');
        $this->assertSame(200, $media->first()->getCustomProperty('size'));
        $downloads = collect(Http::recorded())->filter(fn ($r) => str_contains($r[0]->url(), 'download'))->count();
        $this->assertSame(2, $downloads);
    }

    #[Test]
    public function it_deletes_media_for_images_removed_in_moysklad(): void
    {
        $this->fakeDownloads();
        $product = Product::factory()->erpSynced('prod-1')->create();

        (new SyncProductImagesJob('moysklad', 'prod-1', [$this->image('img-1'), $this->image('img-2')]))
            ->handle($this->source());

        // img-2 dropped upstream.
        (new SyncProductImagesJob('moysklad', 'prod-1', [$this->image('img-1')]))->handle($this->source());

        $media = $product->fresh()->getMedia(Product::IMAGE_COLLECTION);
        $this->assertCount(1, $media);
        $this->assertSame('img-1', $media->first()->getCustomProperty('external_image_id'));
    }

    #[Test]
    public function it_is_a_noop_when_the_product_is_missing(): void
    {
        $this->fakeDownloads();

        (new SyncProductImagesJob('moysklad', 'does-not-exist', [$this->image('img-1')]))->handle($this->source());

        $downloads = collect(Http::recorded())->filter(fn ($r) => str_contains($r[0]->url(), 'download'))->count();
        $this->assertSame(0, $downloads);
    }
}
