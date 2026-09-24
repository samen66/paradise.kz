'use client';

type Props = { checked: boolean; onChange: (checked: boolean) => void; label: string };

/** Переключатель «вкл/выкл». Подпись — часть <label>, по ней кликается и читается скринридером. */
export default function Switch({ checked, onChange, label }: Props) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 md:min-h-9">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
          checked ? 'bg-blue-600' : 'bg-zinc-300'
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <span className="text-sm text-zinc-700">{label}</span>
    </label>
  );
}
