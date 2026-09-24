/**
 * Общие классы полей и кнопок.
 *
 * На телефоне поля — 16 px (`text-base`): мельче iOS Safari зумит страницу
 * при фокусе. Кнопки и ссылки-действия — не ниже 44 px (`min-h-11`), под
 * палец. С `md` — прежние десктопные размеры.
 *
 * Стиль «мягкий»: светлые рамки, скругления 12 px у полей и кнопок, 16 px у
 * карточек, тени едва заметные. Вторичная кнопка тонированная; белая кнопка
 * с рамкой (`buttonGhost`) — для «Отмена», «Закрыть» и пагинации, чтобы
 * нейтральное действие не спорило с основным.
 */
export const inputClass =
  'w-full px-3 py-2 text-base bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-zinc-100 md:text-sm';

export const buttonPrimary =
  'inline-flex min-h-11 items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl shadow-sm shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60 transition-colors md:min-h-0';

export const buttonSecondary =
  'inline-flex min-h-11 items-center justify-center px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 rounded-xl hover:bg-blue-100 disabled:opacity-60 transition-colors md:min-h-0';

export const buttonGhost =
  'inline-flex min-h-11 items-center justify-center px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 disabled:opacity-60 transition-colors md:min-h-0';

export const buttonDanger =
  'inline-flex min-h-11 items-center text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50 md:min-h-0';

export const buttonLink = 'inline-flex min-h-11 items-center text-sm font-medium text-blue-600 hover:text-blue-800 md:min-h-0';

export const cardClass =
  'bg-white rounded-2xl border border-zinc-200/70 shadow-[0_1px_2px_rgba(24,24,27,0.04),0_4px_12px_rgba(24,24,27,0.04)]';
