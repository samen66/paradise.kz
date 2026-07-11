"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { Paginated, Product } from "@/lib/types";
import { useB2bAuth } from "@/stores/useB2bAuth";
import B2BProductRow from "@/components/b2b/B2BProductRow";

export default function B2BCatalog() {
  const { token } = useB2bAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const fetchProducts = async () => {
      try {
        // Fetch from protected B2B endpoint
        const response = await apiGet<Paginated<Product>>("/products", {
          token,
        });
        setProducts(response.data);
      } catch (error) {
        console.error("Failed to fetch B2B products:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [token]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-ink">Оптовый каталог</h1>
        <p className="text-muted mt-2">
          Заказывайте товары оптом по специальным ценам. Минимальная сумма заказа не ограничена.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {products.length > 0 ? (
            products.map((product) => (
              <B2BProductRow key={product.id} product={product} />
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-line">
              <p className="text-muted">Каталог пуст или товары не найдены.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
