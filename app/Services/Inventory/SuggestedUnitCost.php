<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\ProductStoreStock;

/**
 * Себестоимость, которую получает новая строка приёмки без `unit_cost`, и
 * которую «Подбор» показывает заранее: из последней проведённой приёмки
 * товара (любой склад, по `posted_at`), иначе средняя себестоимость товара
 * на складе документа, иначе 0. В тиынах.
 */
class SuggestedUnitCost
{
    public function for(int $productId, int $storeId): int
    {
        return $this->forMany([$productId], $storeId)[$productId];
    }

    /**
     * @param  list<int>  $productIds
     * @return array<int, int>
     */
    public function forMany(array $productIds, int $storeId): array
    {
        if ($productIds === []) {
            return [];
        }

        $costs = array_fill_keys($productIds, 0);

        $averages = ProductStoreStock::query()
            ->where('store_id', $storeId)
            ->whereIn('product_id', $productIds)
            ->whereNotNull('avg_cost')
            ->pluck('avg_cost', 'product_id');

        foreach ($averages as $productId => $cost) {
            $costs[(int) $productId] = (int) $cost;
        }

        /** Старые первыми: каждая следующая строка перезаписывает цену, последней остаётся самая свежая. */
        $posted = GoodsReceiptItem::query()
            ->join('goods_receipts', 'goods_receipts.id', '=', 'goods_receipt_items.goods_receipt_id')
            ->where('goods_receipts.status', GoodsReceipt::STATUS_POSTED)
            ->whereIn('goods_receipt_items.product_id', $productIds)
            ->orderBy('goods_receipts.posted_at')
            ->orderBy('goods_receipt_items.id')
            ->get(['goods_receipt_items.product_id', 'goods_receipt_items.unit_cost']);

        foreach ($posted as $line) {
            $costs[(int) $line->product_id] = (int) $line->unit_cost;
        }

        return $costs;
    }
}
