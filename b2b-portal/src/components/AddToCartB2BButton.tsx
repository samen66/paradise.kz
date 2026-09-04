import React, { useState } from 'react';
import { useB2bCart } from '@/stores/useB2bCart';
import type { Product } from '@/lib/types';
import { useRouter } from 'next/navigation';

export function AddToCartB2BButton({ product }: { product: Product }) {
  const minQty = product.b2b_min_order_qty || 1;
  const [qty, setQty] = useState(minQty);
  const { items, addItem, updateQuantity } = useB2bCart();
  const router = useRouter();

  const cartItem = items.find((i) => i.product?.id === product.id);

  if (!product.in_stock) {
    return (
      <button disabled className="w-full py-4 rounded-xl bg-surface text-muted font-medium text-center border border-line cursor-not-allowed">
        Нет в наличии
      </button>
    );
  }

  const handleAdd = () => {
    addItem(product, qty);
    router.push('/cart');
  };

  if (cartItem) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between border border-line rounded-xl p-2 bg-surface">
          <button
            onClick={() => updateQuantity(product.id, Math.max(minQty, cartItem.quantity - 1))}
            disabled={cartItem.quantity <= minQty}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white hover:bg-black/5 disabled:opacity-50 transition"
          >
            -
          </button>
          <span className="font-medium px-4">{cartItem.quantity} шт</span>
          <button
            onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
            disabled={product.stock !== undefined && cartItem.quantity >= product.stock}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white hover:bg-black/5 disabled:opacity-50 transition"
          >
            +
          </button>
        </div>
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
          className="w-12 h-12 flex items-center justify-center rounded-lg bg-white hover:bg-black/5 disabled:opacity-50 transition"
        >
          -
        </button>
        <span className="font-medium px-2">{qty}</span>
        <button
          onClick={() => setQty(qty + 1)}
          disabled={product.stock !== undefined && qty >= product.stock}
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
      </div>
    </div>
  );
}
