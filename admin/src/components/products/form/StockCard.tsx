import Link from 'next/link';
import { buttonLink } from '@/components/ui/styles';
import { formatQuantity } from '@/lib/text';
import { warehouseHref } from '@/lib/warehouse';
import FormCard from './FormCard';
import type { ApiProduct } from './formModel';

/** Остаток только для чтения: его двигают приёмки, заказы и списания (FifoInventoryService). */
export default function StockCard({ product, className }: { product: ApiProduct; className?: string }) {
  return (
    <FormCard id="stock" title="Остаток" className={className}>
      <p className="text-2xl font-semibold text-zinc-900" data-testid="stock-value">
        {formatQuantity(product.stock ?? 0)} {product.uom || 'шт'}
      </p>
      <p className="text-xs text-zinc-500">Меняется приёмками, заказами и списаниями</p>
      <div className="flex flex-wrap gap-x-4">
        <Link href={warehouseHref.stock} className={buttonLink}>По складам →</Link>
        <Link href={`${warehouseHref.movements}?product_id=${product.id}`} className={buttonLink}>Движения →</Link>
      </div>
    </FormCard>
  );
}
