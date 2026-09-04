"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useTranslations } from "next-intl";
import { apiGet } from "@/lib/api";
import { useB2bAuth } from "@/stores/useB2bAuth";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/lib/types";
import Link from "next/link";

export default function B2BOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("account");
  const tCheckout = useTranslations("checkout");
  const token = useB2bAuth((state) => state.token);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    void apiGet<{ data: Order }>(`/orders/${id}`, { token, locale: "ru", revalidate: false })
      .then((response) => setOrder(response.data))
      .catch(() => setOrder(null));
  }, [token, id]);

  if (order === null) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="mb-6">
        <Link href="/orders" className="text-sm font-medium text-muted hover:text-ink transition inline-flex items-center gap-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Все заказы
        </Link>
      </div>

      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">
            {t("order")} {order.number}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {new Date(order.created_at).toLocaleDateString("ru-KZ")}
            {" · "}
            {order.delivery_method === "delivery" ? t("receivingDelivery") : t("receivingPickup")}
            {order.store_name ? ` · ${order.store_name}` : ""}
            {order.delivery_address
              ? ` · ${order.delivery_address.city}, ${order.delivery_address.street} ${order.delivery_address.building}`
              : ""}
          </p>
        </div>
        <span
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            order.status === "synced" ? "bg-mint text-mint-ink" : "bg-black/5 text-muted"
          }`}
        >
          {t(`status.${order.status}`)}
        </span>
      </div>

      <div className="rounded-2xl border border-line bg-white p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">Товары</h2>
        <ul className="divide-y divide-line text-sm">
          {(order.items ?? []).map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <span className="text-ink">
                {item.name} × {Number(item.quantity)}
              </span>
              <span className="whitespace-nowrap font-medium text-ink">
                {formatPrice(item.price * item.quantity, "ru")}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 space-y-2 border-t border-line pt-4 text-right text-sm text-muted">
          {order.delivery_cost > 0 ? (
            <p>
              {tCheckout("deliveryCost")}: <b className="text-ink">{formatPrice(order.delivery_cost, "ru")}</b>
            </p>
          ) : null}
          <p className="text-xl text-ink">
            {tCheckout("total")}: <b>{formatPrice(order.total, "ru")}</b>
          </p>
        </div>
      </div>
    </div>
  );
}
