<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\B2bHomeContent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Admin\Concerns\ActsAsStaff;
use Tests\TestCase;

class B2bHomeContentApiTest extends TestCase
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
    public function only_staff_may_edit_the_b2b_home(): void
    {
        $this->assertStaffOnly('GET', '/api/admin/b2b-home');
    }

    #[Test]
    public function the_about_block_is_read_and_saved(): void
    {
        $this->actingAsManager();

        $this->getJson('/api/admin/b2b-home')
            ->assertOk()
            ->assertJsonPath('data.about_title', [])
            ->assertJsonPath('data.image_url', null);

        $this->putJson('/api/admin/b2b-home', [
            'about_title' => ['ru' => 'Кто мы', 'kk' => 'Біз кімбіз'],
            'about_text' => ['ru' => 'Шоурум и склад в Алматы'],
        ])->assertOk()->assertJsonPath('data.about_title.kk', 'Біз кімбіз');

        $this->assertSame('Шоурум и склад в Алматы', B2bHomeContent::current()->getTranslation('about_text', 'ru'));
        $this->assertSame(1, B2bHomeContent::query()->count());
    }

    #[Test]
    public function the_russian_title_and_text_are_required(): void
    {
        $this->actingAsManager();

        $this->putJson('/api/admin/b2b-home', ['about_title' => ['kk' => 'Біз кімбіз']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['about_title.ru', 'about_text.ru']);
    }

    #[Test]
    public function the_about_photo_is_uploaded_and_removed(): void
    {
        $this->actingAsManager();

        $this->post('/api/admin/b2b-home/image', ['file' => UploadedFile::fake()->image('showroom.jpg', 1600, 1200)], ['Accept' => 'application/json'])
            ->assertOk();
        $this->assertNotNull($this->getJson('/api/admin/b2b-home')->json('data.image_url'));

        $this->deleteJson('/api/admin/b2b-home/image')->assertOk()->assertJsonPath('data.image_url', null);
    }

    #[Test]
    public function clearing_the_kazakh_text_removes_only_that_translation(): void
    {
        $this->actingAsManager();

        $this->putJson('/api/admin/b2b-home', [
            'about_title' => ['ru' => 'Кто мы'],
            'about_text' => ['ru' => 'Шоурум в Алматы', 'kk' => 'Алматыдағы шоурум'],
        ])->assertOk();

        $this->putJson('/api/admin/b2b-home', [
            'about_title' => ['ru' => 'Кто мы'],
            'about_text' => ['ru' => 'Шоурум в Алматы', 'kk' => ''],
        ])->assertOk()->assertJsonPath('data.about_text', ['ru' => 'Шоурум в Алматы']);

        $this->assertSame(['ru' => 'Шоурум в Алматы'], B2bHomeContent::current()->getTranslations('about_text'));
    }
}
