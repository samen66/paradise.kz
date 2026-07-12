"use client";

import React, { useState } from "react";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { useB2bCart } from "@/stores/useB2bCart";

interface B2BProductRowProps {
  product: Product;
}

export default function B2BProductRow({ product }: B2BProductRowProps) {
  const addItem = useB2bCart((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);

  const thumbUrl = product.images?.[0]?.thumb || "/placeholder.jpg";

  const handleAdd = () => {
    if (quantity > 0) {
      addItem(product.id, quantity, {
        name: product.name,
        price: product.price || 0,
        image: thumbUrl
      });
      // Optional: show a toast or feedback here
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 p-4 border border-line rounded-lg bg-white hover:shadow-sm transition-shadow">
      {/* Image */}
      <div className="w-20 h-20 relative bg-surface rounded flex-shrink-0">
        <Image
          src={thumbUrl}
          alt={product.name}
          fill
          className="object-cover rounded"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-muted bg-surface px-2 py-0.5 rounded">
            SKU: {product.article || "N/A"}
          </span>
          {product.in_stock ? (
            <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
              В наличии {product.stock ? `(${product.stock} шт)` : ""}
            </span>
          ) : (
            <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">
              Нет в наличии
            </span>
          )}
        </div>
        <h3 className="font-medium text-ink truncate">{product.name}</h3>
      </div>

      {/* Price */}
      <div className="text-right w-32 flex-shrink-0">
        <div className="font-bold text-lg text-ink">
          {product.price?.toLocaleString("ru-RU")} ₸
        </div>
        <div className="text-xs text-muted">Оптовая цена</div>
      </div>

      {/* Action */}
      <div className="flex items-center gap-2 w-full md:w-auto">
        <input
          type="number"
          min="1"
          max={product.stock || 9999}
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          className="w-16 px-2 py-2 border border-line rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-ink"
          disabled={!product.in_stock}
        />
        <button
          onClick={handleAdd}
          disabled={!product.in_stock}
          className="bg-ink text-white px-4 py-2 rounded-lg font-medium hover:bg-ink-hover disabled:opacity-50 transition-colors whitespace-nowrap flex-1 md:flex-none"
        >
          В корзину
        </button>
      </div>
    </div>
  );
}
