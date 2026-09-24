<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\GoodsReceipt;
use App\Models\Order;
use App\Models\StockMovement;
use App\Models\WriteOff;
use App\Services\Inventory\StockMovementPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * The stock ledger, read-only: where every on-hand number came from.
 */
class StockMovementController extends Controller
{
    /**
     * Document kinds the admin links to, keyed by the name the API uses.
     *
     * @var array<string, class-string>
     */
    private const DOCUMENTS = [
        'receipt' => GoodsReceipt::class,
        'write_off' => WriteOff::class,
        'order' => Order::class,
    ];

    public function index(Request $request, StockMovementPresenter $presenter): JsonResponse
    {
        $movements = QueryBuilder::for(StockMovement::class)
            ->allowedFilters(
                AllowedFilter::exact('product_id'),
                AllowedFilter::exact('store_id'),
                AllowedFilter::exact('type'),
                AllowedFilter::callback('from', function ($query, $value): void {
                    $date = $this->parseBoundary($value, end: false);

                    if ($date === null) {
                        $query->whereRaw('1 = 0');

                        return;
                    }

                    $query->where('created_at', '>=', $date);
                }),
                AllowedFilter::callback('to', function ($query, $value): void {
                    $date = $this->parseBoundary($value, end: true);

                    if ($date === null) {
                        $query->whereRaw('1 = 0');

                        return;
                    }

                    $query->where('created_at', '<=', $date);
                }),
                AllowedFilter::callback('document', function ($query, $value): void {
                    [$kind, $id] = array_pad(explode(':', (string) $value, 2), 2, null);
                    $class = self::DOCUMENTS[$kind] ?? null;

                    if ($class === null || ! ctype_digit((string) $id)) {
                        $query->whereRaw('1 = 0');

                        return;
                    }

                    $query->where('documentable_type', $class)->where('documentable_id', (int) $id);
                }),
            )
            ->with(StockMovementPresenter::RELATIONS)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(50)
            ->appends($request->query())
            ->through(fn (StockMovement $movement): array => $presenter->present($movement));

        return response()->json($movements);
    }

    /**
     * Parses a `from`/`to` filter value. A bare `YYYY-MM-DD` — what an
     * `<input type="date">` sends — is anchored to the start/end of that
     * calendar day in the app timezone (UTC), matching the previous
     * behaviour. Anything else is treated as an exact instant (e.g. an ISO
     * string with an offset, as the admin frontend now sends so that "17.09"
     * means the manager's Almaty day, not the UTC day) and parsed with no
     * day-rounding. An unparsable value is treated the same way an unknown
     * `document` kind is — the filter matches nothing rather than letting a
     * malformed query string 500.
     */
    private function parseBoundary(mixed $value, bool $end): ?Carbon
    {
        $value = (string) $value;

        try {
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1) {
                $date = Carbon::parse($value, config('app.timezone'));

                return $end ? $date->endOfDay() : $date->startOfDay();
            }

            return Carbon::parse($value)->utc();
        } catch (\Throwable) {
            return null;
        }
    }
}
