<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\GoodsReceipt;
use App\Models\Order;
use App\Models\StockMovement;
use App\Models\WriteOff;
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

    public function index(Request $request): JsonResponse
    {
        $movements = QueryBuilder::for(StockMovement::class)
            ->allowedFilters(
                AllowedFilter::exact('product_id'),
                AllowedFilter::exact('store_id'),
                AllowedFilter::exact('type'),
                AllowedFilter::callback('from', function ($query, $value): void {
                    $date = $this->parseDate($value)?->startOfDay();

                    if ($date === null) {
                        $query->whereRaw('1 = 0');

                        return;
                    }

                    $query->where('created_at', '>=', $date);
                }),
                AllowedFilter::callback('to', function ($query, $value): void {
                    $date = $this->parseDate($value)?->endOfDay();

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
            ->with(['store:id,name', 'product:id,name,code', 'user:id,name', 'documentable'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(50)
            ->appends($request->query())
            ->through(fn (StockMovement $movement): array => $this->present($movement));

        return response()->json($movements);
    }

    /**
     * Parses a date filter in the app timezone; an unparsable value is treated
     * the same way an unknown `document` kind is — the filter matches nothing
     * rather than letting a malformed query string 500.
     */
    private function parseDate(mixed $value): ?Carbon
    {
        try {
            return Carbon::parse((string) $value, config('app.timezone'));
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function present(StockMovement $movement): array
    {
        return [
            'id' => $movement->id,
            'created_at' => $movement->created_at,
            'type' => $movement->type,
            'qty_delta' => (float) $movement->qty_delta,
            'unit_cost' => $movement->unit_cost === null ? null : (int) $movement->unit_cost,
            'balance_after' => $movement->balance_after === null ? null : (float) $movement->balance_after,
            'note' => $movement->note,
            'store' => $movement->store?->only(['id', 'name']),
            'product' => $movement->product === null ? null : [
                'id' => $movement->product->id,
                'name' => $movement->product->getTranslations('name'),
                'code' => $movement->product->code,
            ],
            'user' => $movement->user?->only(['id', 'name']),
            'document' => $this->document($movement),
        ];
    }

    /**
     * @return array{type: string, id: int, label: string}|null
     */
    private function document(StockMovement $movement): ?array
    {
        $document = $movement->documentable;

        return match (true) {
            $document instanceof GoodsReceipt => ['type' => 'receipt', 'id' => $document->id, 'label' => 'Приёмка '.($document->number ?: '№'.$document->id)],
            $document instanceof WriteOff => ['type' => 'write_off', 'id' => $document->id, 'label' => $document->label()],
            $document instanceof Order => ['type' => 'order', 'id' => $document->id, 'label' => 'Заказ '.$document->number],
            default => null,
        };
    }
}
