<?php

declare(strict_types=1);

namespace Tests\Unit\Models;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Every write path (Filament's user form included) stores the phone the way
 * SMS login looks it up: +7XXXXXXXXXX.
 */
class UserPhoneTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function a_phone_typed_by_hand_is_stored_normalized(): void
    {
        $user = User::factory()->b2b()->create(['phone' => '8 (707) 123-45-67']);

        $this->assertSame('+77071234567', $user->phone);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'phone' => '+77071234567']);
    }

    #[Test]
    public function an_already_normalized_phone_is_kept_as_is(): void
    {
        $user = User::factory()->create(['phone' => '+77071234567']);

        $this->assertSame('+77071234567', $user->phone);
    }

    #[Test]
    public function an_empty_phone_is_stored_as_null(): void
    {
        $user = User::factory()->create(['phone' => '+77071234567']);

        $user->update(['phone' => '']);
        $this->assertNull($user->fresh()->phone);

        $user->update(['phone' => null]);
        $this->assertNull($user->fresh()->phone);
    }
}
