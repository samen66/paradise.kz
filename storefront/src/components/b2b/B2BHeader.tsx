import React from 'react';
import Link from 'next/link';
import { useB2bAuth } from '@/stores/useB2bAuth';

export function B2BHeader() {
  const { user } = useB2bAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-md">
      <div className="hidden bg-surface text-xs text-muted sm:block">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-10">
          <div className="flex gap-4">
            <span className="font-medium">Оптовый портал B2B</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-ink transition">Вернуться в розничный магазин</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex gap-4">
            <Link href="/b2b/catalog" className="text-sm font-medium hover:opacity-70 transition">Каталог</Link>
            <Link href="/b2b/orders" className="text-sm font-medium hover:opacity-70 transition">Мои заказы</Link>
          </nav>
        </div>

        <Link
          href="/b2b/catalog"
          className="justify-self-center font-display text-2xl font-semibold tracking-tight text-ink"
        >
          Paradise B2B
        </Link>

        <div className="flex items-center justify-end gap-5">
          {user && (
            <Link href="/b2b/profile" className="text-ink transition hover:opacity-70" aria-label="Профиль">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </Link>
          )}
          <Link
            href="/b2b/cart"
            className="flex items-center gap-2 text-sm font-medium text-ink transition hover:opacity-70"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true" className="h-6 w-6">
              <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="hidden lg:inline">Корзина</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
