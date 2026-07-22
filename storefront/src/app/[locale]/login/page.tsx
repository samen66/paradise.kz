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

  // Original state logic
  const [phone, setPhone] = useState("+7");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // New state logic
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");

  const isLogin = mode === "login";

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiPost<{ token: string; user: ApiUser }>("/public/auth/otp/verify", {
        phone,
        code: code || "0000", // dummy code if we're simulating password for now
      });
      setSession(response.token, response.user);
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

  const perks = [
    { icon: "📦", title: "История заказов", text: "Статусы доставки, повтор заказа в один клик и электронные чеки." },
    { icon: "♡", title: "Избранное", text: "Сохраняйте мебель, сравнивайте и получайте уведомления о скидках." },
    { icon: "🏠", title: "Адреса и получатели", text: "Оформляйте доставку без повторного ввода данных." },
  ];

  return (
    <div className="-mx-4 -mt-8 sm:-mx-6 sm:-mt-8 lg:-mx-10 lg:-mt-8 flex min-h-[calc(100vh-70px)] flex-col md:flex-row items-stretch bg-white">
      {/* Left Column (Form) */}
      <div className="flex flex-1 items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-[420px]">
          <h1 className="mb-2 font-display text-3xl font-bold tracking-tight text-ink">
            {isLogin ? "С возвращением" : "Создайте аккаунт"}
          </h1>
          <p className="mb-7 text-sm text-muted">
            {isLogin
              ? "Войдите, чтобы видеть заказы, избранное и адреса доставки."
              : "Одна минута — и покупки станут быстрее."}
          </p>

          <div className="mb-7 grid grid-cols-2 gap-1 rounded-full bg-[#f0eee9] p-1">
            <button
              onClick={() => setMode("login")}
              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
                isLogin ? "bg-white text-ink shadow-sm" : "bg-transparent text-muted"
              }`}
            >
              Вход
            </button>
            <button
              onClick={() => setMode("register")}
              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
                !isLogin ? "bg-white text-ink shadow-sm" : "bg-transparent text-muted"
              }`}
            >
              Регистрация
            </button>
          </div>

          {error ? <p className="mb-4 text-sm text-sale">{error}</p> : null}

          {isLogin ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void verify();
              }}
              className="flex flex-col gap-4"
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ink">Телефон или e-mail</span>
                <input
                  type="text"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+7 (___) ___-__-__"
                  autoFocus
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-ink">Пароль</span>
                  <a href="#" className="text-[13px] text-muted hover:text-ink">
                    Забыли пароль?
                  </a>
                </div>
                <input
                  type="password"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="••••••••"
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
            </form>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void verify();
              }}
              className="flex flex-col gap-4"
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ink">Имя</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Как к вам обращаться"
                  autoFocus
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ink">Телефон</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+7 (___) ___-__-__"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ink">Пароль</span>
                <input
                  type="password"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Минимум 8 символов"
                  className={inputClass}
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="mt-1 w-full rounded-xl bg-ink py-3 font-medium text-white transition hover:bg-ink-hover disabled:opacity-50"
              >
                Создать аккаунт
              </button>
              <p className="text-center text-xs leading-relaxed text-muted">
                Нажимая «Создать аккаунт», вы соглашаетесь с{" "}
                <a href="#" className="hover:text-ink">
                  условиями сервиса
                </a>{" "}
                и{" "}
                <a href="#" className="hover:text-ink">
                  политикой конфиденциальности
                </a>
              </p>
            </form>
          )}

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-line"></div>
            <span className="text-xs text-muted">или</span>
            <div className="h-px flex-1 bg-line"></div>
          </div>
          <button className="flex w-full items-center justify-center gap-2.5 rounded-full border border-line bg-white p-3 text-sm font-semibold text-ink transition-colors hover:bg-surface">
            <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-[#c8372f] text-[12px] font-bold text-white">
              K
            </span>
            Продолжить с Kaspi ID
          </button>
        </div>
      </div>

      {/* Right Column (Perks) */}
      <div className="flex flex-1 items-center justify-center bg-[#f6efe3] p-8 sm:p-12">
        <div className="flex max-w-[440px] flex-col gap-7">
          <h2 className="font-display text-[28px] font-bold leading-tight tracking-tight text-ink">
            Личный кабинет — это удобно
          </h2>
          <div className="flex flex-col gap-4">
            {perks.map((perk, i) => (
              <div key={i} className="flex items-start gap-3.5">
                <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-white text-[17px] shadow-[0_1px_2px_rgba(28,26,23,0.06)]">
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

