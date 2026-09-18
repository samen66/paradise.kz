<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    /**
     * A B2B reseller (pending approval by default).
     */
    public function b2b(): static
    {
        return $this->state(fn (array $attributes) => [
            // Explicit (not just the column default): tests authenticate the
            // in-memory model via actingAs(), which never re-reads defaults.
            'type' => User::TYPE_B2B,
            'company_name' => fake()->company(),
            'company_bin' => (string) fake()->numerify('############'),
            'phone' => '+77'.fake()->unique()->numerify('#########'),
            'is_approved' => false,
        ])->afterCreating(function (User $user) {
            Role::findOrCreate('b2b_customer', 'web');
            $user->assignRole('b2b_customer');
        });
    }

    /**
     * An approved client.
     */
    public function approved(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_approved' => true,
        ]);
    }

    /**
     * A storefront (B2C) customer — the canonical account created by OTP login.
     */
    public function retail(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => User::TYPE_RETAIL,
            'phone' => '+77'.fake()->unique()->numerify('#########'),
            'is_approved' => true,
        ]);
    }

    /**
     * The throwaway per-order user row created by a guest checkout.
     */
    public function guest(): static
    {
        return $this->retail()->state(fn (array $attributes) => [
            'email' => 'guest-'.Str::uuid().'@guest.paradise.kz',
            'is_guest' => true,
        ]);
    }
}
