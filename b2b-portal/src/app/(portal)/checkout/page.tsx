"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiValidationError } from "@/lib/api";
import { useB2bAuth } from "@/stores/useB2bAuth";
import { useB2bCart } from "@/stores/useB2bCart";
import { formatPrice } from "@/lib/format";
import type { Address, CartValidation, Order, Settings } from "@/lib/types";

const pageTitleClasses =
  "mb-6 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl lg:text-[34px] leading-tight";

const sectionTitleClasses = "mb-4 font-display text-xl font-semibold text-ink sm:text-2xl";

const inputClasses =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-ink placeholder:text-muted focus:border-line-strong focus:outline-none";

const submitCtaClasses =
  "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-medium text-white transition hover:bg-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50";

export default function B2BCheckoutPage() {
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const router = useRouter();
  const { items, clearCart } = useB2bCart();
  const { token, user } = useB2bAuth();

  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [validation, setValidation] = useState<CartValidation | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+7");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"pickup" | "delivery">("pickup");
  const [storeId, setStoreId] = useState<number | null>(null);
  const [addressId, setAddressId] = useState<number | "new">("new");
  const [address, setAddress] = useState({ city: "", street: "", building: "", apartment: "", comment: "" });
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // Bumped after a rejected order so the cart is re-checked against fresh stock.
  const [checkRound, setCheckRound] = useState(0);
  // Set once the order exists: clearCart() empties the cart, and the
  // "empty cart → back to /cart" redirect must not win over the success page.
  const placed = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (user) {
      setName((current) => current || user.name);
      setPhone((current) => (current === "+7" ? (user.phone ?? "+7") : current));
      setEmail((current) => current || (user.email?.includes("@customer.paradise.kz") ? "" : (user.email ?? "")));
    }
  }, [user]);

  useEffect(() => {
    if (!token) return;
    void apiGet<{ data: Settings }>("/public/settings", { token, revalidate: false }).then((response) => {
      setSettings(response.data);
      setStoreId((current) => current ?? response.data.stores.find((s) => s.is_default)?.id ?? response.data.stores[0]?.id ?? null);
    });
  }, [token]);

  useEffect(() => {
    if (token) {
      void apiGet<{ data: Address[] }>("/account/addresses", { token, revalidate: false })
        .then((response) => {
          setAddresses(response.data);
          const preferred = response.data.find((a) => a.is_default) ?? response.data[0];
          if (preferred) {
            setAddressId(preferred.id);
          }
        })
        .catch(() => setAddresses([]));
    }
  }, [token]);

  useEffect(() => {
    if (!mounted || items.length === 0 || !token) {
      return;
    }
    void apiPost<{ data: CartValidation }>(
      "/cart/validate",
      {
        store_id: storeId ?? undefined,
        items: items.filter(i => i.product?.id).map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
      },
      { token, locale: "ru" },
    )
      .then((response) => setValidation(response.data))
      .catch(() => setValidation(null));
  }, [mounted, items, storeId, token, checkRound]);

  const problemLines = useMemo(
    () => (validation ? validation.items.filter((line) => !line.available) : []),
    [validation],
  );

  useEffect(() => {
    if (mounted && items.length === 0 && !placed.current) {
      router.replace("/cart");
    }
  }, [mounted, items.length, router]);

  if (!mounted || items.length === 0) {
    return null;
  }

  const canSubmit = validation !== null && problemLines.length === 0 && storeId !== null;

  const deliveryCost = method === "delivery" ? (validation?.delivery_cost ?? 0) : 0;
  const subtotal = validation?.subtotal ?? 0;

  async function submit() {
    setBusy(true);
    setErrors([]);
    try {
      // The whole cart as checked above — POST /orders rejects it as a whole
      // (422, nothing reserved) if stock ran out in the meantime.
      const payload = {
        store_id: storeId,
        comment: comment || undefined,
        items: validation!.items.map((line) => ({ product_id: line.product_id, quantity: line.quantity })),
        delivery:
          method === "delivery"
            ? addressId !== "new"
              ? { method: "delivery", address_id: addressId }
              : { method: "delivery", ...address, apartment: address.apartment || undefined, comment: address.comment || undefined }
            : undefined,
      };

      const response = await apiPost<{ data: Order }>("/orders", payload, { token, locale: "ru" });

      placed.current = true;
      clearCart();
      sessionStorage.setItem("last-order", JSON.stringify(response.data));
      router.push(`/checkout/success?number=${encodeURIComponent(response.data.number)}`);
    } catch (e) {
      setErrors(e instanceof ApiValidationError ? e.messages : ["Не удалось оформить заказ. Попробуйте ещё раз."]);
      if (e instanceof ApiValidationError) {
        setCheckRound((round) => round + 1);
      }
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className={pageTitleClasses}>{t("title")}</h1>

      <form
        className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-10">
          <section>
            <h2 className={sectionTitleClasses}>{t("contacts")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("name")}
                aria-label={t("name")}
                className={inputClasses}
              />
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("phone")}
                aria-label={t("phone")}
                className={inputClasses}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("email")}
                aria-label={t("email")}
                className={`${inputClasses} sm:col-span-2`}
              />
            </div>
          </section>

          <section>
            <h2 className={sectionTitleClasses}>{t("receiving")}</h2>
            <div className="mb-4 flex gap-2">
              {(["pickup", "delivery"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMethod(option)}
                  className={`rounded-full border px-4 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    method === option
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink hover:border-ink"
                  }`}
                >
                  {t(option)}
                </button>
              ))}
            </div>

            <label className="mb-4 block text-sm">
              <span className="mb-1.5 block text-muted">{t("store")}</span>
              <select
                value={storeId ?? ""}
                onChange={(e) => setStoreId(Number(e.target.value))}
                className={inputClasses}
              >
                {(settings?.stores ?? []).map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                    {store.address ? ` — ${store.address}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {method === "delivery" ? (
              <div className="space-y-3">
                {addresses.length > 0 ? (
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-muted">{t("savedAddress")}</span>
                    <select
                      value={addressId}
                      onChange={(e) => setAddressId(e.target.value === "new" ? "new" : Number(e.target.value))}
                      className={inputClasses}
                    >
                      {addresses.map((saved) => (
                        <option key={saved.id} value={saved.id}>
                          {saved.city}, {saved.street} {saved.building}
                          {saved.apartment ? `, кв. ${saved.apartment}` : ""}
                        </option>
                      ))}
                      <option value="new">{t("newAddress")}</option>
                    </select>
                  </label>
                ) : null}

                {addressId === "new" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      required
                      value={address.city}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      placeholder={t("city")}
                      aria-label={t("city")}
                      className={inputClasses}
                    />
                    <input
                      required
                      value={address.street}
                      onChange={(e) => setAddress({ ...address, street: e.target.value })}
                      placeholder={t("street")}
                      aria-label={t("street")}
                      className={inputClasses}
                    />
                    <input
                      required
                      value={address.building}
                      onChange={(e) => setAddress({ ...address, building: e.target.value })}
                      placeholder={t("building")}
                      aria-label={t("building")}
                      className={inputClasses}
                    />
                    <input
                      value={address.apartment}
                      onChange={(e) => setAddress({ ...address, apartment: e.target.value })}
                      placeholder={t("apartment")}
                      aria-label={t("apartment")}
                      className={inputClasses}
                    />
                    <input
                      value={address.comment}
                      onChange={(e) => setAddress({ ...address, comment: e.target.value })}
                      placeholder={t("addressComment")}
                      aria-label={t("addressComment")}
                      className={`${inputClasses} sm:col-span-2`}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("orderComment")}
              aria-label={t("orderComment")}
              rows={3}
              className={`${inputClasses} resize-none`}
            />
          </section>
        </div>

        <aside className="rounded-2xl border border-line bg-white p-5 sm:p-6 lg:sticky lg:top-[120px]">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between text-muted">
              <span>{t("subtotal")}</span>
              <span className="text-ink">{formatPrice(subtotal, "ru")}</span>
            </div>
            <div className="flex items-center justify-between text-muted">
              <span>{t("deliveryCost")}</span>
              <span className="text-ink">
                {method === "pickup" || deliveryCost === 0 ? t("free") : formatPrice(deliveryCost, "ru")}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-base font-medium text-ink">{t("total")}</span>
            <span className="text-xl font-semibold text-ink">{formatPrice(subtotal + deliveryCost, "ru")}</span>
          </div>

          {problemLines.length > 0 ? (
            <div role="alert" className="mt-4 rounded-xl border border-sale/30 bg-sale/5 p-3 text-sm text-sale">
              <p className="font-medium">{tCart("fixBeforeCheckout")}</p>
              <ul className="mt-1 space-y-0.5">
                {problemLines.map((line) => (
                  <li key={line.product_id}>
                    {line.name ?? `#${line.product_id}`}: {tCart(`problems.${line.problem ?? "unavailable"}`)}
                    {line.problem === "insufficient_stock" ? ` — ${tCart("inStockOnly", { count: Math.floor(line.stock) })}` : ""}
                  </li>
                ))}
              </ul>
              <Link href="/cart" className="mt-2 inline-block font-medium text-ink underline underline-offset-2">
                {tCart("title")}
              </Link>
            </div>
          ) : null}

          {errors.length > 0 ? (
            <div className="mt-4 rounded-xl border border-sale/30 bg-sale/5 p-3">
              <ul className="space-y-1 text-sm font-medium text-sale">
                {errors.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy || !canSubmit}
            className={submitCtaClasses}
          >
            {busy ? t("submitting") : t("submit")}
          </button>
        </aside>
      </form>
    </div>
  );
}
