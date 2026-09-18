// Retail customers see an exact count only while stock runs low; above that
// it reads "Много". B2B partners always get the exact figure (ProductCard
// with isB2B, and the separate b2b-portal app).

/** From this quantity up, retail shows "Много" instead of the number. */
export const RETAIL_EXACT_STOCK_BELOW = 20;

export function isPlentiful(stock: number): boolean {
  return stock >= RETAIL_EXACT_STOCK_BELOW;
}

/**
 * "Много" or "7 шт." for a retail customer. `labels` come from the
 * `common.stockMany` / `common.stockPieces` messages.
 */
export function retailStockLabel(
  stock: number,
  labels: { many: string; pieces: (count: number) => string },
): string {
  return isPlentiful(stock) ? labels.many : labels.pieces(stock);
}
