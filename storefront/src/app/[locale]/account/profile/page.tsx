"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { apiDelete, apiGet, apiPatch, apiPost, ApiValidationError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ApiUser, Address } from "@/lib/types";

const inputClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-line-strong focus:outline-none transition-colors";

function NotificationsSection() {
  const [sms, setSms] = useState(true);
  const [email, setEmail] = useState(true);
  const [promo, setPromo] = useState(false);

  const toggle = (val: boolean, setter: (v: boolean) => void) => () => setter(!val);

  const items = [
    { key: 'sms', title: 'SMS о статусе заказа', text: 'Подтверждение, отгрузка, доставка', val: sms, setter: setSms },
    { key: 'email', title: 'E-mail чеки', text: 'Электронные чеки после оплаты', val: email, setter: setEmail },
    { key: 'promo', title: 'Акции и скидки', text: 'Не чаще одного раза в неделю', val: promo, setter: setPromo },
  ];

  return (
    <div className="bg-white border border-line rounded-[20px] p-[26px]">
      <h2 className="font-display text-[17px] font-bold text-ink mb-4">Уведомления</h2>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-4 py-2.5 border-b border-line last:border-0">
            <div>
              <div className="text-sm font-medium text-ink">{item.title}</div>
              <div className="text-xs text-muted">{item.text}</div>
            </div>
            <button 
              onClick={toggle(item.val, item.setter)} 
              className={`w-11 h-[26px] rounded-full p-[3px] flex items-center transition-colors shrink-0 ${item.val ? 'bg-ink justify-end' : 'bg-line-strong justify-start'}`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-sm block"></span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddressesSection() {
  const t = useTranslations("account");
  const tCheckout = useTranslations("checkout");
  const token = useAuth((state) => state.token);
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  
  const [showForm, setShowForm] = useState(false);
  const emptyForm = { city: "", street: "", building: "", apartment: "", comment: "" };
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<string[]>([]);

  const reload = useCallback(async () => {
    if (!token) return;
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

  async function destroy(address: Address) {
    await apiDelete(`/account/addresses/${address.id}`, { token });
    await reload();
  }

  if (addresses === null) return null;

  return (
    <div className="bg-white border border-line rounded-[20px] p-[26px]">
      <div className="flex justify-between items-baseline mb-4.5">
        <h2 className="font-display text-[17px] font-bold text-ink m-0">{t("addresses")}</h2>
        {!showForm && (
          <button 
            onClick={() => setShowForm(true)}
            className="border-none bg-transparent text-[13px] font-semibold text-ink cursor-pointer underline underline-offset-4 font-inherit"
          >
            + {t("addAddress")}
          </button>
        )}
      </div>

      {showForm && (
        <form
          className="mb-6 space-y-4 rounded-xl border border-line p-5"
          onSubmit={(e) => { e.preventDefault(); void create(); }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder={tCheckout("city")} className={inputClass} />
            <input required value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} placeholder={tCheckout("street")} className={inputClass} />
            <input required value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} placeholder={tCheckout("building")} className={inputClass} />
            <input value={form.apartment} onChange={(e) => setForm({ ...form, apartment: e.target.value })} placeholder={tCheckout("apartment")} className={inputClass} />
            <input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder={tCheckout("addressComment")} className={`${inputClass} sm:col-span-2`} />
          </div>
          {errors.map((msg, i) => <p key={i} className="text-sm text-sale">{msg}</p>)}
          <div className="flex gap-2">
            <button type="submit" className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-ink-hover">
              {t("save")}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-line-strong px-5 py-2.5 text-sm text-ink transition hover:border-ink">
              {t("cancel")}
            </button>
          </div>
        </form>
      )}

      {addresses.length === 0 && !showForm ? (
        <p className="text-sm text-muted">{t("noAddresses")}</p>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {addresses.map((address) => (
          <div key={address.id} className="border border-line rounded-[14px] p-4 flex flex-col gap-1.5 relative group">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-sm text-ink">{address.city}</span>
              {address.is_default && (
                <span className="rounded-full bg-mint px-2 py-0.5 text-xs font-semibold text-mint-ink">
                  {t("defaultAddress")}
                </span>
              )}
            </div>
            <span className="text-[13px] text-muted leading-relaxed">
              {address.street} {address.building}{address.apartment ? `, кв. ${address.apartment}` : ""}
            </span>
            <button 
              onClick={() => void destroy(address)}
              className="absolute top-4 right-4 text-[13px] text-sale opacity-0 group-hover:opacity-100 transition-opacity font-semibold"
            >
              {t("delete")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AccountProfilePage() {
  const t = useTranslations("account");
  const { token, user, setUser } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email?.includes("@customer.paradise.kz") ? "" : (user.email ?? ""));
    }
  }, [user]);

  async function save() {
    setErrors([]);
    setSaved(false);
    try {
      const response = await apiPatch<{ user: ApiUser }>(
        "/account/profile",
        { name, email: email || null },
        { token },
      );
      setUser(response.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setErrors(e instanceof ApiValidationError ? e.messages : ["Ошибка сохранения."]);
    }
  }

  return (
    <div className="flex flex-col">
      <h1 className="font-display text-[28px] font-bold text-ink m-0 mb-[22px] tracking-tight">{t("profile")}</h1>
      
      <div className="flex flex-col gap-[18px]">
        <div className="bg-white border border-line rounded-[20px] p-[26px]">
          <h2 className="font-display text-[17px] font-bold text-ink m-0 mb-[18px]">Личные данные</h2>
          
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ink">{t("nameLabel")}</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </label>
              
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ink">{t("emailLabel")}</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </label>

              <label className="flex flex-col gap-1.5 opacity-70">
                <span className="text-[13px] font-semibold text-ink">{t("phoneLabel")}</span>
                <input type="tel" value={user?.phone ?? ""} readOnly className={inputClass} />
              </label>
            </div>

            {errors.map((msg, idx) => (
              <p key={idx} className="mt-3 text-sm text-sale">{msg}</p>
            ))}
            
            {saved && (
              <p className="mt-3 text-sm text-mint-ink">{t("profileSaved")}</p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-medium text-white transition hover:bg-ink-hover"
              >
                {t("save")}
              </button>
            </div>
          </form>
        </div>

        <AddressesSection />
        
        <NotificationsSection />
      </div>
    </div>
  );
}
