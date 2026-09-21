'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { NAV_GROUPS, isActive } from '@/components/shell/navConfig';

/**
 * Меню с `lg`. До `lg` навигация — нижняя панель (shell/BottomNav), поэтому
 * здесь `hidden lg:flex`. Высоту даёт родитель AppShell (`lg:h-screen`,
 * `lg:flex`) — сайдбар растягивается по ней.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuthStore();

  return (
    <div className="hidden w-64 shrink-0 flex-col bg-zinc-900 text-white shadow-lg lg:flex">
      <div className="border-b border-zinc-800 p-6 text-2xl font-bold">Paradise Admin</div>
      <nav className="flex-1 space-y-4 overflow-y-auto py-4">
        {NAV_GROUPS.map((group) => (
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
                      isActive(pathname, link.href) ? 'bg-blue-600 text-white' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
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
