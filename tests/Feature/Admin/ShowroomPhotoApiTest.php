<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Jobs\RevalidateStorefrontCacheJob;
use App\Models\Product;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class ShowroomPhotoApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    private Store $showroom;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        Storage::fake(config('media-library.disk_name'));
        Queue::fake();
        $this->showroom = Store::factory()->showroom()->create();
    }

    private function upload(string $name = 'hall.jpg'): int
    {
        return $this->post(
            "/api/admin/showrooms/{$this->showroom->id}/photos",
            ['file' => UploadedFile::fake()->image($name)],
            ['Accept' => 'application/json'],
        )->assertCreated()->json('data.id');
    }

    #[Test]
    public function only_staff_may_manage_photos(): void
    {
        $this->assertStaffOnly('GET', "/api/admin/showrooms/{$this->showroom->id}/photos");
    }

    #[Test]
    public function photos_are_uploaded_listed_reordered_and_deleted(): void
    {
        $this->actingAsManager();
        $first = $this->upload('a.jpg');
        $second = $this->upload('b.jpg');

        $this->getJson("/api/admin/showrooms/{$this->showroom->id}/photos")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [['id', 'file_name', 'url', 'thumb_url', 'order']]]);

        $this->putJson("/api/admin/showrooms/{$this->showroom->id}/photos/order", ['ids' => [$second, $first]])
            ->assertOk()
            ->assertJsonPath('data.0.id', $second);

        $this->deleteJson("/api/admin/showrooms/{$this->showroom->id}/photos/{$first}")->assertNoContent();
        $this->assertCount(1, $this->showroom->fresh()->getMedia(Store::PHOTOS_COLLECTION));

        Queue::assertPushed(RevalidateStorefrontCacheJob::class, 4);
    }

    #[Test]
    public function the_order_must_list_exactly_the_showroom_photos(): void
    {
        $this->actingAsManager();
        $id = $this->upload();

        $this->putJson("/api/admin/showrooms/{$this->showroom->id}/photos/order", ['ids' => [$id, 999]])
            ->assertUnprocessable();
    }

    #[Test]
    public function only_images_within_the_size_limit_are_accepted(): void
    {
        $this->actingAsManager();

        $this->post("/api/admin/showrooms/{$this->showroom->id}/photos", [
            'file' => UploadedFile::fake()->create('plan.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');

        $this->post("/api/admin/showrooms/{$this->showroom->id}/photos", [
            'file' => UploadedFile::fake()->image('huge.jpg')->size(11_000),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');
    }

    #[Test]
    public function a_showroom_holds_at_most_twenty_photos(): void
    {
        $this->actingAsManager();

        for ($i = 0; $i < Store::MAX_PHOTOS; $i++) {
            $this->showroom->addMedia(UploadedFile::fake()->image("p{$i}.jpg"))->toMediaCollection(Store::PHOTOS_COLLECTION);
        }

        $this->post("/api/admin/showrooms/{$this->showroom->id}/photos", [
            'file' => UploadedFile::fake()->image('one-more.jpg'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');
    }

    #[Test]
    public function a_photo_of_something_else_is_not_found(): void
    {
        $this->actingAsManager();
        $product = Product::factory()->create();
        $foreign = $product->addMedia(UploadedFile::fake()->image('sofa.jpg'))->toMediaCollection(Product::IMAGE_COLLECTION);

        $this->deleteJson("/api/admin/showrooms/{$this->showroom->id}/photos/{$foreign->id}")->assertNotFound();
        $this->assertCount(1, $product->fresh()->getMedia(Product::IMAGE_COLLECTION));
    }

    #[Test]
    public function a_warehouse_has_no_showroom_photos(): void
    {
        $this->actingAsManager();
        $warehouse = Store::factory()->create(['type' => 'warehouse']);

        $this->getJson("/api/admin/showrooms/{$warehouse->id}/photos")->assertNotFound();
    }
}
