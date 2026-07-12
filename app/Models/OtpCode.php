<?php

declare(strict_types=1);

namespace App\Models;

use App\Services\Auth\OtpService;
use Illuminate\Database\Eloquent\Model;

/**
 * A one-time SMS login code (stored hashed). Lifecycle is owned by
 * {@see OtpService}: issued → verified (consumed_at) or
 * expired; failed checks increment `attempts` until the row is dead.
 */
class OtpCode extends Model
{
    protected $fillable = [
        'phone',
        'code_hash',
        'attempts',
        'expires_at',
        'consumed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'attempts' => 'integer',
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }
}
