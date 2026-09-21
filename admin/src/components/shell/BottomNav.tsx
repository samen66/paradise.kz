'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Icon } from './icons';
import MoreSheet from './MoreSheet';
import { PRIMARY_LINKS, isActive } from './navConfig';

/**
 * Нижняя панель до `lg`: четыре главных раздела и «Ещё».
 *
 * «Ещё» подсвечено, когда открыт раздел не из четырёх главных, — иначе на
 * «Поставщиках» панель не показывала бы, где находишься.
 *
 * Фон сплошной, без backdrop-blur: `backdrop-filter` сделал бы панель
 * точкой отсчёта для `position: fixed` потомков. MoreSheet по той же
 * причине рендерится рядом с панелью, а не внутри неё.
 */
export default function BottomNav() {
  const pathname = usePathname();
  // Открытость меню держим не в булеве, а в пути, на котором его открыли:
  // BottomNav переживает переходы между страницами, и обычный useState
  // оставлял бы меню открытым после «назад»/«вперёд» браузера — setState в
  // эффекте на смену pathname запрещён линтом, а так его и не нужно.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const moreOpen = openedOn === pathname;
  const inPrimary = PRIMARY_LINKS.some((link) => isActive(pathname, link.href));

  const itemClass = (active: boolean) =>
    `flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${
      active ? 'text-blue-600' : 'text-zinc-500'
    }`;

  return (
    <>
      <nav
        aria-label="Основное меню"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:hidden"
      >
        <ul className="grid h-16 grid-cols-5">
          {PRIMARY_LINKS.map((link) => {
            const active = isActive(pathname, link.href);

            return (
              <li key={link.href}>
                <Link href={link.href} aria-current={active ? 'page' : undefined} className={itemClass(active)}>
                  <Icon name={link.icon} className="h-6 w-6" />
                  {link.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              data-active={!inPrimary}
              onClick={() => setOpenedOn(pathname)}
              className={itemClass(!inPrimary)}
            >
              <Icon name="more" className="h-6 w-6" />
              Ещё
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && <MoreSheet onClose={() => setOpenedOn(null)} />}
    </>
  );
}
