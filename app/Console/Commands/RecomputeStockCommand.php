<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Product;
use App\Services\Inventory\FifoInventoryService;
use Illuminate\Console\Command;

/**
 * Rebuild every product's aggregate `products.stock` from the per-warehouse
 * balances in `product_store_stock`.
 *
 * Needed once, as a data repair: until the aggregate was wired into
 * {@see FifoInventoryService}, it was only ever recomputed by the ERP stock
 * sync. Every local receipt, sale and adjustment since then left it stale, so
 * the catalog could advertise stock that no warehouse actually held (and hide
 * stock that it did). Safe to re-run at any time — it is a pure projection.
 */
class RecomputeStockCommand extends Command
{
    protected $signature = 'stock:recompute {--chunk=500 : Products per update statement}';

    protected $description = 'Rebuild products.stock from the per-warehouse balances in product_store_stock';

    public function handle(): int
    {
        $chunk = max(1, (int) $this->option('chunk'));
        $total = Product::query()->count();

        if ($total === 0) {
            $this->info('Товаров нет — нечего пересчитывать.');

            return self::SUCCESS;
        }

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        Product::query()
            ->select('id')
            ->chunkById($chunk, function ($products) use ($bar): void {
                FifoInventoryService::recomputeAggregateStock($products->pluck('id')->all());
                $bar->advance($products->count());
            });

        $bar->finish();
        $this->newLine(2);

        $mismatched = Product::query()->where('stock', '<', 0)->count();

        if ($mismatched > 0) {
            $this->warn("Товаров с отрицательным остатком: {$mismatched}. Проверьте stock_movements.");
        }

        $this->info("Пересчитано товаров: {$total}.");

        return self::SUCCESS;
    }
}
