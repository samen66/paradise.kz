"use client";

import { useState } from "react";
import { useB2bCart } from "@/stores/useB2bCart";
import { apiGet } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useRouter } from "next/navigation";

export default function QuickOrderPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ article: string; product?: Product; requestedQty: number; status: 'added' | 'not_found' | 'out_of_stock' }[]>([]);
  const { addItem } = useB2bCart();
  const router = useRouter();

  const handleProcess = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    setError(null);
    setResults([]);

    // Parse input format: "ARTICLE, QTY" or "ARTICLE QTY" per line
    const lines = input.split('\n').filter(line => line.trim().length > 0);
    const parsedItems = lines.map(line => {
      const parts = line.trim().split(/[\s,]+/);
      const article = parts[0];
      const qty = parts.length > 1 ? parseInt(parts[1], 10) : 1;
      return { article, qty: isNaN(qty) ? 1 : qty };
    });

    const newResults = [];

    try {
      for (const item of parsedItems) {
        // Search product by article (assuming backend supports search by article)
        const response = await apiGet<{ data: Product[] }>(`/products?search=${item.article}`, {
          requireB2bAuth: true
        });

        const product = response.data.find(p => p.article === item.article || p.name.includes(item.article));

        if (!product) {
          newResults.push({ article: item.article, requestedQty: item.qty, status: 'not_found' as const });
          continue;
        }

        if (!product.in_stock || (product.stock !== undefined && product.stock < item.qty)) {
          newResults.push({ article: item.article, product, requestedQty: item.qty, status: 'out_of_stock' as const });
          continue;
        }

        // Add to cart
        const minQty = product.b2b_min_order_qty || 1;
        const finalQty = Math.max(item.qty, minQty);
        addItem(product, finalQty);
        
        newResults.push({ article: item.article, product, requestedQty: finalQty, status: 'added' as const });
      }

      setResults(newResults);
    } catch (e) {
      setError("Ошибка при обработке списка. Пожалуйста, попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 font-display text-3xl font-semibold text-ink">Быстрый заказ по артикулам</h1>
      
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <p className="text-sm text-ink/70">
            Введите артикулы товаров и количество (опционально) по одному на строку. Например:<br/>
            <code className="bg-panel px-2 py-1 rounded text-xs mt-2 block">
              100-245, 5<br/>
              TAB-99<br/>
              CHAIR-BLK 10
            </code>
          </p>
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Артикул, Количество"
            className="w-full rounded-xl border border-line bg-surface p-4 text-sm text-ink min-h-[300px] focus:border-ink focus:outline-none"
            disabled={loading}
          />
          
          {error && <p className="text-danger text-sm">{error}</p>}
          
          <button
            onClick={handleProcess}
            disabled={loading || !input.trim()}
            className="w-full py-4 rounded-xl bg-ink text-white font-medium hover:bg-ink/90 transition disabled:opacity-50"
          >
            {loading ? "Обработка..." : "Добавить в корзину"}
          </button>
        </div>

        <div>
          <h2 className="mb-4 font-semibold text-ink">Результат обработки</h2>
          {results.length > 0 ? (
            <div className="space-y-3">
              {results.map((result, idx) => (
                <div key={idx} className={`p-4 rounded-xl border ${result.status === 'added' ? 'border-success/20 bg-success/5' : 'border-danger/20 bg-danger/5'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{result.article}</p>
                      {result.product && <p className="text-xs text-ink/70 mt-1">{result.product.name}</p>}
                    </div>
                    <span className="text-sm font-medium">{result.requestedQty} шт</span>
                  </div>
                  <p className={`text-xs mt-2 font-medium ${result.status === 'added' ? 'text-success' : 'text-danger'}`}>
                    {result.status === 'added' ? 'Добавлен в корзину' : 
                     result.status === 'not_found' ? 'Товар не найден' : 
                     'Нет в наличии или недостаточно остатков'}
                  </p>
                </div>
              ))}

              {results.some(r => r.status === 'added') && (
                <button
                  onClick={() => router.push('/b2b/cart')}
                  className="w-full mt-4 py-3 rounded-xl border border-line bg-surface text-ink font-medium hover:border-ink transition"
                >
                  Перейти в корзину
                </button>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[300px] flex items-center justify-center border-2 border-dashed border-line rounded-xl bg-surface/50 text-muted text-sm">
              Список пуст
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
