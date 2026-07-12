"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { apiPatch, apiPost, ApiValidationError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ApiUser } from "@/lib/types";

const inputClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-ink placeholder:text-muted focus:border-line-strong focus:outline-none";

export default function AccountProfilePage() {
  const t = useTranslations("account");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const { token, user, setUser, clear } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
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
      setEmail(user.email?.includes("@customer.paradise.kz") ? "" : (user.email ?? ""));
    }
  }

  async function logout() {
    try {
      await apiPost("/account/logout", {}, { token });
    } catch {
      // The local session is cleared regardless.
    }
    clear();
    router.push("/");
  }

  const displayEmail = user?.email?.includes("@customer.paradise.kz") ? null : user?.email;

  return (
    <div className="max-w-md rounded-2xl border border-line bg-white p-6">
      {isEditing ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">{t("nameLabel")}</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">{t("emailLabel")}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </label>

          {errors.map((message, index) => (
            <p key={index} className="text-sm text-sale">
              {message}
            </p>
          ))}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-medium text-white transition hover:bg-ink-hover"
            >
              {t("save")}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-xl border border-line-strong bg-white px-6 py-3.5 text-sm font-medium text-ink hover:border-ink"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-muted">{t("nameLabel")}</dt>
              <dd className="mt-0.5 text-base text-ink">{user?.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">{t("emailLabel")}</dt>
              <dd className="mt-0.5 text-base text-ink">{displayEmail || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">{t("phoneLabel")}</dt>
              <dd className="mt-0.5 text-base text-ink">{user?.phone ?? "—"}</dd>
            </div>
          </dl>

          {saved ? <p className="mt-4 text-sm text-mint-ink">{t("profileSaved")}</p> : null}

          <div className="mt-6 flex items-center gap-5 border-t border-line pt-5">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-sm font-medium text-ink underline underline-offset-4 hover:no-underline"
            >
              {t("edit")}
            </button>
            <button type="button" onClick={() => void logout()} className="text-sm text-muted hover:text-ink">
              {tAuth("logout")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
