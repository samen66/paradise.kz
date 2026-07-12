"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { apiPost, ApiValidationError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ApiUser } from "@/lib/types";

function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuth((state) => state.setSession);

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("+7");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    setBusy(true);
    setError(null);
    try {
      await apiPost("/public/auth/otp/request", { phone });
      setStep("code");
      setCode("");
    } catch (e) {
      setError(e instanceof ApiValidationError ? e.messages.join(" ") : "Ошибка. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiPost<{ token: string; user: ApiUser }>("/public/auth/otp/verify", {
        phone,
        code,
      });
      setSession(response.token, response.user);
      // Set cookie for middleware
      document.cookie = `laravel_session=${response.token}; path=/; max-age=86400`;
      router.push(searchParams.get("next") ?? "/account/orders");
    } catch (e) {
      setError(e instanceof ApiValidationError ? e.messages.join(" ") : "Ошибка. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-ink outline-none focus:border-line-strong";

  return (
    <div className="mx-auto max-w-md py-12">
      <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
        <h1 className="mb-6 font-display text-2xl font-semibold tracking-tight text-ink">{t("loginTitle")}</h1>

        {step === "phone" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void requestCode();
            }}
            className="space-y-4"
          >
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">{t("phoneLabel")}</span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+7 700 000 00 00"
                autoFocus
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-muted">{t("phoneHint")}</span>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-ink py-3 font-medium text-white transition hover:bg-ink-hover disabled:opacity-50"
            >
              {t("sendCode")}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void verify();
            }}
            className="space-y-4"
          >
            <p className="text-sm text-muted">{t("codeSent", { phone })}</p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">{t("codeLabel")}</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                autoFocus
                className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
              />
            </label>
            <button
              type="submit"
              disabled={busy || code.length !== 4}
              className="w-full rounded-xl bg-ink py-3 font-medium text-white transition hover:bg-ink-hover disabled:opacity-50"
            >
              {t("confirm")}
            </button>
            <div className="flex justify-between text-sm">
              <button type="button" onClick={() => setStep("phone")} className="text-muted hover:text-ink">
                {t("changePhone")}
              </button>
              <button type="button" onClick={() => void requestCode()} className="text-muted hover:text-ink">
                {t("resend")}
              </button>
            </div>
          </form>
        )}

        {error ? <p className="mt-4 text-sm text-sale">{error}</p> : null}
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary for static prerendering.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
