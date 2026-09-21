/**
 * Разделы админки — один список для сайдбара, нижней панели и меню «Ещё».
 *
 * Названия групп отличаются от названий ссылок, чтобы тесты и скринридеры
 * не видели два элемента с именем, скажем, «Склад».
 *
 * Файл без React намеренно: его импортируют e2e-тесты, которые обходят все
 * маршруты меню.
 */
export type NavLink = { href: string; label: string };

export type NavGroup = { title: string | null; links: NavLink[] };

export const NAV_GROUPS: NavGroup[] = [
  { title: null, links: [{ href: '/', label: 'Главная' }] },
  {
    title: 'Продажи',
    links: [
      { href: '/orders', label: 'Заказы' },
      { href: '/users', label: 'Клиенты (B2B)' },
    ],
  },
  {
    title: 'Каталог',
    links: [
      { href: '/products', label: 'Товары' },
      { href: '/categories', label: 'Категории' },
      { href: '/brands', label: 'Бренды' },
      { href: '/attributes', label: 'Атрибуты' },
      { href: '/price-types', label: 'Типы цен' },
      { href: '/catalog-groups', label: 'Группы каталога' },
      { href: '/product-collections', label: 'Подборки' },
    ],
  },
  {
    title: 'Контент',
    links: [
      { href: '/banners', label: 'Баннеры' },
      { href: '/b2b-home', label: 'B2B-главная' },
    ],
  },
  {
    title: 'Запасы',
    links: [
      { href: '/stock', label: 'Склад' },
      { href: '/stock-movements', label: 'Движения' },
      { href: '/goods-receipts', label: 'Приёмки' },
      { href: '/write-offs', label: 'Списания' },
      { href: '/stores', label: 'Склады' },
      { href: '/suppliers', label: 'Поставщики' },
    ],
  },
];

export type PrimaryIcon = 'orders' | 'products' | 'stock' | 'clients';

/**
 * Четыре раздела нижней панели. Подписи короче, чем в сайдбаре: на кнопку
 * приходится пятая часть ширины телефона.
 */
export const PRIMARY_LINKS: (NavLink & { icon: PrimaryIcon })[] = [
  { href: '/orders', label: 'Заказы', icon: 'orders' },
  { href: '/products', label: 'Товары', icon: 'products' },
  { href: '/stock', label: 'Склад', icon: 'stock' },
  { href: '/users', label: 'Клиенты', icon: 'clients' },
];

/** Раздел активен и на своих вложенных страницах: `/orders/12` подсвечивает «Заказы». */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}
