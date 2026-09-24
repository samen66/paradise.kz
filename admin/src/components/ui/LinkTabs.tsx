import Link from 'next/link';

export type LinkTab = { key: string; href: string; label: string; count?: number | null };

type Props = { label: string; tabs: LinkTab[]; active: string };

/**
 * Вкладки-ссылки: каждая вкладка — адрес, поэтому F5, «назад» и ссылка в
 * мессенджере открывают ту же вкладку. (Общий `ui/Tabs` держит вкладку в
 * состоянии и сам рисует панель — для разделов не подходит.)
 *
 * С `md` — подчёркнутые вкладки; на телефоне — «таблетки» одной строкой,
 * которая листается вбок и выходит под поля каркаса (`-mx-4 px-4`), чтобы
 * крайняя вкладка не обрезалась по рамке.
 */
export default function LinkTabs({ label, tabs, active }: Props) {
  return (
    <nav
      aria-label={label}
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:gap-1 md:px-0 md:shadow-[inset_0_-1px_0_var(--color-zinc-200)]"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors md:min-h-0 md:rounded-none md:border-b-2 md:py-2.5 ${
              isActive
                ? 'bg-blue-600 text-white md:border-blue-600 md:bg-transparent md:text-blue-700'
                : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-zinc-900 md:border-transparent md:bg-transparent md:ring-0'
            }`}
          >
            {tab.label}
            {tab.count ? (
              <span className={`rounded-full px-1.5 text-xs ${isActive ? 'bg-white/20 md:bg-blue-50' : 'bg-zinc-100'}`}>
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
