"use client";

import { Suspense, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { getPathname } from "@/i18n/navigation";
import { apiPost, ApiValidationError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ApiUser } from "@/lib/types";

/** Where to go after login: only a same-site path, never another origin. */
function safeNextPath(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/account/orders";
}

function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const setSession = useAuth((state) => state.setSession);

  const [phone, setPhone] = useState("+7");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"phone" | "code">("phone");

  async function requestCode() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11 || !digits.startsWith("7")) {
      setError("Введите корректный номер телефона (напр. +7 777 123 45 67)");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await apiPost("/public/auth/otp/request", { phone });
      setStep("code");
    } catch (e) {
      setError(e instanceof ApiValidationError ? e.messages.join(" ") : "Ошибка. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (code.length < 4) {
      setError("Код состоит из 4 цифр.");
      return;
    }

    setBusy(true);
    setError(null);
    let response: { token: string; user: ApiUser };
    try {
      response = await apiPost<{ token: string; user: ApiUser }>("/public/auth/otp/verify", {
        phone,
        code,
      });
    } catch (e) {
      setError(e instanceof ApiValidationError ? e.messages.join(" ") : "Неверный код. Попробуйте ещё раз.");
      setBusy(false);
      return;
    }

    setSession(response.token, response.user);
    document.cookie = `laravel_session=${response.token}; path=/; max-age=86400`;
    // A full page load, not router.push: if the visitor got here because the
    // middleware bounced /account → /login (cookie expired, token still in
    // localStorage), the client router has cached that redirect and would
    // replay it, leaving a signed-in visitor on the login page. The button
    // stays busy until the new page takes over.
    window.location.assign(getPathname({ href: safeNextPath(searchParams.get("next")), locale }));
  }

  const inputClass =
    "w-full rounded-xl border border-line bg-transparent px-3 py-2.5 text-ink outline-none focus:border-line-strong";

  const perks = [
    { icon: "📦", title: "История заказов", text: "Статусы доставки, повтор заказа в один клик и электронные чеки." },
    { icon: "♡", title: "Избранное", text: "Сохраняйте мебель, сравнивайте и получайте уведомления о скидках." },
    { icon: "🏠", title: "Адреса и получатели", text: "Оформляйте доставку без повторного ввода данных." },
  ];

  return (
    <div className="-mx-4 -mt-8 sm:-mx-6 sm:-mt-8 lg:-mx-10 lg:-mt-8 flex min-h-[calc(100vh-70px)] flex-col md:flex-row items-stretch bg-surface">
      {/* Left Column (Form) */}
      <div className="flex flex-1 items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-[420px]">
          <h1 className="mb-2 font-display text-3xl font-bold tracking-tight text-ink">
            {step === "phone" ? "Вход или регистрация" : "Введите код"}
          </h1>
          <p className="mb-7 text-sm text-muted">
            {step === "phone"
              ? "Войдите или создайте аккаунт, чтобы видеть заказы, избранное и адреса доставки."
              : `Код отправлен на номер ${phone}`}
          </p>

          {error ? <p className="mb-4 text-sm text-sale">{error}</p> : null}

          {step === "phone" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void requestCode();
              }}
              className="flex flex-col gap-4"
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ink">Телефон</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+7 (___) ___-__-__"
                  autoFocus
                  required
                  className={inputClass}
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="mt-1 w-full rounded-xl bg-ink py-3 font-medium text-white transition hover:bg-ink-hover disabled:opacity-50"
              >
                Получить код
              </button>
            </form>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void verifyCode();
              }}
              className="flex flex-col gap-4"
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ink">Код из SMS</span>
                <input
                  type="text"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="1234"
                  autoFocus
                  required
                  maxLength={4}
                  className={inputClass}
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="mt-1 w-full rounded-xl bg-ink py-3 font-medium text-white transition hover:bg-ink-hover disabled:opacity-50"
              >
                Войти
              </button>
              <button
                type="button"
                onClick={() => setStep("phone")}
                className="text-sm text-muted hover:text-ink mt-2"
              >
                Изменить номер
              </button>
            </form>
          )}

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-line"></div>
            <span className="text-xs text-muted">или</span>
            <div className="h-px flex-1 bg-line"></div>
          </div>
          <button className="flex w-full items-center justify-center gap-2.5 rounded-full border border-line bg-transparent p-3 text-sm font-semibold text-ink transition-colors hover:bg-panel">
            <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-[#c8372f] text-[12px] font-bold text-white">
              K
            </span>
            Продолжить с Kaspi ID
          </button>
        </div>
      </div>

      {/* Right Column (Perks) */}
      <div className="flex flex-1 items-center justify-center bg-panel p-8 sm:p-12">
        <div className="flex max-w-[440px] flex-col gap-7">
          <h2 className="font-display text-[28px] font-bold leading-tight tracking-tight text-ink">
            Личный кабинет — это удобно
          </h2>
          <div className="flex flex-col gap-4">
            {perks.map((perk, i) => (
              <div key={i} className="flex items-start gap-3.5">
                <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-surface text-[17px] shadow-sm">
                  {perk.icon}
                </div>
                <div>
                  <div className="mb-0.5 text-[15px] font-semibold text-ink">{perk.title}</div>
                  <div className="text-[13px] leading-relaxed text-muted">{perk.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
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

