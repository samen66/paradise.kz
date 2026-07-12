<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\StockMovementFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * One line of the append-only stock ledger. On-hand quantity for a product at a
 * warehouse is the sum of its movements; product_store_stock caches that sum.
 */
class StockMovement extends Model
{
    /** @use HasFactory<StockMovementFactory> */
    use HasFactory;

    public const TYPE_RECEIPT = 'receipt';

    public const TYPE_SALE = 'sale';

    public const TYPE_RETURN = 'return';

    public const TYPE_TRANSFER_IN = 'transfer_in';

    public const TYPE_TRANSFER_OUT = 'transfer_out';

    public const TYPE_WRITE_OFF = 'write_off';

    public const TYPE_ADJUSTMENT = 'adjustment';

    public const TYPE_STOCKTAKE = 'stocktake';

    protected $fillable = [
        'store_id',
        'product_id',
        'batch_id',
        'qty_delta',
        'type',
        'unit_cost',
        'balance_after',
        'documentable_type',
        'documentable_id',
        'user_id',
        'note',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'qty_delta' => 'decimal:3',
            'unit_cost' => 'integer',
            'balance_after' => 'decimal:3',
        ];
    }

    /**
     * @return BelongsTo<Store, $this>
     */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return BelongsTo<Batch, $this>
     */
    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function documentable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
