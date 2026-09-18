<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Banner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class BannerApiTest extends TestCase
{
    use ActsAsStaff;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpStaff();
        Storage::fake(config('media-library.disk_name'));
    }

    #[Test]
    public function only_staff_may_manage_banners(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/banners');
    }

    #[Test]
    public function it_creates_updates_filters_and_deletes_a_banner(): void
    {
        $this->actingAsManager();
        Banner::factory()->create(['title' => 'Магазин']);

        $id = $this->postJson('/api/admin/banners', [
            'placement' => Banner::PLACEMENT_B2B_HOME,
            'title' => ['ru' => 'Мебель для вашего магазина', 'kk' => 'Дүкеніңізге жиһаз'],
            'subtitle' => ['ru' => 'Оптом со склада в Алматы'],
            'url' => '/register',
            'sort_order' => 1,
            'is_active' => true,
        ])->assertCreated()->assertJsonPath('data.title.kk', 'Дүкеніңізге жиһаз')->json('data.id');

        $this->getJson('/api/admin/banners?placement='.Banner::PLACEMENT_B2B_HOME)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.image_url', null);

        $this->putJson("/api/admin/banners/{$id}", [
            'placement' => Banner::PLACEMENT_B2B_HOME,
            'title' => ['ru' => 'Новый заголовок'],
            'is_active' => false,
        ])->assertOk()->assertJsonPath('data.is_active', false);

        $banner = Banner::findOrFail($id);
        $this->assertSame('Новый заголовок', $banner->getTranslation('title', 'ru'));
        // Regression: PUT without subtitle should not wipe existing subtitle
        $this->assertSame('Оптом со склада в Алматы', $banner->getTranslation('subtitle', 'ru'));

        $this->deleteJson("/api/admin/banners/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('banners', ['id' => $id]);
    }

    #[Test]
    public function the_placement_must_be_a_known_slot(): void
    {
        $this->actingAsManager();

        $this->postJson('/api/admin/banners', ['placement' => 'sidebar'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('placement');
    }

    #[Test]
    public function an_image_is_uploaded_replaced_and_removed(): void
    {
        $this->actingAsManager();
        $banner = Banner::factory()->b2bHome()->create();

        $this->post("/api/admin/banners/{$banner->id}/image", ['file' => UploadedFile::fake()->image('a.jpg', 1920, 800)], ['Accept' => 'application/json'])
            ->assertOk();
        $this->post("/api/admin/banners/{$banner->id}/image", ['file' => UploadedFile::fake()->image('b.jpg', 1920, 800)], ['Accept' => 'application/json'])
            ->assertOk();

        $this->assertCount(1, $banner->fresh()->getMedia(Banner::IMAGE_COLLECTION));
        $this->assertNotNull($this->getJson('/api/admin/banners')->json('data.0.image_url'));

        $this->deleteJson("/api/admin/banners/{$banner->id}/image")->assertOk()->assertJsonPath('data.image_url', null);
        $this->assertCount(0, $banner->fresh()->getMedia(Banner::IMAGE_COLLECTION));
    }

    #[Test]
    public function only_images_are_accepted(): void
    {
        $this->actingAsManager();
        $banner = Banner::factory()->create();

        $this->post("/api/admin/banners/{$banner->id}/image", ['file' => UploadedFile::fake()->create('doc.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');
    }

    #[Test]
    public function clearing_one_locale_removes_only_that_translation(): void
    {
        $this->actingAsManager();

        $id = $this->postJson('/api/admin/banners', [
            'placement' => Banner::PLACEMENT_B2B_HOME,
            'subtitle' => ['ru' => 'Оптом со склада', 'kk' => 'Қоймадан көтерме'],
            'is_active' => true,
        ])->assertCreated()->json('data.id');

        $this->putJson("/api/admin/banners/{$id}", [
            'placement' => Banner::PLACEMENT_B2B_HOME,
            'subtitle' => ['ru' => 'Оптом со склада', 'kk' => ''],
            'is_active' => true,
        ])->assertOk()->assertJsonPath('data.subtitle', ['ru' => 'Оптом со склада']);

        $this->assertSame(['ru' => 'Оптом со склада'], Banner::findOrFail($id)->getTranslations('subtitle'));
    }

    #[Test]
    public function the_link_is_a_site_path_or_an_http_url(): void
    {
        $this->actingAsManager();

        foreach (['javascript:alert(1)', '//evil.example/login', 'catalog', 'ftp://files.example'] as $url) {
            $this->postJson('/api/admin/banners', ['placement' => Banner::PLACEMENT_HOME_HERO, 'url' => $url])
                ->assertUnprocessable()
                ->assertJsonPath('errors.url.0', 'Ссылка должна начинаться с «/» или с http(s)://.');
        }

        foreach (['/catalog', 'https://paradise.kz/sale', 'http://example.com'] as $url) {
            $this->postJson('/api/admin/banners', ['placement' => Banner::PLACEMENT_HOME_HERO, 'url' => $url])
                ->assertCreated();
        }
    }
}
