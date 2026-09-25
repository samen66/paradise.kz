<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Models\Product;
use App\Models\ProductStoreStock;
use App\Support\ProductSearch;
use App\Support\ProductThumb;
use Illuminate\Database\Query\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Остатки по товару: одна строка на товар — итог по всем местам хранения или
 * по выбранному, стоимость запаса, статус «ok / low / out».
 *
 * Всё считается одним запросом: агрегат `product_store_stock` присоединяется
 * к товарам, статус — выражение CASE в SQL. Поэтому фильтр по статусу,
 * сортировка и счётчики чипов работают по всей выборке, а не по странице.
 * Составные товары своего остатка не имеют и в выборку не попадают; товар без
 * единой записи остатка — с нулём.
 *
 * Только чтение: остатки пишет FifoInventoryService.
 */
final class StockByProduct
{
    /** @var list<string> */
    public const STATUSES = ['low', 'out'];

    /** @var array<string, array{0: string, 1: string}> */
    private const SORTS = [
        'name' => ['name_ru', 'asc'],
        '-name' => ['name_ru', 'desc'],
        'stock' => ['on_hand', 'asc'],
        '-stock' => ['on_hand', 'desc'],
        'stock_value' => ['stock_value', 'asc'],
        '-stock_value' => ['stock_value', 'desc'],
    ];

    /**
     * @param  array{search?: ?string, store_id?: ?int, product_id?: ?int, status?: ?string, sort?: ?string}  $filters
     * @return array{page: LengthAwarePaginator, counts: array{all: int, low: int, out: int}, total_value: int}
     */
    public function list(array $filters, int $perPage = 50): array
    {
        $rows = $this->rows($filters);
        $status = $filters['status'] ?? null;

        if (in_array($status, self::STATUSES, true)) {
            $rows->where('stock_status', $status);
        }

        [$column, $direction] = self::SORTS[$filters['sort'] ?? ''] ?? self::SORTS['name'];

        $page = $rows->orderBy($column, $direction)->orderBy('id')->paginate($perPage);
        $this->present($page, $filters['store_id'] ?? null);

        return ['page' => $page, ...$this->totals($filters)];
    }

    /**
     * Счётчики статусов и стоимость запаса по фильтрам — без учёта статуса.
     *
     * @param  array{search?: ?string, store_id?: ?int, product_id?: ?int}  $filters
     * @return array{counts: array{all: int, low: int, out: int}, total_value: int}
     */
    public function totals(array $filters): array
    {
        $totals = $this->rows($filters)
            ->selectRaw('COUNT(*) as all_count')
            ->selectRaw("COALESCE(SUM(CASE WHEN stock_status = 'low' THEN 1 ELSE 0 END), 0) as low_count")
            ->selectRaw("COALESCE(SUM(CASE WHEN stock_status = 'out' THEN 1 ELSE 0 END), 0) as out_count")
            ->selectRaw('COALESCE(SUM(stock_value), 0) as total_value')
            ->first();

        return [
            'counts' => [
                'all' => (int) $totals->all_count,
                'low' => (int) $totals->low_count,
                'out' => (int) $totals->out_count,
            ],
            'total_value' => (int) round((float) $totals->total_value),
        ];
    }

    public function threshold(): float
    {
        return (float) config('inventory.low_stock_threshold');
    }

    /**
     * Производная таблица `stock_rows` (не `rows` — в MySQL 8 это зарезервированное слово):
     * id, name_ru, on_hand, stock_value, stock_status.
     *
     * @param  array{search?: ?string, store_id?: ?int, product_id?: ?int}  $filters
     */
    private function rows(array $filters): Builder
    {
        $storeId = $filters['store_id'] ?? null;

        $stock = DB::table('product_store_stock')
            ->select('product_id')
            ->selectRaw('SUM(stock) as qty')
            ->selectRaw('SUM(stock * COALESCE(avg_cost, 0)) as value')
            ->when($storeId, fn (Builder $query) => $query->where('store_id', $storeId))
            ->groupBy('product_id');

        $qty = 'COALESCE(stock_totals.qty, 0)';

        // The threshold is inlined as a numeric literal rather than bound as
        // `?`: PDO has no float parameter type, so a bound PHP float reaches
        // SQLite as TEXT. Compared against `on_hand` — itself a COALESCE()
        // result with no column affinity to coerce it — SQLite falls back to
        // storage-class ordering, where any TEXT outranks any INTEGER/REAL,
        // so `on_hand <= threshold` is true no matter the numbers and every
        // product with stock came back "low". `sprintf('%F')` keeps this a
        // trusted, locale-independent numeral (config, not user input), so
        // inlining it is safe. MySQL was never affected — it coerces
        // numeric-looking strings before comparing.
        $threshold = sprintf('%F', $this->threshold());

        $products = DB::table('products')
            ->leftJoinSub($stock, 'stock_totals', 'stock_totals.product_id', '=', 'products.id')
            ->where('products.is_composite', false)
            ->select('products.id', 'products.name->ru as name_ru')
            ->selectRaw("{$qty} as on_hand")
            ->selectRaw('COALESCE(stock_totals.value, 0) as stock_value')
            ->selectRaw(
                "CASE WHEN {$qty} <= 0 THEN 'out' WHEN {$qty} <= COALESCE(products.min_stock, {$threshold}) THEN 'low' ELSE 'ok' END as stock_status",
            )
            ->when($filters['product_id'] ?? null, fn (Builder $query, int $id) => $query->where('products.id', $id))
            ->when($filters['search'] ?? null, fn (Builder $query, string $search) => ProductSearch::apply($query, $search));

        return DB::query()->fromSub($products, 'stock_rows');
    }

    /**
     * Заменяет строки страницы на ответ API: товар, фото, разбивка по складам.
     */
    private function present(LengthAwarePaginator $page, ?int $storeId): void
    {
        $ids = collect($page->items())->pluck('id')->all();

        $products = Product::query()->with('media')->whereIn('id', $ids)->get()->keyBy('id');

        $stores = ProductStoreStock::query()
            ->with('store:id,name')
            ->whereIn('product_id', $ids)
            ->where('stock', '!=', 0)
            ->when($storeId, fn ($query) => $query->where('store_id', $storeId))
            ->orderBy('store_id')
            ->get()
            ->groupBy('product_id');

        $page->through(fn (object $row): array => $this->row(
            $row,
            $products[$row->id],
            $stores[$row->id] ?? collect(),
        ));
    }

    /**
     * @param  Collection<int, ProductStoreStock>  $stores
     * @return array<string, mixed>
     */
    private function row(object $row, Product $product, Collection $stores): array
    {
        $qty = (float) $row->on_hand;
        $value = (int) round((float) $row->stock_value);

        return [
            'id' => $product->id,
            'product' => [
                'id' => $product->id,
                'name' => $product->getTranslations('name'),
                'code' => $product->code,
                'article' => $product->article,
                'uom' => $product->uom,
                'thumb_url' => ProductThumb::url($product),
            ],
            'stock' => $qty,
            'min_stock' => $product->min_stock === null ? $this->threshold() : (float) $product->min_stock,
            'avg_cost' => $qty > 0 ? (int) round($value / $qty) : null,
            'stock_value' => $value,
            'status' => $row->stock_status,
            'stores' => $stores->map(fn (ProductStoreStock $stock): array => [
                'id' => $stock->store_id,
                'name' => $stock->store?->name,
                'stock' => (float) $stock->stock,
                'avg_cost' => $stock->avg_cost === null ? null : (int) $stock->avg_cost,
                'stock_value' => (int) round((float) $stock->stock * (int) ($stock->avg_cost ?? 0)),
            ])->values()->all(),
        ];
    }
}
