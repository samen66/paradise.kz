import type { ReactNode } from 'react';

type Props = {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
  /** Без рамки и фона — когда блок уже стоит внутри карточки или ячейки таблицы. */
  bare?: boolean;
};

/**
 * Пустое состояние списка или экрана: что здесь будет и как это получить.
 * Действие (ссылка или кнопка) — необязательно; без него блок просто
 * сообщает, что записей нет.
 */
export default function EmptyState({ title, hint, icon, action, bare = false }: Props) {
  return (
    <div
      data-testid="empty-state"
      className={`flex flex-col items-center gap-2 px-6 py-10 text-center ${
        bare ? '' : 'rounded-2xl border border-dashed border-zinc-300 bg-white'
      }`}
    >
      {icon && (
        <div className="text-3xl" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="font-semibold text-zinc-800">{title}</p>
      {hint && <p className="max-w-sm text-sm text-zinc-500">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
