<?php

declare(strict_types=1);

namespace App\Models;

use App\Services\Pricing\PricingService;
use Database\Factories\PriceTypeFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A local, admin-owned price list (e.g. "Розничная", "Оптовая"). Replaces the
 * two hardcoded price columns on {@see Product} with an open-ended set that
 * admins can extend without a migration. {@see PricingService}
 * resolves by the well-known codes "b2b" and "retail".
 */
class PriceType extends Model
{
    /** @use HasFactory<PriceTypeFactory> */
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'sort_order',
    ];

    /**
     * @return HasMany<ProductPrice, $this>
     */
    public function productPrices(): HasMany
    {
        return $this->hasMany(ProductPrice::class);
    }
}
