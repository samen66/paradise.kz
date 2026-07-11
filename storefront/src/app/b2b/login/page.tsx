"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useB2bAuth } from "@/stores/useB2bAuth";
import { apiPost, ApiError, ApiValidationError } from "@/lib/api";
import type { ApiUser } from "@/lib/types";

export default function B2BLoginPage() {
  const router = useRouter();
  const setSession = useB2bAuth((state) => state.setSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiPost<{ token: string; user: ApiUser }>("/auth/login", {
        email,
        password,
        device_name: "b2b_web",
      });

      setSession(response.token, response.user);

      // Set cookie for middleware
      document.cookie = `laravel_session=${response.token}; path=/; max-age=86400`; // 1 day for demo

      if (response.user.is_approved === false) {
        router.push("/b2b/pending");
      } else {
        router.push("/b2b/catalog");
      }
    } catch (err: any) {
      if (err instanceof ApiValidationError) {
        setError(err.messages.join(", "));
      } else if (err instanceof ApiError && err.status === 401) {
        setError("Неверный email или пароль");
      } else {
        setError("Произошла ошибка при входе");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center text-ink mb-6">Вход для оптовиков</h1>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ink"
              placeholder="company@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ink"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-ink text-white py-3 rounded-lg font-medium hover:bg-ink-hover transition-colors disabled:opacity-50"
          >
            {isLoading ? "Вход..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
