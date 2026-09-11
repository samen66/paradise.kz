<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Actions\ApproveClient;
use App\Models\User;
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
    }

    #[Test]
    public function approval_works_with_no_erp_connected(): void
    {
        // The default provider. Approval is a local decision — it opens the
        // wholesale catalog for this client — so it must not depend on an
        // integration that isn't there.
        config()->set('erp.provider', 'local');
        Http::fake(); // any call would be unexpected

        $client = User::factory()->b2b()->create(['is_approved' => false]);

        app(ApproveClient::class)->handle($client);

        $this->assertTrue($client->fresh()->is_approved);
        $this->assertNull($client->fresh()->external_counterparty_id);
        Http::assertNothingSent();
    }
}
