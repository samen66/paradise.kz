"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useB2bAuth } from "@/stores/useB2bAuth";
import { apiPost, ApiError, ApiValidationError } from "@/lib/api";
import type { ApiUser } from "@/lib/types";
import { AuthCard, authInputClass, authPrimaryButtonClass } from "@/components/auth/AuthCard";
import { PhoneCodeForm } from "@/components/auth/PhoneCodeForm";

type Mode = "password" | "sms";

export default function B2BLoginPage() {
  const t = useTranslations("b2bAuth");
  const router = useRouter();
  const setSession = useB2bAuth((state) => state.setSession);

  const [mode, setMode] = useState<Mode>("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const signedIn = (token: string, user: ApiUser) => {
    setSession(token, user);
    router.push("/catalog");
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const response = await apiPost<{ token: string; user: ApiUser }>("/auth/login", {
        phone,
        password,
        device_name: "b2b_web",
      });
      signedIn(response.token, response.user);
    } catch (err: unknown) {
      if (err instanceof ApiValidationError) {
        setError(err.messages.join(", "));
      } else if (err instanceof ApiError && err.status === 401) {
        setError(t("wrongCredentials"));
      } else {
        setError(t("genericError"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const tabClass = (active: boolean) =>
    `flex-1 rounded-md py-2 text-sm font-medium transition ${active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`;

  return (
    <AuthCard
      brand={t("brand")}
      title={t("loginTitle")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href="/register" className="text-ink font-medium hover:underline">
            {t("toRegister")}
          </Link>
        </>
      }
    >
      <div className="mb-6 flex gap-1 rounded-lg bg-surface p-1" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "password"} className={tabClass(mode === "password")} onClick={() => setMode("password")}>
          {t("tabPassword")}
        </button>
        <button type="button" role="tab" aria-selected={mode === "sms"} className={tabClass(mode === "sms")} onClick={() => setMode("sms")}>
          {t("tabSms")}
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={submitPassword} className="space-y-4">
          {error ? <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div> : null}
          <div>
            <label htmlFor="login-phone" className="block text-sm font-medium text-ink mb-1">{t("phone")}</label>
            <input
              id="login-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className={authInputClass}
              placeholder="+7 (___) ___-__-__"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-ink mb-1">{t("password")}</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={authInputClass}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={isLoading} className={`${authPrimaryButtonClass} mt-4`}>
            {isLoading ? t("loggingIn") : t("login")}
          </button>
        </form>
      ) : (
        <PhoneCodeForm intent="login" submitLabel={t("login")} onSuccess={signedIn} />
      )}
    </AuthCard>
  );
}
