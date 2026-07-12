<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable([
    'name',
    'email',
    'type',
    'phone',
    'password',
    'company_name',
    'company_bin',
    'is_approved',
    'is_guest',
    'discount_percent',
    'external_counterparty_id',
    'preferred_store_id',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements FilamentUser
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    /** A wholesale reseller: approval-gated, sees B2B pricing/catalog. */
    public const TYPE_B2B = 'b2b';

    /** A guest checkout customer: auto-approved, sees only retail pricing. */
    public const TYPE_RETAIL = 'retail';

    /** Only staff (admin/manager) may enter the Filament admin panel. */
    public function canAccessPanel(Panel $panel): bool
    {
        return $this->hasAnyRole(['admin', 'manager']);
    }

    public function isRetail(): bool
    {
        return $this->type === self::TYPE_RETAIL;
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_approved' => 'boolean',
            'is_guest' => 'boolean',
            'discount_percent' => 'decimal:2',
        ];
    }

    /**
     * @return HasMany<ClientProductPrice, $this>
     */
    public function clientPrices(): HasMany
    {
        return $this->hasMany(ClientProductPrice::class);
    }

    /**
     * @return BelongsToMany<CatalogGroup, $this>
     */
    public function catalogGroups(): BelongsToMany
    {
        return $this->belongsToMany(CatalogGroup::class);
    }

    /**
     * @return HasMany<Order, $this>
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /**
     * @return HasMany<Address, $this>
     */
    public function addresses(): HasMany
    {
        return $this->hasMany(Address::class);
    }

    /**
     * Storefront wishlist.
     *
     * @return BelongsToMany<Product, $this>
     */
    public function favoriteProducts(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'favorites')->withTimestamps();
    }

    /**
     * @return BelongsTo<Store, $this>
     */
    public function preferredStore(): BelongsTo
    {
        return $this->belongsTo(Store::class, 'preferred_store_id');
    }
}
