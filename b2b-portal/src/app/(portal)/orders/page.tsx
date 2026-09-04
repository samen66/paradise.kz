"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { useB2bAuth } from "@/stores/useB2bAuth";
import { formatPrice } from "@/lib/format";
import type { Order, Paginated } from "@/lib/types";

function statusPillClass(status: string): string {
  return status === "synced" ? "bg-mint text-mint-ink" : "bg-black/5 text-muted";
}

export default function B2BOrdersPage() {
  const t = useTranslations("account");
  const tCart = useTranslations("cart");
  const token = useB2bAuth((state) => state.token);
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    void apiGet<Paginated<Order>>("/orders", { token, locale: "ru", revalidate: false })
      .then((response) => setOrders(response.data))
      .catch(() => setOrders([]));
  }, [token]);

  if (orders === null) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-ink">Мои заказы</h1>
        <p className="mt-2 text-muted">История ваших оптовых заказов и бронирований.</p>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center bg-white rounded-2xl border border-line">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            aria-hidden="true"
            className="h-20 w-20 text-line-strong"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 12V8.5A2.5 2.5 0 0 1 9.5 6h5a2.5 2.5 0 0 1 2.5 2.5V12"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.5A1.5 1.5 0 0 1 6 11h12a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 16v-3.5Z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 17.5v2M18 17.5v2" />
          </svg>
          <p className="text-muted">{t("noOrders")}</p>
          <Link
            href="/catalog"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-medium text-white transition hover:bg-ink-hover"
          >
            В каталог
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="block rounded-2xl border border-line bg-white p-5 transition hover:border-line-strong"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-semibold text-ink">
                      {t("order")} {order.number}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {t("from")} {new Date(order.created_at).toLocaleDateString("ru-KZ")}
                      {" · "}
                      {order.delivery_method === "delivery" ? t("receivingDelivery") : t("receivingPickup")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusPillClass(order.status)}`}>
                      {t(`status.${order.status}`)}
                    </span>
                    <span className="text-base font-semibold text-ink">{formatPrice(order.total, "ru")}</span>
                  </div>
                </div>

                {order.items && order.items.length > 0 ? (
                  <ul className="mt-4 space-y-1 border-t border-line pt-3 text-sm text-muted">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-4">
                        <span className="line-clamp-1">
                          {item.name} × {Number(item.quantity)}
                        </span>
                        <span className="whitespace-nowrap text-ink">
                          {formatPrice(item.price * item.quantity, "ru")}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
