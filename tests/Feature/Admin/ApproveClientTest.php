<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Actions\ApproveClient;
use App\Models\User;
use App\Services\MoySklad\Exceptions\MoySkladApiException;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ApproveClientTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        config()->set('moysklad.token', 'test-token');
    }

    #[Test]
    public function approving_creates_a_counterparty_and_flips_the_gate(): void
    {
        Http::fake([
            '*entity/counterparty' => Http::response(['id' => 'cp-123'], 200),
        ]);

        $client = User::factory()->b2b()->create(['is_approved' => false]);

        app(ApproveClient::class)->handle($client);

        $this->assertTrue($client->fresh()->is_approved);
        $this->assertSame('cp-123', $client->fresh()->external_counterparty_id);
    }

    #[Test]
    public function a_failed_counterparty_creation_blocks_approval(): void
    {
        Http::fake([
            '*entity/counterparty' => Http::response(['errors' => [['error' => 'Invalid BIN']]], 412),
        ]);

        $client = User::factory()->b2b()->create(['is_approved' => false]);

        $this->expectException(MoySkladApiException::class);

        try {
            app(ApproveClient::class)->handle($client);
        } finally {
            $this->assertFalse($client->fresh()->is_approved);
            $this->assertNull($client->fresh()->external_counterparty_id);
        }
    }

    #[Test]
    public function an_existing_counterparty_id_skips_the_api_call(): void
    {
        Http::fake(); // any call would be unexpected

        $client = User::factory()->b2b()->create([
            'is_approved' => false,
            'external_counterparty_id' => 'existing-cp',
        ]);

        app(ApproveClient::class)->handle($client);

        $this->assertTrue($client->fresh()->is_approved);
        Http::assertNothingSent();
    }
}
