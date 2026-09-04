<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory;

    public const STATUS_PENDING = 'pending';

    public const STATUS_SYNCED = 'synced';

    public const STATUS_FAILED = 'failed';

    public const STATUS_CONFIRMED = 'confirmed';

    public const STATUS_IN_DELIVERY = 'in_delivery';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    /**
     * The statuses a manager or customer can actually put an order in.
     *
     * `synced` and `failed` are legacy: they described an order's relationship
     * with an external accounting system that no longer exists. Historical rows
     * still carry them (so they stay in {@see ALL_STATUSES} for reads and
     * filters), but nothing may assign them any more.
     *
     * @var list<string>
     */
    public const CLIENT_STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_CONFIRMED,
        self::STATUS_IN_DELIVERY,
        self::STATUS_COMPLETED,
        self::STATUS_CANCELLED,
    ];

    /**
     * Every status that may appear in the database, legacy included.
     *
     * @var list<string>
     */
    public const ALL_STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_CONFIRMED,
        self::STATUS_IN_DELIVERY,
        self::STATUS_COMPLETED,
        self::STATUS_CANCELLED,
        self::STATUS_SYNCED,
        self::STATUS_FAILED,
    ];

    public const DELIVERY_PICKUP = 'pickup';

    public const DELIVERY_DELIVERY = 'delivery';

    protected $fillable = [
        'number',
        'user_id',
        'store_id',
        'status',
        'total',
        'comment',
        'contact_email',
        'payment_method',
        'payment_status',
        'delivery_method',
        'delivery_cost',
        'address_id',
        'delivery_city',
        'delivery_street',
        'delivery_building',
        'delivery_apartment',
        'delivery_comment',
        'source',
        'external_order_id',
        'external_number',
        'external_state',
        'error',
        'pushed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'total' => 'integer',
            'delivery_cost' => 'integer',
            'pushed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // Public, human-friendly order number (P-100001, ...): derived from
        // the id right after insert, shown to customers and used for guest
        // order tracking.
        static::created(function (Order $order): void {
            if ($order->number === null) {
                $order->number = 'P-'.(100_000 + $order->id);
                $order->saveQuietly();
            }
        });
    }

    public function isDelivery(): bool
    {
        return $this->delivery_method === self::DELIVERY_DELIVERY;
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<OrderItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * @return BelongsTo<Store, $this>
     */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * The saved address this order's delivery snapshot was copied from, if
     * any. May be null even for a delivery order (guest, or a one-off address
     * a B2B client typed without saving) or if the address was since deleted.
     *
     * @return BelongsTo<Address, $this>
     */
    public function address(): BelongsTo
    {
        return $this->belongsTo(Address::class);
    }
}
