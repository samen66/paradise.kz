<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\GoodsReceiptItemFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GoodsReceiptItem extends Model
{
    /** @use HasFactory<GoodsReceiptItemFactory> */
    use HasFactory;

    protected $fillable = [
        'goods_receipt_id',
        'product_id',
        'quantity',
        'unit_cost',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'unit_cost' => 'integer',
        ];
    }

    /**
     * Cost of this line in kopecks (quantity × unit cost), rounded half-up.
     *
     * Computed in integer arithmetic rather than float: `quantity` has at
     * most 3 decimals, so `quantity * 1000` is exact, and multiplying that
     * against the integer `unit_cost` (тиын) before dividing back down never
     * touches floating point. A float multiply-then-round here disagrees
     * with MySQL's DECIMAL `round()` at the last digit for values like
     * quantity 0.820 × unit_cost 75 (exact product 61.5: MySQL rounds to 62,
     * `(float) '0.820' * 75` is 61.49999999999999, which rounds to 61).
     */
    public function lineCost(): int
    {
        $milliQuantity = (int) round((float) $this->quantity * 1000);

        return intdiv($milliQuantity * (int) $this->unit_cost + 500, 1000);
    }

    /**
     * @return BelongsTo<GoodsReceipt, $this>
     */
    public function goodsReceipt(): BelongsTo
    {
        return $this->belongsTo(GoodsReceipt::class);
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
