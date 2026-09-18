import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { maxQuantityFor, useB2bCart } from '@/stores/useB2bCart';
import { QuantityInput } from '@/components/QuantityInput';
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
        <QuantityInput
          variant="boxed"
          value={cartItem.quantity}
          min={minQty}
          max={maxQty}
          onChange={(quantity) => updateQuantity(product.id, quantity)}
          label={t('quantityInCart')}
        />
        {atMax ? <p role="status" className="text-xs text-muted text-center">{t('maxInCart', { count: maxQty })}</p> : null}
        <button onClick={() => router.push('/cart')} className="w-full py-3 rounded-xl bg-ink text-white font-medium hover:bg-ink/90 transition">
          Оформить заказ
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-4 items-center">
      <QuantityInput
        variant="boxed"
        value={qty}
        min={minQty}
        max={maxQty}
        onChange={setQty}
        className="w-1/3 min-w-40"
      />
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
