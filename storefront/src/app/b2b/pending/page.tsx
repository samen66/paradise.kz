"use client";

import Link from "next/link";
import { useB2bAuth } from "@/stores/useB2bAuth";

export default function B2BPendingPage() {
  const clear = useB2bAuth((state) => state.clear);

  const handleLogout = () => {
    clear();
    document.cookie = "laravel_session=; path=/; max-age=0";
    window.location.href = "/b2b/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="max-w-lg bg-white rounded-2xl shadow-sm p-8 text-center border border-line">
        <div className="w-16 h-16 bg-panel rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-display font-bold text-ink mb-4">
          Заявка на рассмотрении
        </h1>
        
        <p className="text-muted mb-8 leading-relaxed">
          Ваш оптовый аккаунт успешно создан, но в данный момент находится на модерации. Наш менеджер свяжется с вами для подтверждения данных, после чего вам откроется доступ к каталогу и оптовым ценам.
        </p>

        <div className="space-y-3">
          <Link 
            href="/"
            className="block w-full bg-ink text-white py-3 px-6 rounded-lg font-medium hover:bg-ink-hover transition-colors"
          >
            Вернуться на главную
          </Link>
          <button 
            onClick={handleLogout}
            className="block w-full bg-surface text-ink py-3 px-6 rounded-lg font-medium hover:bg-line transition-colors"
          >
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
}
