import Link from 'next/link';
import type { ReactNode } from 'react';
import { cardClass } from './styles';

type Tone = 'neutral' | 'warning' | 'danger';

const TONES: Record<Tone, { icon: string; value: string }> = {
  neutral: { icon: 'bg-blue-50 text-blue-700', value: 'text-zinc-900' },
  warning: { icon: 'bg-amber-50 text-amber-700', value: 'text-amber-700' },
  danger: { icon: 'bg-red-50 text-red-700', value: 'text-red-700' },
};

type Props = { label: string; value: string; icon: ReactNode; tone?: Tone; href?: string };

/**
 * Плитка с одним числом: иконка в тонированном квадрате, значение, подпись.
 * С `href` плитка целиком — ссылка на отфильтрованный список.
 */
export default function StatTile({ label, value, icon, tone = 'neutral', href }: Props) {
  const colors = TONES[tone];
  const body = (
    <>
      <span className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl text-lg ${colors.icon}`} aria-hidden="true">
        {icon}
      </span>
      <span className={`block text-xl font-bold md:text-2xl ${colors.value}`}>{value}</span>
      <span className="block text-sm text-zinc-500">{label}</span>
    </>
  );
  const className = `${cardClass} block min-h-11 p-4`;

  return href ? (
    <Link href={href} className={`${className} transition-colors hover:border-blue-200`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
