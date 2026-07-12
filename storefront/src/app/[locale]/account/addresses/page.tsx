"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiDelete, apiGet, apiPatch, apiPost, ApiValidationError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Address } from "@/lib/types";

const emptyForm = { city: "", street: "", building: "", apartment: "", comment: "" };

export default function AccountAddressesPage() {
  const t = useTranslations("account");
  const tCheckout = useTranslations("checkout");
  const token = useAuth((state) => state.token);

  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<string[]>([]);

  const reload = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const response = await apiGet<{ data: Address[] }>("/account/addresses", { token, revalidate: false });
      setAddresses(response.data);
    } catch {
      setAddresses([]);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function create() {
    setErrors([]);
    try {
      await apiPost("/account/addresses", { ...form, apartment: form.apartment || undefined, comment: form.comment || undefined }, { token });
      setForm(emptyForm);
      setShowForm(false);
      await reload();
    } catch (e) {
      setErrors(e instanceof ApiValidationError ? e.messages : ["Ошибка сохранения."]);
    }
  }

  async function makeDefault(address: Address) {
    await apiPatch(`/account/addresses/${address.id}`, {
      city: address.city,
      street: address.street,
      building: address.building,
      apartment: address.apartment ?? undefined,
      comment: address.comment ?? undefined,
      is_default: true,
    }, { token });
    await reload();
  }

  async function destroy(address: Address) {
    await apiDelete(`/account/addresses/${address.id}`, { token });
    await reload();
  }

  if (addresses === null) {
    return null;
  }

  const inputClass =
    "rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted outline-none focus:border-line-strong";

  return (
    <div className="max-w-xl">
      <h2 className="mb-4 font-display text-2xl font-semibold text-ink">{t("addresses")}</h2>

      {addresses.length === 0 ? <p className="mb-4 text-muted">{t("noAddresses")}</p> : null}

      <ul className="mb-6 space-y-2">
        {addresses.map((address) => (
          <li key={address.id} className="flex items-center justify-between gap-4 rounded-2xl border border-line p-4 text-sm text-ink">
            <span>
              {address.city}, {address.street} {address.building}
              {address.apartment ? `, кв. ${address.apartment}` : ""}
              {address.is_default ? (
                <span className="ml-2 rounded-full bg-mint px-2 py-0.5 text-xs font-medium text-mint-ink">
                  {t("defaultAddress")}
                </span>
              ) : null}
            </span>
            <span className="flex gap-3 whitespace-nowrap">
              {!address.is_default ? (
                <button type="button" onClick={() => void makeDefault(address)} className="text-ink hover:underline">
                  {t("makeDefault")}
                </button>
              ) : null}
              <button type="button" onClick={() => void destroy(address)} className="text-muted transition hover:text-sale">
                {t("delete")}
              </button>
            </span>
          </li>
        ))}
      </ul>

      {showForm ? (
        <form
          className="space-y-3 rounded-2xl border border-line p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder={tCheckout("city")} className={inputClass} />
            <input required value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} placeholder={tCheckout("street")} className={inputClass} />
            <input required value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} placeholder={tCheckout("building")} className={inputClass} />
            <input value={form.apartment} onChange={(e) => setForm({ ...form, apartment: e.target.value })} placeholder={tCheckout("apartment")} className={inputClass} />
            <input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder={tCheckout("addressComment")} className={`${inputClass} sm:col-span-2`} />
          </div>
          {errors.map((message, index) => (
            <p key={index} className="text-sm text-sale">{message}</p>
          ))}
          <div className="flex gap-2">
            <button type="submit" className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-ink-hover">
              {t("save")}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-line-strong px-5 py-2.5 text-sm text-ink transition hover:border-ink">
              {t("cancel")}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-ink-hover"
        >
          {t("addAddress")}
        </button>
      )}
    </div>
  );
}
