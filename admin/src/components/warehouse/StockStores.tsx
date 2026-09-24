import { formatTenge } from '@/lib/money';
import { formatQty, type StockStoreRow } from '@/lib/warehouse';

/** Строка для карточки телефона: «Шоурум 4 · Рыскулова 8». */
export function StockStoresLine({ stores }: { stores: StockStoreRow[] }) {
  if (stores.length === 0) {
    return null;
  }

  return <span>{stores.map((s) => `${s.name ?? '—'} ${formatQty(s.stock)}`).join(' · ')}</span>;
}

/** Раскрытая строка таблицы на ПК: место хранения, остаток, себестоимость, стоимость. */
export function StockStoresTable({ stores, productName }: { stores: StockStoreRow[]; productName: string }) {
  return (
    <ul aria-label={`Места хранения: ${productName}`} className="space-y-1 text-sm text-zinc-600">
      {stores.map((s) => (
        <li key={s.id} className="grid grid-cols-[1fr_6rem_8rem_9rem] gap-4">
          <span>{s.name ?? '—'}</span>
          <span className="text-right">{formatQty(s.stock)}</span>
          <span className="text-right">{formatTenge(s.avg_cost)}</span>
          <span className="text-right">{formatTenge(s.stock_value)}</span>
        </li>
      ))}
    </ul>
  );
}
