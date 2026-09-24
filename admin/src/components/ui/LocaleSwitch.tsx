'use client';

export const LOCALES = ['ru', 'kk'] as const;

export type Locale = (typeof LOCALES)[number];

const LABELS: Record<Locale, string> = { ru: 'RU', kk: 'KZ' };

type Props = {
  value: Locale;
  onChange: (locale: Locale) => void;
  /** Язык с незаполненным переводом — жёлтая точка. */
  missing?: Partial<Record<Locale, boolean>>;
  /** Язык с ошибкой в поле — красная точка, важнее жёлтой. */
  invalid?: Partial<Record<Locale, boolean>>;
};

/**
 * Переключатель языка полей карточки. Поля обоих языков остаются в форме —
 * переключатель только прячет неактивный, набранное не теряется.
 */
export default function LocaleSwitch({ value, onChange, missing = {}, invalid = {} }: Props) {
  return (
    <div role="group" aria-label="Язык полей" className="inline-flex shrink-0 overflow-hidden rounded-lg border border-zinc-300 text-xs font-semibold">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          aria-pressed={value === locale}
          onClick={() => onChange(locale)}
          className={`flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-3 md:min-h-8 ${
            value === locale ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          {LABELS[locale]}
          {invalid[locale] ? (
            <>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-red-500" />
              <span className="sr-only">есть ошибка</span>
            </>
          ) : missing[locale] ? (
            <>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="sr-only">не заполнено</span>
            </>
          ) : null}
        </button>
      ))}
    </div>
  );
}
