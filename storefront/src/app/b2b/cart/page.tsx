"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useB2bCart } from "@/stores/useB2bCart";
import { useB2bAuth } from "@/stores/useB2bAuth";
import { apiPost } from "@/lib/api";

export default function B2BCartPage() {
  const { items, updateItem, removeItem, clearCart, getTotal } = useB2bCart();
  const { token } = useB2bAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (items.length === 0 || !token) return;

    setIsLoading(true);
    setError(null);

    try {
      await apiPost(
        "/orders",
        {
          delivery_method: "pickup", // simplified for MVP B2B
          items: items.map((i) => ({
            product_id: i.id,
            quantity: i.qty,
          })),
        },
        { token }
      );
      
      clearCart();
      router.push("/b2b/orders");
    } catch (err: any) {
      setError(err.message || "Ошибка при оформлении заказа");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-ink">Корзина</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-line">
          <p className="text-muted mb-4">Ваша оптовая корзина пуста.</p>
          <button
            onClick={() => router.push("/b2b/catalog")}
            className="bg-ink text-white px-6 py-2 rounded-lg font-medium hover:bg-ink-hover"
          >
            Перейти в каталог
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 border border-line rounded-lg bg-white"
              >
                <div className="w-16 h-16 relative bg-surface rounded flex-shrink-0">
                  <Image
                    src={item.image || "/placeholder.jpg"}
                    alt={item.name || ""}
                    fill
                    className="object-cover rounded"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-ink truncate">{item.name}</h3>
                  <div className="text-sm font-bold mt-1">
                    {item.price?.toLocaleString("ru-RU")} ₸
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => updateItem(item.id, parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 border border-line rounded text-center focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                  
                  <div className="font-bold w-24 text-right">
                    {((item.price || 0) * item.qty).toLocaleString("ru-RU")} ₸
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-500 hover:text-red-700 p-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-line p-6 rounded-lg h-fit">
            <h3 className="text-lg font-bold mb-4">Сумма заказа</h3>
            
            <div className="flex justify-between items-center py-3 border-b border-line">
              <span className="text-muted">Итого</span>
              <span className="text-xl font-bold">{getTotal().toLocaleString("ru-RU")} ₸</span>
            </div>

            <button
              onClick={handleCheckout}
              disabled={isLoading}
              className="w-full mt-6 bg-ink text-white py-3 rounded-lg font-medium hover:bg-ink-hover disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Оформление..." : "Оформить оптовый заказ"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
