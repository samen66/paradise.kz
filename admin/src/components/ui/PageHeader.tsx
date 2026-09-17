import Link from 'next/link';
import type { ReactNode } from 'react';

type Props = { title: string; back?: string; actions?: ReactNode };

export default function PageHeader({ title, back, actions }: Props) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {back && (
          <Link href={back} className="text-zinc-400 hover:text-zinc-700" aria-label="Назад">
            ←
          </Link>
        )}
        <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
