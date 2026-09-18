<?php

declare(strict_types=1);

namespace Tests\Feature\Migrations;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class NormalizeB2bUserPhonesTest extends TestCase
{
    use RefreshDatabase;

    private function runMigration(): void
    {
        (require database_path('migrations/2026_09_18_000001_normalize_b2b_user_phones.php'))->up();
    }

    /**
     * A client saved before the model normalized phones: the raw spelling
     * goes straight to the table, past the User::phone mutator.
     */
    private function legacyB2bClient(string $rawPhone): User
    {
        $client = User::factory()->b2b()->create();
        DB::table('users')->where('id', $client->id)->update(['phone' => $rawPhone]);

        return $client;
    }

    #[Test]
    public function b2b_phones_typed_by_hand_are_normalized(): void
    {
        $client = $this->legacyB2bClient('8 (707) 123-45-67');

        $this->runMigration();

        $this->assertSame('+77071234567', $client->refresh()->phone);
    }

    #[Test]
    public function a_number_already_taken_in_normalized_form_is_left_alone(): void
    {
        User::factory()->retail()->create(['phone' => '+77071234567']);
        $client = $this->legacyB2bClient('8 707 123 45 67');
        Log::spy();

        $this->runMigration();

        $this->assertSame('8 707 123 45 67', $client->refresh()->phone);
        Log::shouldHaveReceived('warning')->once()->withArgs(
            fn (string $message, array $context): bool => $context === ['user_id' => $client->id, 'phone' => '8 707 123 45 67'],
        );
    }
}
