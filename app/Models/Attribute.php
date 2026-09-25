<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\AttributeFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Translatable\HasTranslations;

/**
 * A structured product characteristic (e.g. "Материал", "Цвет корпуса"), the
 * catalog's own replacement for the free-form `products.attributes` JSON blob
 * mirrored from the ERP. Values are stored per product in {@see AttributeValue}.
 * name is {ru, kk}.
 */
class Attribute extends Model
{
    /** @use HasFactory<AttributeFactory> */
    use HasFactory;

    use HasTranslations;

    /** @var list<string> */
    public array $translatable = ['name'];

    protected $fillable = [
        'name',
        'slug',
        'is_filterable',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_filterable' => 'boolean',
        ];
    }

    /**
     * @return HasMany<AttributeValue, $this>
     */
    public function values(): HasMany
    {
        return $this->hasMany(AttributeValue::class);
    }
}
