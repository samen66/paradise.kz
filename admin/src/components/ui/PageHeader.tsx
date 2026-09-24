import Link from 'next/link';
import type { ReactNode } from 'react';

type Props = { title: string; back?: string; actions?: ReactNode; below?: ReactNode };

/**
 * Заголовок экрана.
 *
 * На телефоне прилипает к верху при прокрутке — длинный список не уводит из
 * виду ни название раздела, ни «Добавить»; действия переносятся под
 * заголовок, а не вылезают за край. `-mx-4` растягивает фон на поля каркаса.
 * Фон сплошной, без backdrop-blur: `backdrop-filter` сделал бы шапку точкой
 * отсчёта для `position: fixed` — модалки из `actions` открывались бы
 * внутри неё.
 *
 * `below` — строка под заголовком во всю ширину (полоса быстрых переходов);
 * прилипает вместе с шапкой.
 */
export default function PageHeader({ title, back, actions, below }: Props) {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-zinc-50 px-4 py-3 md:static md:mx-0 md:mb-6 md:bg-transparent md:p-0">
      <div className="flex min-w-0 items-center gap-1 md:gap-3">
        {back && (
          <Link
            href={back}
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 md:ml-0 md:h-auto md:w-auto"
            aria-label="Назад"
          >
            ←
          </Link>
        )}
        <h1 className="min-w-0 break-words text-xl font-bold text-zinc-900 md:text-2xl">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      {below && <div className="w-full min-w-0">{below}</div>}
    </div>
  );
}
