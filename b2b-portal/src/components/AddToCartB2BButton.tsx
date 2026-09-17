import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { maxQuantityFor, useB2bCart } from '@/stores/useB2bCart';
import type { Product } from '@/lib/types';
import { useRouter } from 'next/navigation';

export function AddToCartB2BButton({ product }: { product: Product }) {
  const t = useTranslations('common');
  const minQty = product.b2b_min_order_qty || 1;
  // null: the API hides the stock quantity — the server still enforces it.
  const maxQty = maxQuantityFor(product);
  const [qty, setQty] = useState(maxQty === null ? minQty : Math.min(minQty, maxQty));
  const [notice, setNotice] = useState<string | null>(null);
  const { items, addItem, updateQuantity } = useB2bCart();
  const router = useRouter();

  const cartItem = items.find((i) => i.product?.id === product.id);

  if (!product.in_stock || (maxQty !== null && maxQty < minQty)) {
    return (
      <button disabled className="w-full py-4 rounded-xl bg-surface text-muted font-medium text-center border border-line cursor-not-allowed">
        Нет в наличии
      </button>
    );
  }

  const handleAdd = () => {
    const result = addItem(product, qty);

    if (result.status === 'limit') {
      setNotice(t('allInCart'));
      return;
    }

    router.push('/cart');
  };

  if (cartItem) {
    const atMax = maxQty !== null && cartItem.quantity >= maxQty;

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between border border-line rounded-xl p-2 bg-surface">
          <button
            onClick={() => updateQuantity(product.id, Math.max(minQty, cartItem.quantity - 1))}
            disabled={cartItem.quantity <= minQty}
            aria-label="−"
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white hover:bg-black/5 disabled:opacity-50 transition"
          >
            -
          </button>
          <span className="font-medium px-4">{cartItem.quantity} шт</span>
          <button
            onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
            disabled={atMax}
            aria-label="+"
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white hover:bg-black/5 disabled:opacity-50 transition"
          >
            +
          </button>
        </div>
        {atMax ? <p role="status" className="text-xs text-muted text-center">{t('maxInCart', { count: maxQty })}</p> : null}
        <button onClick={() => router.push('/cart')} className="w-full py-3 rounded-xl bg-ink text-white font-medium hover:bg-ink/90 transition">
          Оформить заказ
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-4 items-center">
      <div className="flex items-center justify-between border border-line rounded-xl p-1 bg-surface w-1/3">
        <button
          onClick={() => setQty(Math.max(minQty, qty - 1))}
          disabled={qty <= minQty}
          aria-label="−"
          className="w-12 h-12 flex items-center justify-center rounded-lg bg-white hover:bg-black/5 disabled:opacity-50 transition"
        >
          -
        </button>
        <span className="font-medium px-2">{qty}</span>
        <button
          onClick={() => setQty(qty + 1)}
          disabled={maxQty !== null && qty >= maxQty}
          aria-label="+"
          className="w-12 h-12 flex items-center justify-center rounded-lg bg-white hover:bg-black/5 disabled:opacity-50 transition"
        >
          +
        </button>
      </div>
      <div className="flex-1 flex flex-col">
        <button
          onClick={handleAdd}
          className="w-full py-4 rounded-xl bg-ink text-white font-medium hover:bg-ink/90 transition text-center"
        >
          В корзину
        </button>
        {minQty > 1 && (
          <p className="text-xs text-muted text-center mt-2">
            Минимальный заказ: {minQty} шт
          </p>
        )}
        {maxQty !== null && qty >= maxQty ? (
          <p role="status" className="text-xs text-muted text-center mt-1">{notice ?? t('maxInCart', { count: maxQty })}</p>
        ) : notice ? (
          <p role="status" className="text-xs text-muted text-center mt-1">{notice}</p>
        ) : null}
      </div>
    </div>
  );
}
