'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

type NavLink = { href: string; label: string };

// Group titles differ from link texts so tests and screen readers never
// see two elements named, say, «Склад».
const groups: { title: string | null; links: NavLink[] }[] = [
  { title: null, links: [{ href: '/', label: 'Главная' }] },
  {
    title: 'Продажи',
    links: [
      { href: '/orders', label: 'Заказы' },
      { href: '/users', label: 'Клиенты (B2B)' },
    ],
  },
  {
    title: 'Каталог',
    links: [
      { href: '/products', label: 'Товары' },
      { href: '/categories', label: 'Категории' },
      { href: '/brands', label: 'Бренды' },
      { href: '/attributes', label: 'Атрибуты' },
      { href: '/price-types', label: 'Типы цен' },
      { href: '/catalog-groups', label: 'Группы каталога' },
      { href: '/product-collections', label: 'Подборки' },
    ],
  },
  {
    title: 'Запасы',
    links: [
      { href: '/stock', label: 'Склад' },
      { href: '/stock-movements', label: 'Движения' },
      { href: '/goods-receipts', label: 'Приёмки' },
      { href: '/write-offs', label: 'Списания' },
      { href: '/stores', label: 'Склады' },
      { href: '/suppliers', label: 'Поставщики' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuthStore();

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));

  return (
    <div className="flex min-h-full w-64 shrink-0 flex-col bg-zinc-900 text-white shadow-lg">
      <div className="border-b border-zinc-800 p-6 text-2xl font-bold">Paradise Admin</div>
      <nav className="flex-1 space-y-4 overflow-y-auto py-4">
        {groups.map((group) => (
          <div key={group.title ?? 'root'} className="px-4">
            {group.title && (
              <div className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">{group.title}</div>
            )}
            <ul className="space-y-1">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`block rounded-lg px-4 py-2 transition-colors ${
                      isActive(link.href) ? 'bg-blue-600 text-white' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-zinc-800 p-4">
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-lg px-4 py-2.5 text-left text-red-400 transition-colors hover:bg-zinc-800"
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
