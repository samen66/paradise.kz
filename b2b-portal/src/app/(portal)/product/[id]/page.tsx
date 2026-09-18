"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiGet } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useB2bAuth } from "@/stores/useB2bAuth";
import { formatPrice } from "@/lib/format";
import { AddToCartB2BButton } from "@/components/AddToCartB2BButton";

export default function B2BProductDetail() {
  const tApproval = useTranslations("approval");
  const params = useParams();
  // B2B products are addressed by numeric id only (GET /api/products/{id}).
  const rawId = params.id as string;
  const productId = /^\d+$/.test(rawId) ? Number(rawId) : null;
  const { token } = useB2bAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  useEffect(() => {
    if (productId === null) {
      setIsLoading(false);
      return;
    }
    if (!token) return;

    const fetchProduct = async () => {
      try {
        const response = await apiGet<{ data: Product }>(`/products/${productId}`, {
          token,
        });
        setProduct(response.data);
        if (response.data.images && response.data.images.length > 0) {
          setActiveImage(response.data.images[0].full);
        }
      } catch (error) {
        console.error("Failed to fetch B2B product detail:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [token, productId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-ink">Товар не найден</h1>
        <Link href="/catalog" className="text-muted hover:underline mt-4 inline-block">
          Вернуться в каталог
        </Link>
      </div>
    );
  }

  const hidesPrice = product.price === undefined;

  return (
    <div className="space-y-12">
      <div className="text-sm text-muted">
        <Link href="/catalog" className="hover:text-ink transition">Каталог</Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.name}</span>
      </div>

      <div className="grid gap-12 lg:grid-cols-2">
        {/* Images */}
        <div className="space-y-4">
          <div className="relative aspect-square w-full rounded-2xl bg-surface overflow-hidden">
            {activeImage ? (
              <Image
                src={activeImage}
                alt={product.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-16 h-16 opacity-30">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
              </div>
            )}
          </div>
          
          {product.images && product.images.length > 1 && (
            <div className="grid grid-cols-5 gap-4">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(img.full)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 ${activeImage === img.full ? 'border-ink' : 'border-transparent hover:border-line'} transition-colors`}
                >
                  <Image src={img.thumb} alt="" fill sizes="20vw" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <h1 className="text-3xl font-display font-bold text-ink mb-2">
            {product.name}
          </h1>
          {product.article && (
            <div className="text-sm text-muted mb-6">
              Артикул: {product.article}
            </div>
          )}

          {hidesPrice ? (
            <div className="bg-mint/40 rounded-xl p-6 mb-8">
              <div className="text-xl font-semibold text-ink mb-1">{tApproval("priceAfterApproval")}</div>
              <p className="text-sm text-muted">{tApproval("pendingText")}</p>
            </div>
          ) : (
            <>
              <div className="bg-surface rounded-xl p-6 mb-8">
                <div className="text-3xl font-bold text-ink mb-1">
                  {product.price !== null ? formatPrice(product.price, 'ru') : 'Цена по запросу'}
                </div>

                <div className="flex items-center gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${product.in_stock ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    {product.in_stock ? (
                      <span>
                        В наличии {product.stock !== undefined ? <span className="font-medium">({product.stock} шт)</span> : null}
                      </span>
                    ) : (
                      <span className="text-muted">Нет в наличии</span>
                    )}
                  </div>

                  {product.b2b_min_order_qty && product.b2b_min_order_qty > 1 && (
                    <div className="text-muted pl-4 border-l border-line">
                      Мин. заказ: <span className="font-medium text-ink">{product.b2b_min_order_qty} шт.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-8">
                <AddToCartB2BButton product={product} />
              </div>
            </>
          )}

          {product.characteristics && product.characteristics.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4 border-b border-line pb-2">Характеристики</h2>
              <dl className="space-y-3 text-sm">
                {product.characteristics.map((char, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-4">
                    <dt className="text-muted">{char.name}</dt>
                    <dd className="font-medium text-right text-ink">{char.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {product.description && (
            <div>
              <h2 className="text-xl font-display font-semibold mb-4 border-b border-line pb-2">Описание</h2>
              <div 
                className="prose prose-sm max-w-none text-ink prose-p:leading-relaxed"
                dangerouslySetInnerHTML={{ __html: product.description }} 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
