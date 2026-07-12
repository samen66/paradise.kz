<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\ProductVisibilityOverrideFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductVisibilityOverride extends Model
{
    /** @use HasFactory<ProductVisibilityOverrideFactory> */
    use HasFactory;

    public const MODE_ALLOW = 'allow';

    public const MODE_HIDE = 'hide';

    protected $fillable = [
        'user_id',
        'product_id',
        'mode',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
