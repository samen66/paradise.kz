"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useB2bAuth } from "@/stores/useB2bAuth";
import { apiPost, ApiValidationError } from "@/lib/api";
import type { ApiUser } from "@/lib/types";

export default function B2BRegisterPage() {
  const router = useRouter();
  const setSession = useB2bAuth((state) => state.setSession);

  const [companyName, setCompanyName] = useState("");
  const [companyBin, setCompanyBin] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirmation) {
      setError("Пароли не совпадают");
      return;
    }

    setIsLoading(true);

    try {
      const payload: any = {
        company_name: companyName,
        company_bin: companyBin,
        phone,
        password,
        password_confirmation: passwordConfirmation,
      };

      if (email.trim() !== "") {
        payload.email = email;
      }

      const response = await apiPost<{ token: string; user: ApiUser }>("/auth/register", payload);

      setSession(response.token, response.user);
      document.cookie = `laravel_session=${response.token}; path=/; max-age=86400`;

      router.push("/b2b/pending");
    } catch (err: any) {
      if (err instanceof ApiValidationError) {
        setError(err.messages.join(", "));
      } else {
        setError("Произошла ошибка при регистрации");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-line p-8">
        <h1 className="text-2xl font-display font-bold text-center text-ink mb-2">Регистрация оптовика</h1>
        <p className="text-center text-sm text-muted mb-6">Оставьте заявку на доступ к оптовым ценам</p>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Название компании <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ink"
              placeholder="ТОО Пример"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">БИН компании <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={companyBin}
              onChange={(e) => setCompanyBin(e.target.value)}
              required
              maxLength={12}
              pattern="^\d{12}$"
              title="БИН должен состоять из 12 цифр"
              className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ink"
              placeholder="123456789012"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Номер телефона <span className="text-red-500">*</span></label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ink"
              placeholder="+7 (___) ___-__-__"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Email <span className="text-muted font-normal">(необязательно)</span></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ink"
              placeholder="company@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Пароль <span className="text-red-500">*</span></label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ink"
              placeholder="Минимум 8 символов"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Повторите пароль <span className="text-red-500">*</span></label>
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ink"
              placeholder="Минимум 8 символов"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-ink text-white py-3 rounded-lg font-medium hover:bg-ink-hover transition-colors disabled:opacity-50 mt-4"
          >
            {isLoading ? "Отправка..." : "Зарегистрироваться"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted">
          Уже есть аккаунт?{" "}
          <Link href="/b2b/login" className="text-ink font-medium hover:underline">
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
