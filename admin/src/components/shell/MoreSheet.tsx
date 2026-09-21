'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useOverlay } from '@/components/ui/useOverlay';
import { Icon } from './icons';
import { NAV_GROUPS, isActive } from './navConfig';

/**
 * Меню «Ещё» на телефоне: все разделы, как в сайдбаре, и «Выйти».
 * Полноэкранное — разделов двадцать, в шторку они не помещаются.
 * Закрывается крестиком, Escape и переходом по ссылке.
 */
export default function MoreSheet({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const { logout } = useAuthStore();
  useOverlay(onClose);

  return (
    <div role="dialog" aria-modal="true" aria-label="Все разделы" className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 pt-[env(safe-area-inset-top)]">
        <span className="py-4 text-lg font-semibold text-zinc-900">Все разделы</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть меню"
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
        >
          <Icon name="close" className="h-6 w-6" />
        </button>
      </div>

      <nav aria-label="Разделы" className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title ?? 'root'}>
            {group.title && (
              <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">{group.title}</div>
            )}
            <ul>
              {group.links.map((link) => {
                const active = isActive(pathname, link.href);

                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-12 items-center rounded-lg px-3 text-base ${
                        active ? 'bg-blue-50 font-medium text-blue-700' : 'text-zinc-800 active:bg-zinc-100'
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-zinc-200 px-4 pt-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            onClose();
            logout();
          }}
          className="flex min-h-12 w-full items-center rounded-lg px-3 text-base text-red-600 active:bg-zinc-100"
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
