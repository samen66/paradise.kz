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
     * most 3 decimals, so `quantity * 1000` is exact, and working from that
     * milli-quantity against the integer `unit_cost` (тиын) never touches
     * floating point. A float multiply-then-round here disagrees with
     * MySQL's DECIMAL `round()` at the last digit for values like quantity
     * 0.820 × unit_cost 75 (exact product 61.5: MySQL rounds to 62,
     * `(float) '0.820' * 75` is 61.49999999999999, which rounds to 61).
     *
     * The milli-quantity is split into its whole and thousandths parts
     * rather than multiplied by `unit_cost` directly: at the validated
     * maxima (quantity 9999999.999, unit_cost 9999999999 тиын) the
     * milli-quantity times unit_cost is close to 1e20 — past PHP_INT_MAX
     * (~9.2e18) — even though the true line cost stays well within range.
     * `whole * unit_cost` is an integer, so adding the half-up rounding of
     * the thousandths remainder gives the same result as rounding the full
     * product, without ever forming that oversized intermediate value.
     */
    public function lineCost(): int
    {
        $milli = (int) round((float) $this->quantity * 1000);
        $unitCost = (int) $this->unit_cost;

        $whole = intdiv($milli, 1000);
        $thousandths = $milli % 1000;

        return $whole * $unitCost + intdiv($thousandths * $unitCost + 500, 1000);
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
