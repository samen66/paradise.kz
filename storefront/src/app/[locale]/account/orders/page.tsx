"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import type { Order, Paginated } from "@/lib/types";

function statusPillClass(status: string): string {
  return status === "synced" ? "bg-mint text-mint-ink" : "bg-black/5 text-muted";
}

export default function AccountOrdersPage() {
  const t = useTranslations("account");
  const tCart = useTranslations("cart");
  const locale = useLocale();
  const token = useAuth((state) => state.token);
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
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
          {tCart("goToCatalog")}
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {orders.map((order) => (
        <li key={order.id}>
          <Link
            href={`/account/orders/${order.id}`}
            className="block rounded-2xl border border-line bg-white p-5 transition hover:border-line-strong"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-base font-semibold text-ink">
                  {t("order")} {order.number}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {t("from")} {new Date(order.created_at).toLocaleDateString(locale === "kk" ? "kk-KZ" : "ru-KZ")}
                  {" · "}
                  {order.delivery_method === "delivery" ? t("receivingDelivery") : t("receivingPickup")}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusPillClass(order.status)}`}>
                  {t(`status.${order.status}`)}
                </span>
                <span className="text-base font-semibold text-ink">{formatPrice(order.total, locale)}</span>
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
                      {formatPrice(item.price * item.quantity, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
