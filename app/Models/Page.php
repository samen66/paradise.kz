<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\PageFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Translatable\HasTranslations;

/**
 * A static storefront content page (about, delivery, contacts, ...) authored
 * in Filament. `body` is HTML from the rich editor; title/body/SEO fields are
 * translatable ({"ru": ..., "kk": ...}).
 */
class Page extends Model
{
    /** @use HasFactory<PageFactory> */
    use HasFactory;

    use HasTranslations;

    /** @var list<string> */
    public array $translatable = ['title', 'body', 'seo_title', 'seo_description'];

    protected $fillable = [
        'slug',
        'title',
        'body',
        'seo_title',
        'seo_description',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }
}
