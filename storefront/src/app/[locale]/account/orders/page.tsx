"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import type { Order, Paginated } from "@/lib/types";

function statusPillClass(status: string): string {
  return status === "synced" 
    ? "bg-mint text-mint-ink border-transparent" 
    : "bg-transparent border border-line text-ink";
}

export default function AccountOrdersPage() {
  const t = useTranslations("account");
  const tCart = useTranslations("cart");
  const locale = useLocale();
  const token = useAuth((state) => state.token);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [openOrder, setOpenOrder] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    
    void apiGet<Paginated<Order>>("/account/orders", { token, locale, revalidate: false })
      .then((response) => setOrders(response.data))
      .catch(() => setOrders([]));
  }, [token, locale]);

  if (orders === null) {
    return null;
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          aria-hidden="true"
          className="h-20 w-20 text-line-strong"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 12V8.5A2.5 2.5 0 0 1 9.5 6h5a2.5 2.5 0 0 1 2.5 2.5V12" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5A1.5 1.5 0 0 1 6 11h12a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 16v-3.5Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 17.5v2M18 17.5v2" />
        </svg>
        <p className="text-muted">{t("noOrders")}</p>
        <Link
          href="/catalog"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-medium text-white transition hover:bg-ink-hover"
        >
          {tCart("goToCatalog")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <h1 className="font-display text-[28px] font-bold text-ink m-0 mb-[22px] tracking-tight">
        {t("orders")}
      </h1>
      <div className="flex flex-col gap-3.5">
        {orders.map((order) => {
          const isOpen = openOrder === order.id;
          const totalQty = order.items?.reduce((acc, item) => acc + Number(item.quantity), 0) || 0;
          const dateStr = new Date(order.created_at).toLocaleDateString(locale === "kk" ? "kk-KZ" : "ru-KZ");
          const itemsLabel = t("itemsCount", { count: totalQty });
          
          return (
            <div key={order.id} className="bg-white border border-line rounded-[20px] overflow-hidden">
              <button
                onClick={() => setOpenOrder(isOpen ? null : order.id)}
                className="w-full border-none bg-transparent px-6 py-5 flex items-center gap-[18px] cursor-pointer text-left font-inherit hover:bg-card transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-bold text-[15px] text-ink font-display whitespace-nowrap">
                      {t("order")} {order.number}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-[6px] text-[11px] font-bold uppercase tracking-wider ${statusPillClass(order.status)}`}>
                      {t(`status.${order.status}`)}
                    </span>
                  </div>
                  <span className="text-[13px] text-muted">
                    {dateStr} · {itemsLabel}
                  </span>
                </div>
                
                <div className="flex mr-2">
                  {order.items?.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="w-11 h-11 rounded-[10px] bg-card border-2 border-white -ml-2.5 first:ml-0 overflow-hidden relative shrink-0">
                      {item.image && (
                        <Image src={item.image} alt={item.name} fill sizes="44px" className="object-cover" />
                      )}
                    </div>
                  ))}
                  {(order.items?.length || 0) > 3 && (
                    <div className="w-11 h-11 rounded-[10px] bg-line border-2 border-white -ml-2.5 flex items-center justify-center text-xs font-semibold text-ink relative shrink-0">
                      +{(order.items?.length || 0) - 3}
                    </div>
                  )}
                </div>
                
                <span className="font-display font-bold text-base text-ink shrink-0">
                  {formatPrice(order.total, locale)}
                </span>
                
                <span className={`text-[18px] text-muted transition-transform shrink-0 ${isOpen ? "rotate-180" : "rotate-0"}`}>
                  ⌄
                </span>
              </button>
              
              {isOpen && (
                <div className="border-t border-line px-6 py-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-3">
                    {order.items?.map((item) => (
                      <div key={item.id} className="flex items-center gap-3.5">
                        <div className="w-[52px] h-[52px] rounded-xl bg-card relative shrink-0 overflow-hidden">
                          {item.image && (
                            <Image src={item.image} alt={item.name} fill sizes="52px" className="object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-ink truncate">{item.name}</div>
                          <div className="text-xs text-muted">
                            {Number(item.quantity)} {t("pcs")} × {formatPrice(item.price, locale)}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-ink shrink-0">
                          {formatPrice(item.price * item.quantity, locale)}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-3 flex-wrap border-t border-line pt-4 mt-1">
                    <Link href={`/account/orders/${order.id}`} className="inline-flex items-center justify-center rounded-[10px] bg-ink px-4 py-2 text-[13px] font-medium text-white transition hover:bg-ink-hover shrink-0">
                      {t("orderDetails")}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
