"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CancelOrderButton } from "@/components/account/CancelOrderButton";
import { OrderProgress } from "@/components/account/OrderProgress";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { statusBadgeClass } from "@/lib/order-status";
import type { Order } from "@/lib/types";

const CARD = "rounded-[20px] border border-line bg-white dark:bg-card";

export default function AccountOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("account");
  const tCheckout = useTranslations("checkout");
  const locale = useLocale();
  const token = useAuth((state) => state.token);
  const [order, setOrder] = useState<Order | null>(null);

  const load = useCallback(() => {
    if (!token) {
      return;
    }
    void apiGet<{ data: Order }>(`/account/orders/${id}`, { token, locale, revalidate: false })
      .then((response) => setOrder(response.data))
      .catch(() => setOrder(null));
  }, [token, id, locale]);

  useEffect(load, [load]);

  if (order === null || !token) {
    return null;
  }

  const items = order.items ?? [];
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemsCount = items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const placedAt = new Intl.DateTimeFormat(locale === "kk" ? "kk-KZ" : "ru-KZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(order.created_at));
  const address = order.delivery_address;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/account/orders" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted transition hover:text-ink">
        <span aria-hidden="true">←</span> {t("backToOrders")}
      </Link>

      <section className={`${CARD} flex flex-col gap-5 p-5 sm:gap-6 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 font-display text-[26px] font-bold tracking-tight text-ink">
              {t("order")} {order.number}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {t("placedAt", { date: placedAt })} · {t("itemsCount", { count: itemsCount })}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(order.status)}`}>
            {t(`status.${order.status}`)}
          </span>
        </div>

        <OrderProgress status={order.status} deliveryMethod={order.delivery_method} />
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className={`${CARD} p-5`}>
          <h2 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t("receivingTitle")}</h2>
          <p className="font-medium text-ink">
            {order.delivery_method === "delivery" ? t("receivingDelivery") : t("receivingPickup")}
          </p>
          {order.delivery_method === "delivery" && address ? (
            <>
              <p className="mt-1 text-sm text-ink">
                {[address.city, [address.street, address.building].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(", ")}
                {address.apartment ? `, ${t("apartment", { apartment: address.apartment })}` : ""}
              </p>
              {address.comment ? <p className="mt-1 text-sm text-muted">{address.comment}</p> : null}
            </>
          ) : (
            <>
              {order.store_name ? <p className="mt-1 text-sm text-ink">{order.store_name}</p> : null}
              {order.store_address ? <p className="mt-1 text-sm text-muted">{order.store_address}</p> : null}
            </>
          )}
        </section>

        <section className={`${CARD} p-5`}>
          <h2 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t("paymentTitle")}</h2>
          <p className="font-medium text-ink">
            {order.payment_method && t.has(`paymentMethod.${order.payment_method}`)
              ? t(`paymentMethod.${order.payment_method}`)
              : "—"}
          </p>
          {order.payment_status && t.has(`paymentStatus.${order.payment_status}`) ? (
            <p className={`mt-1 text-sm ${order.payment_status === "paid" ? "text-mint-ink" : "text-muted"}`}>
              {t(`paymentStatus.${order.payment_status}`)}
            </p>
          ) : null}
        </section>
      </div>

      <section className={`${CARD} p-5`}>
        <h2 className="m-0 mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{t("itemsTitle")}</h2>
        <ul className="flex flex-col divide-y divide-line">
          {items.map((item) => {
            const lineTotal = formatPrice(item.price * item.quantity, locale);
            const name = item.slug ? (
              <Link href={`/product/${item.slug}`} className="text-ink hover:underline">
                {item.name}
              </Link>
            ) : (
              item.name
            );

            return (
              <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 sm:items-center sm:gap-3.5">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-card sm:h-16 sm:w-16">
                  {item.image ? <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="break-words text-sm font-medium text-ink">{name}</div>
                  {item.article ? (
                    <div className="break-all text-xs text-muted">{t("article", { article: item.article })}</div>
                  ) : null}
                  <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-muted">
                    <span>
                      {Number(item.quantity)} {t("pcs")} × {formatPrice(item.price, locale)}
                    </span>
                    <span className="whitespace-nowrap text-sm font-semibold text-ink sm:hidden">{lineTotal}</span>
                  </div>
                </div>
                <span className="hidden shrink-0 whitespace-nowrap text-sm font-semibold text-ink sm:block">{lineTotal}</span>
              </li>
            );
          })}
        </ul>

        <dl className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-4 text-muted">
            <dt>{tCheckout("subtotal")}</dt>
            <dd className="text-ink">{formatPrice(subtotal, locale)}</dd>
          </div>
          {order.delivery_method === "delivery" ? (
            <div className="flex justify-between gap-4 text-muted">
              <dt>{tCheckout("deliveryCost")}</dt>
              <dd className="text-ink">
                {order.delivery_cost > 0 ? formatPrice(order.delivery_cost, locale) : tCheckout("free")}
              </dd>
            </div>
          ) : null}
          <div className="mt-1 flex justify-between gap-4 text-base text-ink">
            <dt className="font-medium">{tCheckout("total")}</dt>
            <dd className="font-display text-lg font-bold">{formatPrice(order.total, locale)}</dd>
          </div>
        </dl>
      </section>

      {order.comment ? (
        <section className={`${CARD} p-5`}>
          <h2 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t("orderComment")}</h2>
          <p className="whitespace-pre-line text-sm text-ink">{order.comment}</p>
        </section>
      ) : null}

      {order.status === "pending" ? (
        <CancelOrderButton orderId={order.id} orderNumber={order.number} token={token} onCancelled={load} />
      ) : null}
    </div>
  );
}
