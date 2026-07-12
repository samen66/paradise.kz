"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function AccountOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("account");
  const tCheckout = useTranslations("checkout");
  const locale = useLocale();
  const token = useAuth((state) => state.token);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    void apiGet<{ data: Order }>(`/account/orders/${id}`, { token, locale, revalidate: false })
      .then((response) => setOrder(response.data))
      .catch(() => setOrder(null));
  }, [token, id, locale]);

  if (order === null) {
    return null;
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-display text-2xl font-semibold text-ink">
          {t("order")} {order.number}
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            order.status === "synced" ? "bg-mint text-mint-ink" : "bg-black/5 text-muted"
          }`}
        >
          {t(`status.${order.status}`)}
        </span>
      </div>

      <p className="mb-4 text-sm text-muted">
        {order.delivery_method === "delivery" ? t("receivingDelivery") : t("receivingPickup")}
        {order.store_name ? ` · ${order.store_name}` : ""}
        {order.delivery_address
          ? ` · ${order.delivery_address.city}, ${order.delivery_address.street} ${order.delivery_address.building}`
          : ""}
      </p>

      <ul className="divide-y divide-line rounded-2xl border border-line px-4 text-sm">
        {(order.items ?? []).map((item) => (
          <li key={item.id} className="flex justify-between gap-4 py-3">
            <span className="text-ink">
              {item.name} × {Number(item.quantity)}
            </span>
            <span className="whitespace-nowrap font-medium text-ink">
              {formatPrice(item.price * item.quantity, locale)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-1 text-right text-sm text-muted">
        {order.delivery_cost > 0 ? (
          <p>
            {tCheckout("deliveryCost")}: <b className="text-ink">{formatPrice(order.delivery_cost, locale)}</b>
          </p>
        ) : null}
        <p className="text-lg text-ink">
          {tCheckout("total")}: <b>{formatPrice(order.total, locale)}</b>
        </p>
      </div>
    </div>
  );
}
