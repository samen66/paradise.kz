"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiGet } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";
import { useB2bAuth } from "@/stores/useB2bAuth";

function pillClass(highlighted: boolean): string {
  return `rounded-full px-4 py-1.5 text-sm font-medium ${highlighted ? "bg-mint text-mint-ink" : "bg-black/5 text-muted"}`;
}

function ItemThumb({ item }: { item: OrderItem }) {
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-card">
      {item.image ? (
        <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          aria-hidden="true"
          className="absolute inset-0 m-auto h-8 w-8 text-line-strong"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 16 5-5 4 4 3-3 6 6" />
        </svg>
      )}
    </div>
  );
}

function ItemRow({ item, articleLabel }: { item: OrderItem; articleLabel: string }) {
  const body = (
    <>
      <ItemThumb item={item} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink group-hover:underline">{item.name}</p>
        {item.article ? (
          <p className="mt-0.5 text-xs text-muted">
            {articleLabel} {item.article}
          </p>
        ) : null}
        <p className="mt-1 text-muted">
          {formatPrice(item.price, "ru")} × {Number(item.quantity)}
        </p>
      </div>
      <span className="whitespace-nowrap font-medium text-ink">{formatPrice(item.price * item.quantity, "ru")}</span>
    </>
  );

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      {item.product_id !== null ? (
        <Link href={`/product/${item.product_id}`} className="group flex items-center gap-4">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-4">{body}</div>
      )}
    </li>
  );
}

export default function B2BOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("account");
  const token = useB2bAuth((state) => state.token);
  const [order, setOrder] = useState<Order | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    setLoadFailed(false);
    void apiGet<{ data: Order }>(`/orders/${id}`, { token, locale: "ru", revalidate: false })
      .then((response) => setOrder(response.data))
      .catch(() => {
        setOrder(null);
        setLoadFailed(true);
      });
  }, [token, id]);

  if (loadFailed) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 py-20 text-center">
        <p className="text-muted">{t("loadFailed")}</p>
        <Link href="/orders" className="text-sm font-medium text-ink underline">
          {t("allOrders")}
        </Link>
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const items = order.items ?? [];
  // "Товары" is the sum of the lines printed above; "Итого" stays the order's own total.
  const itemsSum = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const address = order.delivery_address;
  const addressLine = address
    ? [
        address.city,
        [address.street, address.building].filter(Boolean).join(" "),
        address.apartment ? `${t("apartment")} ${address.apartment}` : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="mx-auto max-w-5xl py-8">
      <div className="mb-6">
        <Link href="/orders" className="text-sm font-medium text-muted hover:text-ink transition inline-flex items-center gap-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {t("allOrders")}
        </Link>
      </div>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">
            {t("order")} {order.number}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {new Date(order.created_at).toLocaleString("ru-KZ", { dateStyle: "long", timeStyle: "short" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={pillClass(order.status === "completed" || order.status === "synced")}>
            {t(`status.${order.status}`)}
          </span>
          {order.payment_status ? (
            <span className={pillClass(order.payment_status === "paid")}>
              {t(`paymentStatus.${order.payment_status}`)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">{t("items")}</h2>
          <ul className="divide-y divide-line text-sm">
            {items.map((item) => (
              <ItemRow key={item.id} item={item} articleLabel={t("article")} />
            ))}
          </ul>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-[120px]">
          <section className="rounded-2xl border border-line bg-white p-5 text-sm">
            <h2 className="mb-2 font-semibold text-ink">{t("receiving")}</h2>
            {order.delivery_method === "delivery" ? (
              <>
                <p className="text-ink">{t("receivingDelivery")}</p>
                {addressLine ? <p className="mt-1 text-muted">{addressLine}</p> : null}
                {address?.comment ? <p className="mt-1 text-muted">{address.comment}</p> : null}
              </>
            ) : (
              <>
                <p className="text-ink">{t("pickupFrom")}</p>
                {order.store_name ? <p className="mt-1 text-muted">{order.store_name}</p> : null}
              </>
            )}
          </section>

          {order.payment_status ? (
            <section className="rounded-2xl border border-line bg-white p-5 text-sm">
              <h2 className="mb-2 font-semibold text-ink">{t("payment")}</h2>
              <p className="text-ink">{t(`paymentStatus.${order.payment_status}`)}</p>
            </section>
          ) : null}

          {order.comment || order.contact_email ? (
            <section className="space-y-3 rounded-2xl border border-line bg-white p-5 text-sm">
              {order.comment ? (
                <div>
                  <h2 className="mb-1 font-semibold text-ink">{t("comment")}</h2>
                  <p className="whitespace-pre-line text-muted">{order.comment}</p>
                </div>
              ) : null}
              {order.contact_email ? (
                <div>
                  <h2 className="mb-1 font-semibold text-ink">{t("emailLabel")}</h2>
                  <p className="break-all text-muted">{order.contact_email}</p>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-2xl border border-line bg-white p-5 text-sm">
            <h2 className="mb-3 font-semibold text-ink">{t("summary")}</h2>
            <dl className="space-y-2">
              <div className="flex justify-between gap-4 text-muted">
                <dt>{t("itemsCount", { count: items.length })}</dt>
                <dd className="text-ink">{formatPrice(itemsSum, "ru")}</dd>
              </div>
              {order.delivery_cost > 0 ? (
                <div className="flex justify-between gap-4 text-muted">
                  <dt>{t("deliveryCost")}</dt>
                  <dd className="text-ink">{formatPrice(order.delivery_cost, "ru")}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t border-line pt-3 text-base">
                <dt className="font-semibold text-ink">{t("total")}</dt>
                <dd className="font-semibold text-ink">{formatPrice(order.total, "ru")}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
