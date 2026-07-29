<?php

declare(strict_types=1);

namespace Tests\Feature\Public;

use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StoresTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_lists_active_stores(): void
    {
        Store::factory()->create(['name' => 'Active Store', 'is_active' => true]);
        Store::factory()->create(['name' => 'Inactive Store', 'is_active' => false]);

        $this->getJson('/api/public/stores')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Active Store');
    }
}
