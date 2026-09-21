/**
 * Точки перелома, которые нужны не только CSS, но и JS.
 *
 * `md` в Tailwind — 48rem (768px): с этой ширины DataTable рисует таблицу
 * вместо карточек. Меняя порог здесь, поменяйте и `md:`-классы у списков,
 * иначе раскладка и выбор варианта разойдутся.
 */
export const DESKTOP_MIN_WIDTH = 768;

export const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH}px)`;
