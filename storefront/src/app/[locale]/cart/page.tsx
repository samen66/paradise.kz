"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/lib/cart";
import { apiGet, apiPost } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { CartValidation, Settings } from "@/lib/types";
import { Button } from "@/components/ui/Button";

export default function CartPage() {
  const t = useTranslations("cart");
  const tCheckout = useTranslations("checkout");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { items, remove, setQuantity, clear } = useCart();
  const [mounted, setMounted] = useState(false);
  const [validation, setValidation] = useState<CartValidation | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    void apiGet<{ data: Settings }>("/public/settings", { locale, revalidate: false })
      .then((response) => setSettings(response.data))
      .catch(() => {});
  }, [locale]);

  const defaultStoreId = settings?.stores.find((s) => s.is_default)?.id ?? settings?.stores[0]?.id ?? null;

  const revalidate = useCallback(async () => {
    if (items.length === 0) {
      setValidation(null);
      return;
    }
    try {
      const response = await apiPost<{ data: CartValidation }>(
        "/public/cart/validate",
        {
          store_id: defaultStoreId ?? undefined,
          items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
        },
        { locale },
      );
      setValidation(response.data);
    } catch {
      // The cart still renders from local data if validation is unreachable.
      setValidation(null);
    }
  }, [items, locale, defaultStoreId]);

  useEffect(() => {
    if (mounted) {
      void revalidate();
    }
  }, [mounted, revalidate]);

  if (!mounted) {
    return null;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[1160px] px-8 pb-16 pt-7">
        <div className="flex flex-col items-center gap-3.5 rounded-3xl border border-line bg-card px-8 py-[72px] text-center">
          <div
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-amber-50 text-[30px]"
            aria-hidden="true"
          >
            🛒
          </div>
          <h1 className="m-0 font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {t("empty")}
          </h1>
          <p className="m-0 max-w-[360px] text-sm leading-[1.55] text-muted">
            {t("emptyText")}
          </p>
          <Link href="/catalog" className="mt-2 text-decoration-none">
            <Button variant="primary" size="lg">
              {t("goToCatalog")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const lineByProduct = new Map(validation?.items.map((line) => [line.product_id, line]) ?? []);
  const hasAvailableItems = validation === null || validation.items.some((line) => line.available);
  const subtotal =
    validation?.subtotal ?? items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);

  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const freeDeliveryThreshold = settings?.free_delivery_from ?? 200000;
  const isFreeDelivery = subtotal >= freeDeliveryThreshold;
  const deliveryPrice = validation?.delivery_cost ?? settings?.delivery_price ?? 3500;
  const total = subtotal + (isFreeDelivery || subtotal === 0 ? 0 : deliveryPrice);
  const remaining = freeDeliveryThreshold - subtotal;
  const showProgress = !isFreeDelivery && subtotal > 0;
  const progressPct = Math.min(100, Math.round((subtotal / freeDeliveryThreshold) * 100));

  return (
    <div className="mx-auto max-w-[1160px] px-8 pb-16 pt-7">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="m-0 font-display text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {t("title")}
          </h1>
          <span className="text-[15px] text-muted">{t("itemsCount", { count })}</span>
        </div>
        <button
          type="button"
          onClick={clear}
          className="cursor-pointer border-none bg-transparent font-inherit text-[13px] text-muted underline decoration-1 underline-offset-3 hover:text-sale"
        >
          {t("clearCart")}
        </button>
      </div>

      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3.5">
          {showProgress && (
            <div className="rounded-2xl border border-line bg-card px-5 py-4">
              <div className="mb-2.5 flex justify-between text-[13px]">
                <span className="font-medium text-ink">
                  {t("freeDeliveryProgress", { amount: formatPrice(remaining, locale) })}
                </span>
                <span className="text-muted">{formatPrice(freeDeliveryThreshold, locale)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-panel">
                <div
                  className="h-full rounded-full bg-ink transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {items.map((item) => {
            const line = lineByProduct.get(item.productId);
            const price = line?.available ? line.price : item.price;
            const displayName = line?.name ?? item.name;
            const href = `/product/${item.slug ?? item.productId}`;
            const stock = line?.stock ?? 0;

            return (
              <div
                key={item.productId}
                className="grid grid-cols-[104px_1fr_auto] items-center gap-5 rounded-[20px] border border-line bg-card p-5 shadow-[0_1px_2px_rgba(28,26,23,0.04),0_8px_24px_rgba(28,26,23,0.04)] max-sm:grid-cols-[80px_1fr] max-sm:gap-4"
              >
                <Link
                  href={href}
                  className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-xl bg-panel max-sm:h-20 max-sm:w-20"
                >
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={displayName}
                      fill
                      sizes="104px"
                      className="object-contain p-2"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-3xl" aria-hidden="true">
                      🛋️
                    </span>
                  )}
                </Link>

                <div className="min-w-0">
                  <div className="mb-1 text-[15px] font-semibold text-ink">
                    <Link href={href} className="hover:underline">{displayName}</Link>
                  </div>
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className="text-[13px] text-muted">
                      {t("article", { article: line?.article ?? item.productId })}
                    </span>
                    {line && !line.available ? (
                      <span className="inline-flex items-center rounded-full bg-sale/10 px-2 py-0.5 text-[11px] font-medium text-sale-ink">
                        {t(`problems.${line.problem ?? "unavailable"}`)}
                      </span>
                    ) : (
                      stock > 0 && (
                         <span className="inline-flex items-center rounded-full bg-mint/10 px-2 py-0.5 text-[11px] font-medium text-mint-ink">
                            {tCommon("inStock")}
                         </span>
                      )
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3.5">
                    <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
                      <button
                        type="button"
                        className="h-8 w-8 cursor-pointer rounded-lg border-none bg-card text-base text-ink hover:bg-panel"
                        onClick={() => setQuantity(item.productId, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="min-w-8 text-center text-sm font-semibold text-ink">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="h-8 w-8 cursor-pointer rounded-lg border-none bg-card text-base text-ink hover:bg-panel"
                        onClick={() => setQuantity(item.productId, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-1 font-inherit text-[13px] text-muted hover:text-ink"
                    >
                      ♡ {tCommon("favorite")}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item.productId)}
                      className="cursor-pointer border-none bg-transparent p-1 font-inherit text-[13px] text-muted underline decoration-1 underline-offset-3 hover:text-sale"
                    >
                      {t("remove")}
                    </button>
                  </div>
                </div>

                <div className="self-start text-right max-sm:col-span-2 max-sm:mt-2">
                  <div className="font-display text-lg font-bold text-ink">
                    {formatPrice((price ?? 0) * item.quantity, locale)}
                  </div>
                  {item.quantity > 1 && (
                    <div className="mt-0.5 text-xs text-muted">
                      {formatPrice(price ?? 0, locale)} / шт
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <Link
            href="/catalog"
            className="mt-1.5 self-start text-sm font-medium text-ink text-decoration-none hover:underline"
          >
            ← {t("goToCatalog")}
          </Link>
        </div>

        <div className="lg:sticky lg:top-[180px] flex flex-col gap-3.5">
          <div className="rounded-[20px] border border-line bg-card p-6 shadow-[0_1px_2px_rgba(28,26,23,0.04),0_16px_40px_rgba(28,26,23,0.07)]">
            <h2 className="m-0 mb-4 font-display text-[19px] font-bold text-ink">
              {t("total")}
            </h2>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder={t("promoCode")}
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 font-inherit text-sm text-ink outline-none focus:border-ink"
              />
              <button
                type="button"
                className="cursor-pointer rounded-xl border border-line bg-card px-4 py-2.5 font-inherit text-[13px] font-semibold text-ink hover:bg-surface"
              >
                {t("apply")}
              </button>
            </div>
            <div className="mb-4 flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("itemsSubtotal", { count })}</span>
                <span className="font-medium text-ink">{formatPrice(subtotal, locale)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{tCheckout("deliveryCost")}</span>
                <span className={isFreeDelivery ? "font-semibold text-mint-ink" : "font-medium text-ink"}>
                  {isFreeDelivery ? tCheckout("free") : formatPrice(deliveryPrice, locale)}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3 border-t border-line pt-3">
                <span className="font-semibold text-ink">{t("total")}</span>
                <span className="font-display text-xl font-bold text-ink">
                  {formatPrice(total, locale)}
                </span>
              </div>
            </div>
            <Link
              href="/checkout"
              aria-disabled={!hasAvailableItems}
              className={`block w-full ${hasAvailableItems ? "" : "pointer-events-none opacity-50"}`}
            >
              <Button variant="primary" size="lg" className="w-full">
                {t("checkout")}
              </Button>
            </Link>
            <p className="m-0 mt-3 text-center text-xs leading-[1.5] text-muted">
              {t("paymentMethods")}
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-card px-5 py-4 text-[13px] text-muted-hover">
            <div className="flex items-center gap-2.5">
              <span>🚚</span>
              <span>{t("deliveryTerms")}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span>🔧</span>
              <span>{t("assemblyTerms")}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span>↩</span>
              <span>{t("returnTerms")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
