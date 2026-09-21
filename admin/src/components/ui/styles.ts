/**
 * Общие классы полей и кнопок.
 *
 * На телефоне поля — 16 px (`text-base`): мельче iOS Safari зумит страницу
 * при фокусе. Кнопки и ссылки-действия — не ниже 44 px (`min-h-11`), под
 * палец. С `md` — прежние десктопные размеры.
 */
export const inputClass =
  'w-full px-3 py-2 text-base bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-zinc-100 md:text-sm';

export const buttonPrimary =
  'inline-flex min-h-11 items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors md:min-h-0';

export const buttonSecondary =
  'inline-flex min-h-11 items-center justify-center px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-60 transition-colors md:min-h-0';

export const buttonDanger =
  'inline-flex min-h-11 items-center text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50 md:min-h-0';

export const buttonLink = 'inline-flex min-h-11 items-center text-sm font-medium text-blue-600 hover:text-blue-800 md:min-h-0';

export const cardClass = 'bg-white rounded-xl shadow-sm border border-zinc-200';
