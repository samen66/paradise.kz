"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiGet, ApiError } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function OrderTrackingPage() {
  const t = useTranslations("tracking");
  const tAccount = useTranslations("account");
  const tCheckout = useTranslations("checkout");
  const locale = useLocale();

  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("+7");
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  async function find() {
    setBusy(true);
    setNotFound(false);
    setOrder(null);
    try {
      const response = await apiGet<{ data: Order }>("/public/orders/track", {
        locale,
        revalidate: false,
        searchParams: { number: number.trim(), phone },
      });
      setOrder(response.data);
    } catch (e) {
      if (e instanceof ApiError) {
        setNotFound(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="mb-6 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl leading-tight">
        {t("title")}
      </h1>

      <div className="rounded-2xl border border-line bg-white p-6">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void find();
          }}
        >
          <input
            required
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder={`${t("number")} (P-100001)`}
            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-ink placeholder:text-muted focus:border-line-strong focus:outline-none"
          />
          <input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("phone")}
            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-ink placeholder:text-muted focus:border-line-strong focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-medium text-white transition hover:bg-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
          >
            {t("find")}
          </button>
        </form>

        {notFound ? <p className="mt-4 text-sm text-sale">{t("notFound")}</p> : null}
      </div>

      {order ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="font-display text-lg font-semibold text-ink">{order.number}</span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                order.status === "synced" ? "bg-mint text-mint-ink" : "bg-black/5 text-muted"
              }`}
            >
              {tAccount(`status.${order.status}`)}
            </span>
          </div>
          <ul className="divide-y divide-line text-sm">
            {(order.items ?? []).map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-2.5 text-ink">
                <span>
                  {item.name} × {Number(item.quantity)}
                </span>
                <span className="whitespace-nowrap font-medium">
                  {formatPrice(item.price * item.quantity, locale)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-line pt-3 text-base font-semibold text-ink">
            <span>{tCheckout("total")}</span>
            <span>{formatPrice(order.total, locale)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
