import Link from 'next/link';
import { formatTenge } from '@/lib/money';
import { formatQuantity, plural, ru } from '@/lib/text';
import { cardClass } from '@/components/ui/styles';

type Props = { order: any };

/**
 * Состав заказа: что, почём, сколько и на какую сумму.
 *
 * Название и цена берутся из снимка в order_items — они не меняются вслед за
 * каталогом. Товар из каталога нужен только для фото, артикула и ссылки; если
 * его удалили, строка всё равно читается по снимку.
 */
export default function OrderItemsCard({ order }: Props) {
  const items: any[] = order.items ?? [];
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const itemsSubtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const deliveryCost = order.delivery_cost != null ? Number(order.delivery_cost) : null;
  const showDelivery = order.delivery_method === 'delivery' || (deliveryCost ?? 0) > 0;

  return (
    <div className={`${cardClass} overflow-hidden @container`}>
      <div className="px-6 py-4 border-b border-zinc-100 flex flex-wrap items-baseline gap-x-2">
        <h2 className="text-base font-semibold text-zinc-900">Состав заказа</h2>
        {items.length > 0 && (
          <span className="text-sm text-zinc-500">
            {items.length} {plural(items.length, ['позиция', 'позиции', 'позиций'])} · {formatQuantity(totalQuantity)} шт.
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="px-6 py-8 text-center text-zinc-400 text-sm">Позиции не найдены</div>
      ) : (
        <>
          <div className="hidden @2xl:grid grid-cols-[minmax(0,1fr)_7rem_5rem_8rem] gap-4 px-6 py-2 bg-zinc-50 border-b border-zinc-100 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <span>Товар</span>
            <span className="text-right">Цена</span>
            <span className="text-right">Кол-во</span>
            <span className="text-right">Сумма</span>
          </div>
          <ul className="divide-y divide-zinc-100">
            {items.map((item) => (
              <OrderItemRow key={item.id} item={item} />
            ))}
          </ul>
        </>
      )}

      <dl className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-600">Товары ({formatQuantity(totalQuantity)} шт.)</dt>
          <dd className="text-zinc-900 tabular-nums">{formatTenge(itemsSubtotal)}</dd>
        </div>
        {showDelivery && (
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Доставка</dt>
            <dd className="text-zinc-900 tabular-nums">{deliveryCost ? formatTenge(deliveryCost) : 'Бесплатно'}</dd>
          </div>
        )}
        <div className="flex justify-between items-baseline gap-4 pt-2 border-t border-zinc-200">
          <dt className="text-base font-semibold text-zinc-900">Итого</dt>
          <dd className="text-xl font-bold text-zinc-900 tabular-nums">{formatTenge(Number(order.total))}</dd>
        </div>
      </dl>
    </div>
  );
}

function OrderItemRow({ item }: { item: any }) {
  const product = item.product;
  const image = product?.media?.[0]?.original_url;
  const name = item.name || ru(product?.name) || '—';
  const sku = product?.article || product?.code;
  const price = Number(item.price);
  const quantity = formatQuantity(item.quantity);

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] @2xl:grid-cols-[minmax(0,1fr)_7rem_5rem_8rem] gap-x-4 gap-y-1 items-center px-6 py-4">
      <div className="flex items-center gap-4 min-w-0">
        {image ? (
          <img src={image} alt={name} className="w-16 h-16 object-cover rounded-lg border border-zinc-100 shrink-0" />
        ) : (
          <div className="w-16 h-16 bg-zinc-50 border border-zinc-100 rounded-lg flex items-center justify-center text-zinc-300 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
        )}
        <div className="min-w-0">
          {product ? (
            <Link href={`/products/${product.id}`} className="text-base font-medium text-zinc-900 hover:text-blue-700 hover:underline line-clamp-2">
              {name}
            </Link>
          ) : (
            <span className="text-base font-medium text-zinc-900 line-clamp-2">{name}</span>
          )}
          <div className="mt-0.5 text-sm text-zinc-500 truncate">
            {product ? (sku ? `Арт. ${sku}` : null) : <span className="text-amber-700">Товар удалён из каталога</span>}
          </div>
          {/* На узком экране цена и количество уходят под название. */}
          <div className="@2xl:hidden mt-1 text-sm text-zinc-700 tabular-nums">
            {quantity} шт. × {formatTenge(price)}
          </div>
        </div>
      </div>

      <div className="hidden @2xl:block text-right text-sm text-zinc-700 tabular-nums">
        {formatTenge(price)}
        <span className="block text-xs text-zinc-400">за шт.</span>
      </div>
      <div className="hidden @2xl:block text-right text-base text-zinc-900 tabular-nums">{quantity} шт.</div>
      <div className="text-right text-base font-semibold text-zinc-900 tabular-nums">{formatTenge(price * Number(item.quantity))}</div>
    </li>
  );
}
