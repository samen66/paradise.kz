import type { ReactNode } from 'react';
import { cardClass } from '@/components/ui/styles';

type Props = { id: string; title: string; aside?: ReactNode; className?: string; children: ReactNode };

/** Карточка раздела формы. `id` — якорь для полосы быстрых переходов. */
export default function FormCard({ id, title, aside, className = '', children }: Props) {
  const headingId = `${id}-title`;

  return (
    <section id={id} aria-labelledby={headingId} className={`${cardClass} scroll-mt-36 space-y-4 p-4 md:p-5 lg:scroll-mt-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-base font-semibold text-zinc-900">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
