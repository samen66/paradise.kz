'use client';

import { inputClass } from '@/components/ui/styles';

/** Шаг к количеству, записанному строкой: три знака после точки, в пределах [min, max]. */
export const stepQuantity = (value: string, delta: number, min = 0, max = Number.POSITIVE_INFINITY): string => {
  const current = Number(value);
  const base = Number.isFinite(current) ? current : 0;
  const next = Math.min(max, Math.max(min, Math.round((base + delta) * 1000) / 1000));
  return String(next);
};

type Props = {
  value: string;
  /** Название товара — для подписей «Количество: …», «Больше: …». */
  label: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  min?: number;
  max?: number;
};

/** «− N +»: кнопки 44 px на телефоне, число посередине можно набрать. Запятая становится точкой. */
export default function QuantityStepper({ value, label, onChange, onBlur, min = 1, max }: Props) {
  const current = Number(value);
  const button =
    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-lg font-semibold text-zinc-700 hover:bg-zinc-200 disabled:opacity-40 md:h-9 md:w-9';

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className={button}
        aria-label={`Меньше: ${label}`}
        disabled={!(current > min)}
        onClick={() => onChange(stepQuantity(value, -1, min, max))}
      >
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        aria-label={`Количество: ${label}`}
        className={`${inputClass} w-20 text-center`}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(',', '.'))}
        onBlur={onBlur}
      />
      <button
        type="button"
        className={button}
        aria-label={`Больше: ${label}`}
        disabled={max !== undefined && current >= max}
        onClick={() => onChange(stepQuantity(value, 1, min, max))}
      >
        +
      </button>
    </div>
  );
}
