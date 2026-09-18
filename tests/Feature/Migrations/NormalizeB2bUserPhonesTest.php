<?php

declare(strict_types=1);

namespace Tests\Feature\Migrations;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class NormalizeB2bUserPhonesTest extends TestCase
{
    use RefreshDatabase;

    private function runMigration(): void
    {
        (require database_path('migrations/2026_09_18_000001_normalize_b2b_user_phones.php'))->up();
    }

    #[Test]
    public function b2b_phones_typed_by_hand_are_normalized(): void
    {
        $client = User::factory()->b2b()->create(['phone' => '8 (707) 123-45-67']);

        $this->runMigration();

        $this->assertSame('+77071234567', $client->refresh()->phone);
    }

    #[Test]
    public function a_number_already_taken_in_normalized_form_is_left_alone(): void
    {
        User::factory()->retail()->create(['phone' => '+77071234567']);
        $client = User::factory()->b2b()->create(['phone' => '8 707 123 45 67']);

        $this->runMigration();

        $this->assertSame('8 707 123 45 67', $client->refresh()->phone);
    }
}
