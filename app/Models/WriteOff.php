<?php

declare(strict_types=1);

namespace App\Models;

use App\Services\Inventory\WriteOffService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A write-off document: goods leaving a warehouse without a sale (damaged,
 * lost, regraded). A draft is edited freely; posting it through
 * {@see WriteOffService} issues the lines from the
 * FIFO layers as `write_off` movements and freezes the document.
 */
class WriteOff extends Model
{
    use HasFactory;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_POSTED = 'posted';

    /**
     * @var list<string>
     */
    public const REASONS = ['damaged', 'lost', 'regrading', 'other'];

    protected $fillable = [
        'store_id',
        'reason',
        'note',
        'status',
        'posted_at',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'posted_at' => 'datetime',
        ];
    }

    public function isPosted(): bool
    {
        return $this->status === self::STATUS_POSTED;
    }

    public function label(): string
    {
        return 'Списание №'.$this->id;
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(WriteOffItem::class);
    }
}
