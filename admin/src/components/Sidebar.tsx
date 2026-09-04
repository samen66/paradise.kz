'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuthStore();

  const links = [
    { href: '/', label: 'Главная' },
    { href: '/products', label: 'Товары' },
    { href: '/orders', label: 'Заказы' },
    { href: '/stock', label: 'Склад' },
    { href: '/users', label: 'Клиенты (B2B)' },
    { href: '/categories', label: 'Категории' },
    { href: '/brands', label: 'Бренды' },
  ];

  return (
    <div className="w-64 bg-zinc-900 text-white min-h-full flex flex-col shadow-lg shrink-0">
      <div className="p-6 text-2xl font-bold border-b border-zinc-800">
        Paradise Admin
      </div>
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-4">
          {links.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`block px-4 py-2.5 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-blue-600 text-white' 
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-zinc-800">
        <button
          onClick={logout}
          className="w-full text-left px-4 py-2.5 rounded-lg text-red-400 hover:bg-zinc-800 transition-colors"
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
