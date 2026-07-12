<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\CatalogSettingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Single-row table of global catalog settings, edited from the Filament
 * "Catalog settings" page.
 */
class CatalogSetting extends Model
{
    /** @use HasFactory<CatalogSettingFactory> */
    use HasFactory;

    protected $fillable = [
        'show_stock_quantity',
        'delivery_price',
        'free_delivery_from',
        'contact_phone',
        'contact_email',
        'contact_address',
        'whatsapp_url',
        'instagram_url',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'show_stock_quantity' => 'boolean',
            'delivery_price' => 'integer',
            'free_delivery_from' => 'integer',
        ];
    }

    /**
     * The single settings row, created on first access with defaults.
     */
    public static function current(): self
    {
        return static::query()->firstOrCreate([]);
    }
}
