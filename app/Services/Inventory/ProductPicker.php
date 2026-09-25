<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Models\Product;
use App\Services\Catalog\CategoryTree;
use App\Support\ProductSearch;
use App\Support\ProductThumb;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\DB;

/**
 * Товары для строки поиска и «Подбора» в приёмке и списании: остаток на
 * складе документа и себестоимость, которую получит новая строка.
 */
class ProductPicker
{
    public const PER_PAGE = 30;

    public function __construct(
        private readonly CategoryTree $categories,
        private readonly SuggestedUnitCost $costs,
    ) {}

    /**
     * @param  array{search?: ?string, category_id?: ?int, recent?: bool, in_stock?: bool}  $filters
     */
    public function list(int $storeId, array $filters): LengthAwarePaginator
    {
        $onHand = 'COALESCE(store_stock.stock, 0)';

        $query = DB::table('products')
            ->leftJoin('product_store_stock as store_stock', function (JoinClause $join) use ($storeId): void {
                $join->on('store_stock.product_id', '=', 'products.id')
                    ->where('store_stock.store_id', '=', $storeId);
            })
            ->where('products.is_composite', false)
            ->select('products.id', 'products.name->ru as name_ru')
            ->selectRaw("{$onHand} as on_hand")
            ->when($filters['search'] ?? null, fn (Builder $query, string $search) => ProductSearch::apply($query, $search))
            ->when($filters['category_id'] ?? null, fn (Builder $query, int $categoryId) => $query->whereIn(
                'products.category_id',
                $this->categories->subtreeIds((string) $categoryId),
            ))
            ->when($filters['in_stock'] ?? false, fn (Builder $query) => $query->whereRaw("{$onHand} > 0"));

        if ($filters['recent'] ?? false) {
            $recent = DB::table('goods_receipt_items')
                ->join('goods_receipts', 'goods_receipts.id', '=', 'goods_receipt_items.goods_receipt_id')
                ->where('goods_receipts.store_id', $storeId)
                ->groupBy('goods_receipt_items.product_id')
                ->select('goods_receipt_items.product_id')
                ->selectRaw('MAX(goods_receipts.received_at) as last_received_at')
                ->selectRaw('MAX(goods_receipts.id) as last_receipt_id');

            $query->joinSub($recent, 'recent', 'recent.product_id', '=', 'products.id')
                ->orderByDesc('recent.last_received_at')
                ->orderByDesc('recent.last_receipt_id');
        } else {
            $query->orderBy('name_ru');
        }

        $page = $query->orderBy('products.id')->paginate(self::PER_PAGE);

        $this->present($page, $storeId);

        return $page;
    }

    /**
     * Заменяет строки страницы на ответ API.
     */
    private function present(LengthAwarePaginator $page, int $storeId): void
    {
        $ids = collect($page->items())->map(fn (object $row): int => (int) $row->id)->all();

        $products = Product::query()->with('media')->whereIn('id', $ids)->get(['id', 'name', 'code', 'article', 'uom'])->keyBy('id');
        $costs = $this->costs->forMany($ids, $storeId);

        $page->through(function (object $row) use ($products, $costs): array {
            $product = $products[(int) $row->id];

            return [
                'id' => $product->id,
                'name' => $product->getTranslations('name'),
                'code' => $product->code,
                'article' => $product->article,
                'uom' => $product->uom,
                'thumb_url' => ProductThumb::url($product),
                'on_hand' => (float) $row->on_hand,
                'suggested_unit_cost' => $costs[$product->id],
            ];
        });
    }
}
