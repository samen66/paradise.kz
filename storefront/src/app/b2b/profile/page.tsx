"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { apiPatch, ApiValidationError } from "@/lib/api";
import { useB2bAuth } from "@/stores/useB2bAuth";
import type { ApiUser } from "@/lib/types";

const inputClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-ink placeholder:text-muted focus:border-line-strong focus:outline-none disabled:bg-surface disabled:text-muted";

export default function B2BProfilePage() {
  const t = useTranslations("account");
  const router = useRouter();
  const { token, user, setUser } = useB2bAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email ?? "");
      setPhone(user.phone ?? "");
    }
  }, [user]);

  async function save() {
    setErrors([]);
    setSaved(false);
    try {
      // The API patch endpoint for account updates should work identically if 
      // the B2B token is provided, since it's the same self-scoped controller
      const response = await apiPatch<{ user: ApiUser }>(
        "/account/profile",
        { name, email: email || null, phone: phone || null },
        { token },
      );
      setUser(response.user);
      setSaved(true);
      setIsEditing(false);
    } catch (e) {
      setErrors(e instanceof ApiValidationError ? e.messages : ["Ошибка сохранения."]);
    }
  }

  function cancelEdit() {
    setIsEditing(false);
    setErrors([]);
    if (user) {
      setName(user.name);
      setEmail(user.email ?? "");
      setPhone(user.phone ?? "");
    }
  }

  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-ink">Профиль компании</h1>
        <p className="mt-2 text-muted">Управление данными вашего оптового аккаунта.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Profile Info */}
        <div className="rounded-2xl border border-line bg-white p-6">
          <h2 className="mb-6 font-display text-xl font-semibold text-ink">Контактные данные</h2>
          
          {isEditing ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted">{t("nameLabel")} (ФИО)</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted">{t("emailLabel")}</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted">{t("phoneLabel")}</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
              </label>

              {errors.length > 0 && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
                  <ul className="list-inside list-disc">
                    {errors.map((message, index) => (
                      <li key={index}>{message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-medium text-white transition hover:bg-ink-hover"
                >
                  {t("save")}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-xl border border-line-strong bg-white px-6 py-3.5 text-sm font-medium text-ink hover:border-ink transition"
                >
                  {t("cancel")}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted">{t("nameLabel")} (ФИО)</dt>
                  <dd className="mt-1 text-base font-medium text-ink">{user?.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">{t("phoneLabel")}</dt>
                  <dd className="mt-1 text-base font-medium text-ink">{user?.phone || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted">{t("emailLabel")}</dt>
                  <dd className="mt-1 text-base font-medium text-ink">{user?.email || "—"}</dd>
                </div>
              </dl>

              {saved && <p className="text-sm font-medium text-mint-ink">{t("profileSaved")}</p>}

              <div className="border-t border-line pt-6">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-xl bg-surface px-6 py-3 text-sm font-medium text-ink transition hover:bg-black/5"
                >
                  {t("edit")} данные
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Company Info (Read-only) */}
        <div className="rounded-2xl border border-line bg-surface p-6 h-fit">
          <h2 className="mb-6 font-display text-xl font-semibold text-ink">Юридические данные</h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-muted">Название компании</dt>
              <dd className="mt-1 text-base font-medium text-ink">{user?.company_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">БИН/ИИН компании</dt>
              <dd className="mt-1 text-base font-medium text-ink">{user?.company_bin || "—"}</dd>
            </div>
          </dl>
          <p className="mt-6 text-xs text-muted">
            Для изменения юридических данных компании, пожалуйста, свяжитесь с вашим менеджером.
          </p>
        </div>
      </div>
    </div>
  );
}
