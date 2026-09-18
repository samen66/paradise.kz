'use client';

import React from 'react';
import Link from 'next/link';
import { useIsApproved } from '@/lib/approval';

export function B2BFooter() {
  const isApproved = useIsApproved();

  return (
    <footer className="border-t border-line bg-surface mt-auto">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="font-display text-xl font-semibold tracking-tight text-ink mb-4">
              Paradise B2B
            </div>
            <p className="text-sm text-muted">
              Оптовый портал для партнеров. Заказывайте мебель напрямую со склада.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-ink mb-4">Навигация</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li><Link href="/" className="hover:text-ink transition">Главная</Link></li>
              <li><Link href="/catalog" className="hover:text-ink transition">Каталог</Link></li>
              {isApproved && (
                <li><Link href="/orders" className="hover:text-ink transition">Мои заказы</Link></li>
              )}
              {isApproved && (
                <li><Link href="/cart" className="hover:text-ink transition">Корзина</Link></li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-ink mb-4">Поддержка</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li><a href={process.env.NEXT_PUBLIC_B2C_URL ?? "https://paradise.kz"} className="hover:text-ink transition">Перейти в розничный магазин</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-line text-center text-sm text-muted">
          © {new Date().getFullYear()} Paradise B2B. Все права защищены.
        </div>
      </div>
    </footer>
  );
}
