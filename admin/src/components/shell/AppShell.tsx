import type { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import BottomNav from './BottomNav';

/**
 * Каркас админки после входа.
 *
 * До `lg` прокручивается сам документ — так на iOS сворачивается адресная
 * строка, — а навигация живёт в нижней панели; нижний отступ `<main>`
 * оставляет место под неё (h-16) и под «домашнюю полоску» iPhone.
 * С `lg` — сайдбар слева и прокрутка внутри `<main>`, как до мобильной
 * версии.
 *
 * Поля страниц задаёт каркас: страницы свои `p-6` и `min-h-screen` не
 * добавляют, иначе на телефоне отступы складываются.
 *
 * `viewportFit: 'cover'` (см. app/layout.tsx) рисует под чёлкой и скруглением
 * корпуса, поэтому у корневого контейнера левый/правый отступ равен вырезу
 * безопасной зоны — иначе в альбомной ориентации на iPhone с чёлкой контент
 * `<main>` заезжал бы под неё. `<nav>` нижней панели (BottomNav) и Toaster
 * — `fixed`, отступы корня их не сдвигают, поэтому у них те же классы
 * заданы отдельно.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-50 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] text-zinc-900 lg:flex lg:h-screen lg:overflow-hidden">
      <Sidebar />
      <main className="px-4 pt-4 pb-[calc(5rem_+_env(safe-area-inset-bottom))] md:px-6 md:pt-6 lg:flex-1 lg:overflow-y-auto lg:p-8 lg:pb-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
