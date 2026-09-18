"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { apiPost, ApiValidationError } from "@/lib/api";
import type { ApiUser } from "@/lib/types";
import { authInputClass, authPrimaryButtonClass } from "./AuthCard";
import { FieldError } from "./FieldError";

const RESEND_SECONDS = 60;

type Errors = Record<string, string[]>;

type Props = {
  intent: "register" | "login";
  /** Sent with both calls — registration passes name and company_name. */
  payload?: Record<string, string>;
  /** Extra inputs rendered above the phone on the first step. */
  fields?: (errors: Errors) => ReactNode;
  submitLabel: string;
  onSuccess: (token: string, user: ApiUser) => void;
};

/**
 * Two steps: phone (+ caller's fields) → "Получить код" → 4-digit code.
 * Preconditions (number taken / unknown) come back as 422 on the first call,
 * before any SMS is sent.
 */
export function PhoneCodeForm({ intent, payload = {}, fields, submitLabel, onSuccess }: Props) {
  const t = useTranslations("b2bAuth");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const fail = (err: unknown) => {
    if (err instanceof ApiValidationError) {
      setErrors(err.errors);
      setError(null);
    } else {
      setError(t("genericError"));
    }
  };

  const requestCode = async () => {
    setIsLoading(true);
    setErrors({});
    setError(null);
    try {
      await apiPost("/auth/otp/request", { phone, intent, ...payload });
      setStep("code");
      setCode("");
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      fail(err);
    } finally {
      setIsLoading(false);
    }
  };

  const confirm = async () => {
    setIsLoading(true);
    setErrors({});
    setError(null);
    try {
      const response = await apiPost<{ token: string; user: ApiUser }>(`/auth/otp/${intent}`, {
        phone,
        code,
        ...payload,
      });
      onSuccess(response.token, response.user);
    } catch (err) {
      fail(err);
      // Number-level problems (taken meanwhile, bad name) are fixed on step one.
      if (err instanceof ApiValidationError && !err.errors.code) {
        setStep("phone");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void (step === "phone" ? requestCode() : confirm());
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div> : null}

      {step === "phone" ? (
        <>
          {fields?.(errors)}
          <div>
            <label htmlFor="otp-phone" className="block text-sm font-medium text-ink mb-1">
              {t("phone")} <span className="text-red-500">*</span>
            </label>
            <input
              id="otp-phone"
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={authInputClass}
              placeholder="+7 (___) ___-__-__"
            />
            <FieldError messages={errors.phone} />
          </div>
          <button type="submit" disabled={isLoading || phone.trim() === ""} className={authPrimaryButtonClass}>
            {isLoading ? t("sending") : t("sendCode")}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">{t("codeSent", { phone })}</p>
          <div>
            <label htmlFor="otp-code" className="block text-sm font-medium text-ink mb-1">
              {t("code")}
            </label>
            <input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className={`${authInputClass} text-center text-2xl tracking-[0.5em]`}
            />
            <FieldError messages={errors.code} />
          </div>
          <button type="submit" disabled={isLoading || code.length !== 4} className={authPrimaryButtonClass}>
            {submitLabel}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setErrors({});
                setError(null);
              }}
              className="text-muted hover:text-ink"
            >
              {t("changePhone")}
            </button>
            <button
              type="button"
              disabled={resendIn > 0 || isLoading}
              onClick={() => void requestCode()}
              className="text-ink hover:underline disabled:text-muted disabled:no-underline"
            >
              {resendIn > 0 ? t("resendIn", { seconds: resendIn }) : t("resend")}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
