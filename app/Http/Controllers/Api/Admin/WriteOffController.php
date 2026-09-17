<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Admin\Concerns\RefusesPostedDocuments;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\WriteOffRequest;
use App\Models\StockMovement;
use App\Models\WriteOff;
use App\Services\Inventory\InsufficientStockException;
use App\Services\Inventory\WriteOffService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class WriteOffController extends Controller
{
    use RefusesPostedDocuments;

    public function index(Request $request): JsonResponse
    {
        $writeOffs = QueryBuilder::for(WriteOff::class)
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('store_id'),
                AllowedFilter::exact('reason'),
            )
            ->withCount('items')
            ->with('store:id,name')
            ->orderByDesc('id')
            ->paginate(20)
            ->appends($request->query());

        return response()->json($writeOffs);
    }

    public function store(WriteOffRequest $request): JsonResponse
    {
        $writeOff = WriteOff::create([...$request->validated(), 'status' => WriteOff::STATUS_DRAFT]);

        return response()->json(['data' => $this->present($writeOff)], 201);
    }

    public function show(WriteOff $writeOff): JsonResponse
    {
        return response()->json(['data' => $this->present($writeOff)]);
    }

    public function update(WriteOffRequest $request, WriteOff $writeOff): JsonResponse
    {
        return $this->whileDraft($writeOff, function (WriteOff $locked) use ($request): JsonResponse {
            $locked->update($request->validated());

            return response()->json(['data' => $this->present($locked)]);
        });
    }

    public function destroy(WriteOff $writeOff): JsonResponse
    {
        return $this->whileDraft($writeOff, function (WriteOff $locked): JsonResponse {
            $locked->delete();

            return response()->json(null, 204);
        });
    }

    public function post(Request $request, WriteOff $writeOff, WriteOffService $service): JsonResponse
    {
        try {
            $service->post($writeOff, $request->user());
        } catch (InsufficientStockException $exception) {
            return response()->json(['message' => sprintf(
                'Не хватает: %s — нужно %s, доступно %s.',
                $exception->product->getTranslation('name', 'ru'),
                $this->quantity($exception->requested),
                $this->quantity($exception->available),
            )], 422);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['data' => $this->present($writeOff)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(WriteOff $writeOff): array
    {
        $writeOff->load([
            'store:id,name',
            'user:id,name',
            'items' => fn ($query) => $query->orderBy('id'),
            'items.product:id,name,code,article',
        ]);

        return [
            ...$writeOff->toArray(),
            'label' => $writeOff->label(),
            'total_cost' => $writeOff->isPosted() ? $this->postedCost($writeOff) : null,
        ];
    }

    /** What the write-off cost, as the FIFO layers priced it when it was posted. */
    private function postedCost(WriteOff $writeOff): int
    {
        return (int) round((float) StockMovement::query()
            ->where('documentable_type', WriteOff::class)
            ->where('documentable_id', $writeOff->id)
            ->selectRaw('coalesce(sum(-qty_delta * unit_cost), 0) as cost')
            ->value('cost'));
    }

    /** 2.000 → "2", 1.500 → "1.5". */
    private function quantity(float $value): string
    {
        return rtrim(rtrim(number_format($value, 3, '.', ''), '0'), '.');
    }
}
