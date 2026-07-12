'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useB2bAuth } from '@/stores/useB2bAuth';
import '../globals.css';

export default function B2BLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, clear } = useB2bAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle Auth checks client-side for B2B portal
  useEffect(() => {
    if (!isMounted) return;
    
    // Login and Pending are public/semi-public routes
    if (pathname.startsWith('/b2b/login') || pathname.startsWith('/b2b/pending')) {
      return;
    }

    if (!user) {
      router.replace('/b2b/login');
      return;
    }

    if (user.is_approved === false) {
      router.replace('/b2b/pending');
      return;
    }
  }, [user, pathname, router, isMounted]);

  // Don't render layout structure on login or pending pages
  if (pathname.startsWith('/b2b/login') || pathname.startsWith('/b2b/pending')) {
    return (
      <html lang="ru">
        <body className="bg-surface font-sans antialiased text-ink" suppressHydrationWarning>
          {children}
        </body>
      </html>
    );
  }

  // Prevent flash of content while checking auth
  if (!isMounted || !user || user.is_approved === false) {
    return (
      <html lang="ru">
        <body className="bg-surface font-sans antialiased min-h-screen flex items-center justify-center" suppressHydrationWarning>
          <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin"></div>
        </body>
      </html>
    );
  }

  const handleLogout = () => {
    clear();
    document.cookie = "laravel_session=; path=/; max-age=0";
    router.push('/b2b/login');
  };

  const navItems = [
    { name: 'Каталог', href: '/b2b/catalog' },
    { name: 'Корзина', href: '/b2b/cart' },
    { name: 'Мои заказы', href: '/b2b/orders' },
  ];

  return (
    <html lang="ru">
      <body className="bg-surface font-sans antialiased text-ink flex min-h-screen" suppressHydrationWarning>
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-line flex flex-col hidden md:flex">
          <div className="p-6 border-b border-line">
            <h1 className="text-2xl font-display font-bold text-ink">Paradise B2B</h1>
            <p className="text-sm text-muted mt-1">{user.name}</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-4 py-3 rounded-lg font-medium transition-colors ${
                    isActive 
                      ? 'bg-panel text-ink' 
                      : 'text-muted hover:bg-surface hover:text-ink'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
          
          <div className="p-4 border-t border-line">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
            >
              Выйти
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile Header */}
          <header className="md:hidden bg-white border-b border-line p-4 flex items-center justify-between">
            <h1 className="text-xl font-display font-bold">Paradise B2B</h1>
            {/* Mobile menu toggle would go here */}
          </header>
          
          <main className="flex-1 p-4 md:p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
