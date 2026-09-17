import type { InputHTMLAttributes, Ref } from 'react';
import { inputClass } from './styles';

type Props = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> };

/** An amount in ₸. Kept as a string; the API converts to тиын. */
export default function MoneyInput({ className, ...props }: Props) {
  return (
    <div className="relative">
      <input
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        className={`${inputClass} pr-8 ${className ?? ''}`}
        {...props}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">₸</span>
    </div>
  );
}
