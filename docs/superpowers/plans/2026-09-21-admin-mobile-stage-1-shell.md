# TASK-504, этап 1. Каркас и общие компоненты админки mobile-first — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вся админка `admin/` открывается и читается на телефоне: нижняя панель навигации вместо сайдбара, модалки шторкой снизу, списки `DataTable` карточками, крупные элементы управления. Десктоп (≥ 1024 px) остаётся как был.

**Architecture:** Разметку после входа забирает новый `AppShell`: до `lg` — прокрутка документа и `BottomNav` с меню «Ещё», с `lg` — прежний сайдбар. Общие UI-компоненты (`Modal`, `CrudModal`, `DataTable`, `PageHeader`, `Tabs`, `styles.ts`) получают мобильную раскладку по умолчанию и десктопную с `md:`. Выбор «карточки или таблица» в `DataTable` делает хук `useIsDesktop()`, чтобы в DOM был ровно один вариант.

**Tech Stack:** Next.js 16 (App Router, клиентские компоненты), React 19, Tailwind CSS 4, zustand, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-21-admin-mobile-first-design.md`

## Global Constraints

- Меняется только `admin/` (плюс `.claude/launch.json` в задаче 0). Filament, API и PHP не трогаем.
- Новых npm-зависимостей нет. Иконки — инлайн SVG.
- Точки перелома: `md` = 768 px (карточки → таблица), `lg` = 1024 px (нижняя панель → сайдбар). Порог `md` для JS — только из `admin/src/lib/breakpoints.ts`.
- Интерактивный элемент на телефоне не меньше 44×44 px (`min-h-11`), поля ввода на телефоне 16 px (`text-base md:text-sm`).
- Ничего не показывается только по `hover`.
- Безопасные зоны: `env(safe-area-inset-bottom)` у всего, что прижато к низу экрана. В арбитражных значениях Tailwind пробелы внутри `calc()` пишутся подчёркиваниями: `pb-[calc(5rem_+_env(safe-area-inset-bottom))]`.
- Фиксированные слои (`Modal`, `MoreSheet`, `ActionSheet`) не должны оказаться внутри элемента с `transform`, `filter` или `backdrop-filter`: такой предок становится для `position: fixed` точкой отсчёта. Поэтому у `PageHeader` и `BottomNav` сплошной фон без `backdrop-blur`.
- Все подписи интерфейса — по-русски.
- Коммиты — Conventional Commits, **без** строк `Co-Authored-By` и `Generated with Claude Code` (личное правило пользователя в `~/.claude/CLAUDE.md`, сильнее системных подсказок).
- Мобильные e2e — проект Playwright `Mobile` (`devices["Pixel 7"]`, 412×839, Chromium), файлы в `admin/e2e/mobile/`. Десктопные спеки не меняются.

## Отличия от спека (осознанные)

- `DataTable.card` и `DataTable.rowHref` переезжают в план этапа 2: у них нет потребителя на этапе 1, а первый — список заказов. Без потребителя их нечем проверить.
- Бренды получают роли колонок уже на этапе 1 (по спеку — этап 4): это образец, на котором e2e проверяет раскладку карточки по ролям.
- `OrderRowActions` переходит на `ActionSheet` на этапе 1: это единственный потребитель `ActionSheet`, без него компонент не проверить.

## Карта файлов

| Файл | Что делает |
|---|---|
| `admin/src/components/shell/navConfig.ts` (новый) | Группы и ссылки меню, четыре главных раздела, `isActive()`. Без React — его импортируют e2e. |
| `admin/src/components/shell/icons.tsx` (новый) | Инлайн-иконки нижней панели и меню. |
| `admin/src/components/shell/BottomNav.tsx` (новый) | Нижняя панель до `lg`. |
| `admin/src/components/shell/MoreSheet.tsx` (новый) | Полноэкранное меню «Ещё» со всеми разделами и «Выйти». |
| `admin/src/components/shell/AppShell.tsx` (новый) | Каркас после входа: сайдбар с `lg`, `<main>` с отступами, нижняя панель. |
| `admin/src/components/ui/useOverlay.ts` (новый) | Escape закрывает слой, страница под слоем не прокручивается. |
| `admin/src/components/ui/ActionSheet.tsx` (новый) | Меню действий шторкой снизу. |
| `admin/src/components/ui/DataTableCards.tsx` (новый) | Карточки `DataTable` по ролям колонок. |
| `admin/src/lib/breakpoints.ts` (новый) | Порог `md` для JS. |
| `admin/src/lib/useIsDesktop.ts` (новый) | `matchMedia` + `useSyncExternalStore`. |
| `admin/src/components/Sidebar.tsx` | Читает `navConfig`, скрыт до `lg`. |
| `admin/src/components/ProtectedRoute.tsx` | Отдаёт разметку `AppShell`. |
| `admin/src/app/layout.tsx` | `viewport` с `viewportFit: 'cover'`. |
| `admin/src/app/globals.css` | Утилита `no-scrollbar`. |
| `admin/src/components/ui/{Modal,CrudModal,DataTable,PageHeader,Tabs,Toaster,styles}.tsx/ts` | Мобильная раскладка. |
| `admin/src/components/orders/{OrderRowActions,OrderTabs}.tsx` | `ActionSheet` на телефоне, вкладки одной строкой. |
| 7 страниц + `login` | Без двойных отступов `min-h-screen … p-6`. |
| 6 форм | `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`. |
| `admin/src/app/brands/page.tsx` | Роли колонок (образец). |
| `admin/playwright.config.ts` | Проект `Mobile`. |
| `admin/e2e/mobile/*.spec.ts` (новые) | Мобильные сценарии. |

---

### Task 0: Окружение для e2e

Ворктри живёт отдельно от основной копии, и три вещи из основной копии ему мешают. Без этой задачи e2e либо не запустятся, либо будут проверять чужой код.

**Files:**
- Modify: `.claude/launch.json`

- [ ] **Step 1: Поставить зависимости админки в ворктри**

`node_modules` в ворктри нет.

```bash
cd admin && npm ci
```

Expected: `added N packages`, без `ERR!`.

- [ ] **Step 2: Освободить порт 3002 для дев-сервера ворктри**

API пускает по CORS только `localhost:3000–3002` (`config/cors.php`), поэтому админка ворктри должна работать именно на 3002. Сейчас там дев-сервер основной копии, и Playwright с `reuseExistingServer` молча протестировал бы его.

```bash
lsof -iTCP:3002 -sTCP:LISTEN -n -P
```

Если порт занят — узнать, чей процесс:

```bash
lsof -a -p <PID из вывода выше> -d cwd -Fn | tail -1
```

Если это `…/paradise.kz/admin` (основная копия), **не убивать процесс самостоятельно**: это сервер пользователя. Попросить пользователя остановить его и дождаться подтверждения. Если процесс из ворктри (`…/worktrees/admin-panel-mobile-responsive-f6ead5/admin`) или порт свободен — идти дальше.

- [ ] **Step 3: Добавить дев-сервер админки в `.claude/launch.json`**

Нужен для визуальной проверки через `preview_start` (в Bash дев-серверы не запускаем). В массив `configurations` после `storefront-dev` добавить:

```json
    {
      "name": "admin-dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": [
        "--prefix",
        "admin",
        "run",
        "dev"
      ],
      "port": 3002
    }
```

- [ ] **Step 4: Указать Playwright фикстуры приёмки из основной копии**

`admin/e2e/fixtures.ts` ищет `../../storage/app/private/acceptance-fixtures.json`. Из ворктри этот путь ведёт в пустой `storage` ворктри. Каждый запуск Playwright в этом плане идёт с переменной (переменные окружения между вызовами Bash не сохраняются, поэтому префикс нужен каждый раз):

```bash
ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json
```

Проверить, что API жив и фикстуры читаются:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/b2b/home
python3 -c "import json;d=json.load(open('/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json'));print(d['version'],d['run_passed'])"
```

Expected: `200` и `2 True`. Если API не отвечает или фикстур нет — остановиться и спросить пользователя. **Не запускать** `mvp:acceptance --fresh` без его явного согласия: команда пересоздаёт дев-базу.

- [ ] **Step 5: Снять исходное состояние проверок**

Нужно, чтобы потом отличать свои поломки от уже существующих.

```bash
cd admin && npx tsc --noEmit; echo "tsc exit $?"
cd admin && npm run lint; echo "lint exit $?"
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Desktop --reporter=list 2>&1 | tail -30
```

Записать в заметки сессии (scratchpad): коды выхода `tsc` и `lint` и список упавших/пропущенных десктопных тестов. Тест цепочки статусов в `orders.spec.ts` пропускается (skip), если заказ «выкуп» уже завершён, — это не падение.

- [ ] **Step 6: Commit**

```bash
git add .claude/launch.json
git commit -m "chore: add the admin dev server to launch.json"
```

---

### Task 1: Каркас — нижняя панель, меню «Ещё», сайдбар с `lg`, страницы без двойных отступов

**Files:**
- Create: `admin/src/components/shell/navConfig.ts`
- Create: `admin/src/components/shell/icons.tsx`
- Create: `admin/src/components/shell/MoreSheet.tsx`
- Create: `admin/src/components/shell/BottomNav.tsx`
- Create: `admin/src/components/shell/AppShell.tsx`
- Create: `admin/src/components/ui/useOverlay.ts`
- Create: `admin/e2e/mobile/shell.spec.ts`
- Create: `admin/e2e/mobile/no-horizontal-scroll.spec.ts`
- Modify: `admin/playwright.config.ts`
- Modify: `admin/src/components/Sidebar.tsx`
- Modify: `admin/src/components/ProtectedRoute.tsx`
- Modify: `admin/src/app/layout.tsx`
- Modify: `admin/src/app/page.tsx`, `admin/src/app/orders/page.tsx`, `admin/src/app/orders/[id]/page.tsx`, `admin/src/app/products/page.tsx`, `admin/src/app/products/[id]/page.tsx`, `admin/src/app/stock/page.tsx`, `admin/src/app/users/page.tsx`, `admin/src/app/login/page.tsx`

**Interfaces:**
- Consumes: `useAuthStore().logout` из `admin/src/stores/authStore.ts`.
- Produces:
  - `navConfig.ts`: `type NavLink = { href: string; label: string }`, `type NavGroup = { title: string | null; links: NavLink[] }`, `NAV_GROUPS: NavGroup[]`, `type PrimaryIcon = 'orders' | 'products' | 'stock' | 'clients'`, `PRIMARY_LINKS: (NavLink & { icon: PrimaryIcon })[]`, `isActive(pathname: string, href: string): boolean`.
  - `icons.tsx`: `type IconName = PrimaryIcon | 'more' | 'close'`, `Icon({ name, className }: { name: IconName; className?: string })`.
  - `useOverlay.ts`: `useOverlay(onClose: () => void): void` — используют `MoreSheet` (здесь) и `Modal` (задача 2).
  - `AppShell({ children }: { children: ReactNode })`.
  - DOM-контракт для тестов: `<nav aria-label="Основное меню">`; кнопка «Ещё» с `data-active="true|false"`; меню — `role="dialog"` с `aria-label="Все разделы"`, кнопка «Закрыть меню», кнопка «Выйти».

- [ ] **Step 1: Добавить проект `Mobile` в Playwright**

В `admin/playwright.config.ts` заменить массив `projects` целиком:

```ts
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "Desktop",
      use: { ...devices["Desktop Chrome"] },
      // Мобильные спеки ищут карточки и нижнюю панель — на десктопе их нет.
      testIgnore: [/.*\.setup\.ts/, /mobile\//],
      dependencies: ["setup"],
    },
    {
      // Заказчик работает с админкой в основном с телефона. Pixel 7 — это
      // Chromium, отдельный WebKit ставить не нужно.
      name: "Mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile\/.*\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
```

- [ ] **Step 2: Написать конфиг меню (нужен тестам)**

Создать `admin/src/components/shell/navConfig.ts`:

```ts
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
```

- [ ] **Step 3: Написать падающий тест каркаса**

Создать `admin/e2e/mobile/shell.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { NAV_GROUPS } from "../../src/components/shell/navConfig";
import { ADMIN_SESSION } from "../session";

/**
 * Каркас на телефоне: нижняя панель вместо сайдбара, меню «Ещё» со всеми
 * разделами, выход.
 */
test.use({ storageState: ADMIN_SESSION });

test("нижняя панель переключает разделы и подсвечивает текущий", async ({ page }) => {
  await page.goto("/orders");

  const nav = page.getByRole("navigation", { name: "Основное меню" });
  await expect(nav.getByRole("link", { name: "Заказы" })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "Товары" }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(nav.getByRole("link", { name: "Товары" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Заказы" })).not.toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("button", { name: "Ещё" })).toHaveAttribute("data-active", "false");

  // Сайдбар на телефоне не рисуется — иначе он съел бы 256 из 412 px.
  await expect(page.getByText("Paradise Admin", { exact: true })).toBeHidden();
});

test("«Ещё» показывает все разделы и ведёт в них", async ({ page }) => {
  await page.goto("/orders");
  await page.getByRole("button", { name: "Ещё" }).click();

  const sheet = page.getByRole("dialog", { name: "Все разделы" });
  for (const link of NAV_GROUPS.flatMap((group) => group.links)) {
    await expect(sheet.getByRole("link", { name: link.label, exact: true })).toBeVisible();
  }
  await expect(sheet.getByRole("button", { name: "Выйти" })).toBeVisible();

  await sheet.getByRole("link", { name: "Поставщики", exact: true }).click();
  await expect(page).toHaveURL(/\/suppliers$/);
  await expect(sheet).toBeHidden();

  // Раздел не из четырёх главных — подсвечено «Ещё».
  await expect(page.getByRole("button", { name: "Ещё" })).toHaveAttribute("data-active", "true");
});

test("меню «Ещё» закрывается крестиком и Escape", async ({ page }) => {
  await page.goto("/orders");
  const more = page.getByRole("button", { name: "Ещё" });
  const sheet = page.getByRole("dialog", { name: "Все разделы" });

  await more.click();
  await sheet.getByRole("button", { name: "Закрыть меню" }).click();
  await expect(sheet).toBeHidden();

  await more.click();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("«Выйти» из меню ведёт на вход", async ({ page }) => {
  // Выход только стирает токен из localStorage этого контекста — сессия
  // остальных тестов (файл ADMIN_SESSION) не страдает.
  await page.goto("/orders");
  await page.getByRole("button", { name: "Ещё" }).click();
  await page.getByRole("dialog", { name: "Все разделы" }).getByRole("button", { name: "Выйти" }).click();

  await expect(page).toHaveURL(/\/login$/);
});
```

- [ ] **Step 4: Написать падающий тест «страница не ездит вбок»**

Создать `admin/e2e/mobile/no-horizontal-scroll.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";
import { NAV_GROUPS } from "../../src/components/shell/navConfig";
import { adminApi } from "../adminApi";
import { requireInStockProduct, requireOrder } from "../fixtures";
import { ADMIN_SESSION } from "../session";

/**
 * Главная мобильная поломка — страница, которая ездит вбок. Проверяется
 * каждый раздел меню и по одному документу каждого вида.
 *
 * Смотрим и на документ, и на `<main>`: до мобильной версии прокручивался
 * не документ, а `<main>` внутри `h-screen overflow-hidden`, и проверка
 * одного документа прошла бы на сломанной вёрстке. Собственные полосы
 * прокрутки внутри страницы (ряд вкладок, широкая таблица в
 * `overflow-x-auto`) разрешены — это не страница.
 */
test.use({ storageState: ADMIN_SESSION });

async function horizontalOverflow(page: Page): Promise<string[]> {
  await page.waitForLoadState("networkidle");

  return page.evaluate(() => {
    const problems: string[] = [];
    const doc = document.documentElement;
    const main = document.querySelector("main");

    if (doc.scrollWidth > window.innerWidth) {
      problems.push(`документ: ${doc.scrollWidth} > ${window.innerWidth}`);
    }
    if (main && main.scrollWidth > main.clientWidth) {
      problems.push(`main: ${main.scrollWidth} > ${main.clientWidth}`);
    }

    return problems;
  });
}

const ROUTES = [...new Set(NAV_GROUPS.flatMap((group) => group.links.map((link) => link.href)))];

for (const route of ROUTES) {
  test(`${route} не прокручивается вбок`, async ({ page }) => {
    await page.goto(route);
    expect(await horizontalOverflow(page)).toEqual([]);
  });
}

type ListBody = { id: number }[] | { data?: { id: number }[] } | null;

const firstId = (body: ListBody): number | undefined => (Array.isArray(body) ? body[0]?.id : body?.data?.[0]?.id);

test("документы не прокручиваются вбок", async ({ page, request }) => {
  const api = adminApi(request);
  const routes = [`/orders/${requireOrder("buyout").id}`, `/products/${requireInStockProduct().id}`];

  // Этих документов может не быть на свежей базе — тогда их просто пропускаем.
  const lists = [
    ["/admin/goods-receipts", "/goods-receipts"],
    ["/admin/write-offs", "/write-offs"],
    ["/admin/catalog-groups", "/catalog-groups"],
    ["/admin/product-collections", "/product-collections"],
  ] as const;

  for (const [endpoint, prefix] of lists) {
    const id = firstId(await api.get<ListBody>(endpoint));
    if (id !== undefined) {
      routes.push(`${prefix}/${id}`);
    }
  }

  for (const route of routes) {
    await page.goto(route);
    expect.soft(await horizontalOverflow(page), route).toEqual([]);
  }
});
```

- [ ] **Step 5: Убедиться, что тесты падают**

```bash
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Mobile e2e/mobile/shell.spec.ts e2e/mobile/no-horizontal-scroll.spec.ts --reporter=list
```

Expected: FAIL. `shell.spec.ts` — не находит `navigation "Основное меню"`. `no-horizontal-scroll.spec.ts` — `main: … > 156` на каждом маршруте (сайдбар оставляет `<main>` 156 px).

- [ ] **Step 6: Перевести сайдбар на `navConfig` и спрятать до `lg`**

В `admin/src/components/Sidebar.tsx`:

1. Удалить локальные `type NavLink`, `const groups` с комментарием над ним и функцию `isActive` внутри компонента.
2. Импорты привести к виду:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { NAV_GROUPS, isActive } from '@/components/shell/navConfig';
```

3. Компонент целиком:

```tsx
/**
 * Меню с `lg`. До `lg` навигация — нижняя панель (shell/BottomNav), поэтому
 * здесь `hidden lg:flex`. Высоту даёт родитель AppShell (`lg:h-screen`,
 * `lg:flex`) — сайдбар растягивается по ней.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuthStore();

  return (
    <div className="hidden w-64 shrink-0 flex-col bg-zinc-900 text-white shadow-lg lg:flex">
      <div className="border-b border-zinc-800 p-6 text-2xl font-bold">Paradise Admin</div>
      <nav className="flex-1 space-y-4 overflow-y-auto py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title ?? 'root'} className="px-4">
            {group.title && (
              <div className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">{group.title}</div>
            )}
            <ul className="space-y-1">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`block rounded-lg px-4 py-2 transition-colors ${
                      isActive(pathname, link.href) ? 'bg-blue-600 text-white' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-zinc-800 p-4">
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-lg px-4 py-2.5 text-left text-red-400 transition-colors hover:bg-zinc-800"
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Общее поведение слоёв**

Создать `admin/src/components/ui/useOverlay.ts`:

```ts
'use client';

import { useEffect } from 'react';

/**
 * Общее поведение всплывающих слоёв — модалки, шторки, меню «Ещё»:
 * Escape закрывает слой, а страница под ним не прокручивается.
 *
 * На телефоне прокручивается сам документ (см. shell/AppShell), и без
 * блокировки палец, долиставший шторку до конца, начинал бы листать
 * список под ней.
 */
export function useOverlay(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
}
```

- [ ] **Step 8: Иконки**

Создать `admin/src/components/shell/icons.tsx`:

```tsx
import type { ReactNode, SVGProps } from 'react';
import type { PrimaryIcon } from './navConfig';

export type IconName = PrimaryIcon | 'more' | 'close';

const svgProps: SVGProps<SVGSVGElement> = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const paths: Record<IconName, ReactNode> = {
  orders: (
    <>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </>
  ),
  products: (
    <>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </>
  ),
  stock: (
    <>
      <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" />
      <path d="M6 18h12" />
      <path d="M6 14h12" />
      <rect x="6" y="10" width="12" height="12" />
    </>
  ),
  clients: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  more: (
    <>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
};

/** Иконка без подписи для скринридера: подпись всегда рядом текстом или в aria-label кнопки. */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {paths[name]}
    </svg>
  );
}
```

- [ ] **Step 9: Меню «Ещё»**

Создать `admin/src/components/shell/MoreSheet.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useOverlay } from '@/components/ui/useOverlay';
import { Icon } from './icons';
import { NAV_GROUPS, isActive } from './navConfig';

/**
 * Меню «Ещё» на телефоне: все разделы, как в сайдбаре, и «Выйти».
 * Полноэкранное — разделов двадцать, в шторку они не помещаются.
 * Закрывается крестиком, Escape и переходом по ссылке.
 */
export default function MoreSheet({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const { logout } = useAuthStore();
  useOverlay(onClose);

  return (
    <div role="dialog" aria-modal="true" aria-label="Все разделы" className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 pt-[env(safe-area-inset-top)]">
        <span className="py-4 text-lg font-semibold text-zinc-900">Все разделы</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть меню"
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
        >
          <Icon name="close" className="h-6 w-6" />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title ?? 'root'}>
            {group.title && (
              <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">{group.title}</div>
            )}
            <ul>
              {group.links.map((link) => {
                const active = isActive(pathname, link.href);

                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-12 items-center rounded-lg px-3 text-base ${
                        active ? 'bg-blue-50 font-medium text-blue-700' : 'text-zinc-800 active:bg-zinc-100'
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-zinc-200 px-4 pt-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            onClose();
            logout();
          }}
          className="flex min-h-12 w-full items-center rounded-lg px-3 text-base text-red-600 active:bg-zinc-100"
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Нижняя панель**

Создать `admin/src/components/shell/BottomNav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Icon } from './icons';
import MoreSheet from './MoreSheet';
import { PRIMARY_LINKS, isActive } from './navConfig';

/**
 * Нижняя панель до `lg`: четыре главных раздела и «Ещё».
 *
 * «Ещё» подсвечено, когда открыт раздел не из четырёх главных, — иначе на
 * «Поставщиках» панель не показывала бы, где находишься.
 *
 * Фон сплошной, без backdrop-blur: `backdrop-filter` сделал бы панель
 * точкой отсчёта для `position: fixed` потомков. MoreSheet по той же
 * причине рендерится рядом с панелью, а не внутри неё.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const inPrimary = PRIMARY_LINKS.some((link) => isActive(pathname, link.href));

  const itemClass = (active: boolean) =>
    `flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${
      active ? 'text-blue-600' : 'text-zinc-500'
    }`;

  return (
    <>
      <nav
        aria-label="Основное меню"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="grid h-16 grid-cols-5">
          {PRIMARY_LINKS.map((link) => {
            const active = isActive(pathname, link.href);

            return (
              <li key={link.href}>
                <Link href={link.href} aria-current={active ? 'page' : undefined} className={itemClass(active)}>
                  <Icon name={link.icon} className="h-6 w-6" />
                  {link.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              data-active={!inPrimary}
              onClick={() => setMoreOpen(true)}
              className={itemClass(!inPrimary)}
            >
              <Icon name="more" className="h-6 w-6" />
              Ещё
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} />}
    </>
  );
}
```

- [ ] **Step 11: Каркас и `ProtectedRoute`**

Создать `admin/src/components/shell/AppShell.tsx`:

```tsx
import type { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import BottomNav from './BottomNav';

/**
 * Каркас админки после входа.
 *
 * До `lg` прокручивается сам документ — так на iOS сворачивается адресная
 * строка, — а навигация живёт в нижней панели; нижний отступ `<main>`
 * оставляет место под неё (h-16) и под «домашнюю полоску» iPhone.
 * С `lg` — сайдбар слева и прокрутка внутри `<main>`, как до мобильной
 * версии.
 *
 * Поля страниц задаёт каркас: страницы свои `p-6` и `min-h-screen` не
 * добавляют, иначе на телефоне отступы складываются.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900 lg:flex lg:h-screen lg:overflow-hidden">
      <Sidebar />
      <main className="px-4 pt-4 pb-[calc(5rem_+_env(safe-area-inset-bottom))] md:px-6 md:pt-6 lg:flex-1 lg:overflow-y-auto lg:p-8 lg:pb-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
```

В `admin/src/components/ProtectedRoute.tsx`:
- заменить `import Sidebar from '@/components/Sidebar';` на `import AppShell from '@/components/shell/AppShell';`;
- заменить последний `return` компонента:

```tsx
  return <AppShell>{children}</AppShell>;
```

(было: `<div className="flex h-screen overflow-hidden …"><Sidebar /><main …>{children}</main></div>`).

- [ ] **Step 12: `viewport` в корневом layout**

В `admin/src/app/layout.tsx`:
- `import type { Metadata } from "next";` → `import type { Metadata, Viewport } from "next";`
- после `export const metadata … ;` добавить:

```ts
/**
 * `viewportFit: 'cover'` включает `env(safe-area-inset-*)` — без него
 * нижняя панель и шторки не знают про «домашнюю полоску» iPhone.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fafafa",
};
```

- [ ] **Step 13: Убрать двойные отступы со страниц и поправить вход**

Точные замены (внутреннюю разметку не трогать; вложенность `<div>` не меняется, поэтому закрывающие теги остаются как есть):

| Файл | Было | Стало |
|---|---|---|
| `admin/src/app/page.tsx` | `<div className="min-h-screen bg-gray-50/50 p-6">` | `<div>` |
| `admin/src/app/page.tsx` | `<div className="max-w-7xl mx-auto space-y-6">` | `<div className="space-y-6">` |
| `admin/src/app/orders/page.tsx` | `<div className="min-h-screen bg-zinc-50/50 p-6">` | `<div>` |
| `admin/src/app/orders/page.tsx` | `<div className="mx-auto max-w-7xl space-y-4">` | `<div className="space-y-4">` |
| `admin/src/app/orders/[id]/page.tsx` (оба вхождения: загрузка и «не найден») | `<div className="min-h-screen bg-gray-50/50 p-6 flex items-center justify-center">` | `<div className="flex min-h-[50vh] items-center justify-center">` |
| `admin/src/app/orders/[id]/page.tsx` | `<div className="min-h-screen bg-gray-50/50 p-6">` | `<div>` |
| `admin/src/app/products/page.tsx` | `<div className="min-h-screen bg-gray-50/50 p-6">` | `<div>` |
| `admin/src/app/products/page.tsx` | `<div className="max-w-7xl mx-auto space-y-6">` | `<div className="space-y-6">` |
| `admin/src/app/products/[id]/page.tsx` | `<div className="min-h-screen bg-gray-50 flex items-center justify-center">` | `<div className="flex min-h-[50vh] items-center justify-center">` |
| `admin/src/app/products/[id]/page.tsx` | `<div className="min-h-screen bg-gray-50/50 p-6 text-gray-900">` | `<div className="text-gray-900">` |
| `admin/src/app/stock/page.tsx` | `<div className="min-h-screen bg-gray-50/50 p-6">` | `<div>` |
| `admin/src/app/stock/page.tsx` | `<div className="max-w-7xl mx-auto space-y-6">` | `<div className="space-y-6">` |
| `admin/src/app/users/page.tsx` | `<div className="min-h-screen bg-gray-50/50 p-6">` | `<div>` |
| `admin/src/app/users/page.tsx` | `<div className="max-w-7xl mx-auto space-y-6">` | `<div className="space-y-6">` |
| `admin/src/app/login/page.tsx` | `<div className="flex min-h-screen items-center justify-center bg-gray-100">` | `<div className="flex min-h-dvh items-center justify-center bg-gray-100 px-4">` |
| `admin/src/app/login/page.tsx` | `<div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">` | `<div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md sm:p-8">` |

`max-w-6xl mx-auto` у заказа и `max-w-4xl mx-auto` у товара остаются: они уже каркасного `max-w-7xl`.

Проверка, что обёрток не осталось:

```bash
grep -rn "min-h-screen" admin/src
```

Expected: пусто.

- [ ] **Step 14: Прогнать мобильные тесты каркаса**

```bash
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Mobile e2e/mobile/shell.spec.ts e2e/mobile/no-horizontal-scroll.spec.ts --reporter=list
```

Expected: PASS. Если какой-то маршрут в `no-horizontal-scroll` всё ещё красный — сообщение называет маршрут и ширину. Найти виновника в браузере панели (`javascript_tool`):

```js
[...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 5).map(el => el.outerHTML.slice(0, 160))
```

и поправить по таблице:

| Что нашлось | Правка |
|---|---|
| `grid-cols-N` без мобильного варианта | `grid-cols-1 sm:grid-cols-N` |
| `flex` без переноса с несколькими детьми | добавить `flex-wrap` |
| `whitespace-nowrap` на длинном тексте вне таблицы | убрать или добавить `min-w-0 truncate` |
| таблица, свёрстанная руками, без обёртки | обернуть в `<div className="overflow-x-auto">` (карточки для неё — этапы 3–4) |
| фиксированная ширина `w-80`/`w-96` | `w-full md:w-80` |

- [ ] **Step 15: Десктоп не сломан**

```bash
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Desktop --reporter=list 2>&1 | tail -30
cd admin && npx tsc --noEmit && npm run lint
```

Expected: те же результаты Desktop, что в исходном состоянии (задача 0, шаг 5); `tsc` и `lint` без новых ошибок.

- [ ] **Step 16: Commit**

```bash
git add admin/playwright.config.ts admin/e2e/mobile admin/src/components/shell admin/src/components/ui/useOverlay.ts admin/src/components/Sidebar.tsx admin/src/components/ProtectedRoute.tsx admin/src/app
git commit -m "feat(admin): bottom navigation and a phone-first shell"
```

---

### Task 2: Модалка — шторка снизу на телефоне, тосты над нижней панелью

**Files:**
- Modify: `admin/src/components/ui/Modal.tsx`
- Modify: `admin/src/components/ui/CrudModal.tsx`
- Modify: `admin/src/components/ui/Toaster.tsx`
- Create: `admin/e2e/mobile/brands.spec.ts`

**Interfaces:**
- Consumes: `useOverlay(onClose)` из задачи 1.
- Produces: `Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode })` — `footer` рисуется вне прокручиваемой области. Использует `ActionSheet` (задача 4).

- [ ] **Step 1: Написать падающий тест шторки**

Создать `admin/e2e/mobile/brands.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { adminApi } from "../adminApi";
import { ADMIN_SESSION } from "../session";

/**
 * Бренды на телефоне — образец справочника: форма в шторке снизу, тост над
 * нижней панелью, список карточками.
 */
test.use({ storageState: ADMIN_SESSION });

// Slug(и), заведённые текущим тестом — читается в afterEach.
let createdSlugs: string[] = [];

test.beforeEach(({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  createdSlugs = [];
});

/** Страховка, если тест упал раньше своего удаления. Тихая. */
test.afterEach(async ({ request }) => {
  const api = adminApi(request);
  const brands = await api.get<{ id: number; slug: string }[]>("/admin/brands");

  for (const brand of brands ?? []) {
    if (createdSlugs.includes(brand.slug)) {
      await api.delete(`/admin/brands/${brand.id}`);
    }
  }
});

test("форма бренда — шторка снизу, кнопки на виду, тост над панелью", async ({ page }) => {
  const slug = `e2e-m-brand-${Date.now()}`;
  createdSlugs.push(slug);

  await page.goto("/brands");
  await page.getByRole("button", { name: "Добавить бренд" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const viewport = page.viewportSize()!;
  const box = (await dialog.boundingBox())!;
  // Шторка — во всю ширину и прижата к нижнему краю экрана.
  expect(box.width).toBeCloseTo(viewport.width, 0);
  expect(box.y + box.height).toBeCloseTo(viewport.height, 0);

  await dialog.getByLabel("Название (RU) *").fill("E2E мобильный бренд");
  await dialog.getByLabel("Slug *").fill(slug);
  const save = dialog.getByRole("button", { name: "Сохранить" });
  await expect(save).toBeInViewport();
  await save.click();
  await expect(dialog).toBeHidden();

  // Тост не прячется под нижней панелью.
  const toastBox = (await page.getByRole("status").getByRole("button", { name: "Сохранено" }).boundingBox())!;
  const navBox = (await page.getByRole("navigation", { name: "Основное меню" }).boundingBox())!;
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(navBox.y);
});
```

- [ ] **Step 2: Убедиться, что тест падает**

```bash
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Mobile e2e/mobile/brands.spec.ts --reporter=list
```

Expected: FAIL на `box.width` — модалка по центру с `p-4`, ширина 380, а не 412.

- [ ] **Step 3: Модалка-шторка**

Заменить `admin/src/components/ui/Modal.tsx` целиком:

```tsx
'use client';

import { useId, type ReactNode } from 'react';
import { useOverlay } from './useOverlay';

type ModalProps = { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode };

/**
 * Диалог. На телефоне — шторка снизу во всю ширину, с `md` — окно по центру.
 *
 * `footer` рисуется вне прокручиваемой области: кнопки остаются на виду,
 * сколько бы полей ни было в форме. Кнопка отправки в футере связывается с
 * формой атрибутом `form`, а не вложенностью (см. CrudModal).
 */
export default function Modal({ title, onClose, children, footer }: ModalProps) {
  const titleId = useId();
  useOverlay(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl md:max-w-lg md:rounded-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="shrink-0 px-4 pt-5 pb-3 text-lg font-semibold text-zinc-900 md:px-6 md:pt-6 md:pb-4">
          {title}
        </h2>
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 md:px-6 ${
            footer ? 'pb-4' : 'pb-[calc(1.25rem_+_env(safe-area-inset-bottom))] md:pb-6'
          }`}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-zinc-100 px-4 pt-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] md:border-t-0 md:px-6 md:pt-0 md:pb-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Кнопки формы — в футер шторки**

В `admin/src/components/ui/CrudModal.tsx`:
- `import { useState, type ReactNode } from 'react';` → `import { useId, useState, type ReactNode } from 'react';`
- после `const [formError, setFormError] = useState<string | null>(null);` добавить `const formId = useId();`
- заменить весь `return (...)`:

```tsx
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
          <button type="button" onClick={onClose} className={buttonSecondary}>
            Отмена
          </button>
          {/* Кнопка вне <form> — связь через атрибут form; Enter в поле по-прежнему отправляет форму. */}
          <button type="submit" form={formId} disabled={form.formState.isSubmitting} className={buttonPrimary}>
            {form.formState.isSubmitting ? 'Сохранение…' : submitLabel}
          </button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        {formError && (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {formError}
          </div>
        )}
        {children(form)}
      </form>
    </Modal>
  );
```

- [ ] **Step 5: Тосты над нижней панелью**

В `admin/src/components/ui/Toaster.tsx` заменить класс контейнера:

```tsx
    <div
      className="fixed inset-x-4 bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-[60] flex flex-col gap-2 md:inset-x-auto md:right-4 md:w-80 lg:bottom-4"
      role="status"
      aria-live="polite"
    >
```

(было: `className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2"`). До `lg` нижняя панель есть и на планшете, поэтому отступ над ней держится до `lg`.

- [ ] **Step 6: Прогнать тест**

```bash
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Mobile e2e/mobile/brands.spec.ts --reporter=list
```

Expected: PASS.

- [ ] **Step 7: Десктопные формы работают как раньше**

Десктопные спеки жмут «Сохранить» внутри `getByRole("dialog")` — футер остался в диалоге.

```bash
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Desktop e2e/attributes.spec.ts e2e/catalog-groups.spec.ts e2e/warehouse.spec.ts --reporter=list
cd admin && npx tsc --noEmit && npm run lint
```

Expected: как в исходном состоянии.

- [ ] **Step 8: Commit**

```bash
git add admin/src/components/ui/Modal.tsx admin/src/components/ui/CrudModal.tsx admin/src/components/ui/Toaster.tsx admin/e2e/mobile/brands.spec.ts
git commit -m "feat(admin): open modals as a bottom sheet on phones"
```

---

### Task 3: DataTable — карточки на телефоне

**Files:**
- Create: `admin/src/lib/breakpoints.ts`
- Create: `admin/src/lib/useIsDesktop.ts`
- Create: `admin/src/components/ui/DataTableCards.tsx`
- Modify: `admin/src/components/ui/DataTable.tsx`
- Modify: `admin/src/app/brands/page.tsx`
- Modify: `admin/e2e/mobile/brands.spec.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `breakpoints.ts`: `DESKTOP_MIN_WIDTH = 768`, `DESKTOP_QUERY = '(min-width: 768px)'`.
  - `useIsDesktop(): boolean` — `true` с `md`. Используют `DataTable` (здесь) и `OrderRowActions` (задача 4).
  - `DataTable.tsx`: `type MobileRole = 'title' | 'badge' | 'meta' | 'actions' | 'hidden'`; `Column<T>` получает `mobile?: MobileRole`. Остальной контракт `DataTable` не меняется.
  - `DataTableCards.tsx`: `CardList<T>({ columns, rows, message, rowKey })`.

- [ ] **Step 1: Дописать падающий тест карточки**

В конец `admin/e2e/mobile/brands.spec.ts` добавить:

```ts
test("бренд виден карточкой по ролям колонок и удаляется из неё", async ({ page, request }) => {
  const slug = `e2e-m-card-${Date.now()}`;
  createdSlugs.push(slug);
  await adminApi(request).create("/admin/brands", { name: { ru: "E2E карточка бренда", kk: "" }, slug, is_active: true });

  await page.goto("/brands");

  // На телефоне таблицы нет вовсе — только карточки.
  await expect(page.getByRole("listitem").filter({ hasText: slug })).toBeVisible();
  await expect(page.locator("table")).toHaveCount(0);

  const card = page.getByRole("listitem").filter({ hasText: slug });
  await expect(card).toContainText("E2E карточка бренда");
  await expect(card).toContainText("Активен");
  // Роли убирают подписи: title, meta и badge выводятся без «Заголовок:», а ID скрыт.
  for (const label of ["ID", "Название", "Slug", "Статус"]) {
    await expect(card).not.toContainText(label);
  }

  await card.getByRole("button", { name: "Удалить" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: slug })).toHaveCount(0);
});
```

- [ ] **Step 2: Убедиться, что тест падает**

```bash
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Mobile e2e/mobile/brands.spec.ts -g "карточкой" --reporter=list
```

Expected: FAIL — строка бренда в `<tr>`, `listitem` с его slug не найден.

- [ ] **Step 3: Порог и хук**

Создать `admin/src/lib/breakpoints.ts`:

```ts
/**
 * Точки перелома, которые нужны не только CSS, но и JS.
 *
 * `md` в Tailwind — 48rem (768px): с этой ширины DataTable рисует таблицу
 * вместо карточек. Меняя порог здесь, поменяйте и `md:`-классы у списков,
 * иначе раскладка и выбор варианта разойдутся.
 */
export const DESKTOP_MIN_WIDTH = 768;

export const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH}px)`;
```

Создать `admin/src/lib/useIsDesktop.ts`:

```ts
'use client';

import { useSyncExternalStore } from 'react';
import { DESKTOP_QUERY } from './breakpoints';

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
};

/**
 * `true` с `md` (768px). Для случаев, когда CSS-скрытия мало: DataTable и
 * меню действий рендерят ровно один вариант, иначе в DOM удваивались бы
 * меню и тексты.
 *
 * Серверный снимок — `false` (mobile-first). Расхождения гидрации нет:
 * экраны админки рендерятся на клиенте после ProtectedRoute.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP_QUERY).matches, () => false);
}
```

- [ ] **Step 4: Карточки**

Создать `admin/src/components/ui/DataTableCards.tsx`:

```tsx
import { Fragment } from 'react';
import type { Column, MobileRole } from './DataTable';

type CardListProps<T> = {
  columns: Column<T>[];
  rows: T[];
  message: string | null;
  rowKey: (row: T) => string | number;
};

/**
 * Записи карточками — вид DataTable на телефоне.
 *
 * Раскладка по ролям колонок (`Column.mobile`):
 *   title и badge — первая строка (заголовок слева, метки справа);
 *   meta — мелкая строка под ней;
 *   колонки без роли — строки «Заголовок: значение», без заголовка — просто значение;
 *   actions — внизу, под чертой; hidden — не показываются.
 * `className` колонок здесь не применяется: он для ячеек таблицы.
 */
export function CardList<T>({ columns, rows, message, rowKey }: CardListProps<T>) {
  if (message) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">{message}</p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={rowKey(row)} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 shadow-sm">
          <RowCard columns={columns} row={row} />
        </li>
      ))}
    </ul>
  );
}

function RowCard<T>({ columns, row }: { columns: Column<T>[]; row: T }) {
  const withRole = (role: MobileRole) => columns.filter((c) => c.mobile === role);
  const titles = withRole('title');
  const badges = withRole('badge');
  const metas = withRole('meta');
  const actions = withRole('actions');
  const fields = columns.filter((c) => c.mobile === undefined);

  return (
    <div className="space-y-2">
      {(titles.length > 0 || badges.length > 0) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 break-words font-medium text-zinc-900">
            {titles.map((c) => (
              <div key={c.key}>{c.render(row)}</div>
            ))}
          </div>
          {badges.length > 0 && (
            <div className="flex shrink-0 flex-wrap justify-end gap-1">
              {badges.map((c) => (
                <Fragment key={c.key}>{c.render(row)}</Fragment>
              ))}
            </div>
          )}
        </div>
      )}

      {metas.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
          {metas.map((c) => (
            <div key={c.key}>{c.render(row)}</div>
          ))}
        </div>
      )}

      {fields.map((c) =>
        c.header ? (
          <div key={c.key} className="flex items-baseline justify-between gap-3">
            <div className="shrink-0 text-zinc-500">{c.header}</div>
            <div className="min-w-0 break-words text-right">{c.render(row)}</div>
          </div>
        ) : (
          <div key={c.key} className="flex justify-end">
            {c.render(row)}
          </div>
        ),
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-x-4 border-t border-zinc-100 pt-2">
          {actions.map((c) => (
            <Fragment key={c.key}>{c.render(row)}</Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: DataTable выбирает вариант**

Заменить `admin/src/components/ui/DataTable.tsx` целиком:

```tsx
'use client';

import type { ReactNode } from 'react';
import type { PageMeta } from '@/lib/crud';
import { useIsDesktop } from '@/lib/useIsDesktop';
import { CardList } from './DataTableCards';
import { buttonSecondary } from './styles';

/**
 * Роль колонки в карточке на телефоне (раскладка — в DataTableCards).
 * Колонка без роли выводится строкой «Заголовок: значение», так что любой
 * экран читается на телефоне и без разметки ролей.
 */
export type MobileRole = 'title' | 'badge' | 'meta' | 'actions' | 'hidden';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Классы ячейки таблицы. В карточке не применяются. */
  className?: string;
  mobile?: MobileRole;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
  meta?: PageMeta | null;
  onPageChange?: (page: number) => void;
  rowKey?: (row: T) => string | number;
};

/**
 * Список записей: таблица с `md`, карточки на телефоне.
 *
 * В DOM попадает только один вариант — через useIsDesktop, а не CSS-скрытие.
 * Иначе удваивались бы меню действий в строках, а e2e-поиск по тексту
 * находил бы скрытую копию.
 */
export default function DataTable<T extends { id?: number }>({
  columns,
  rows,
  loading = false,
  emptyText = 'Ничего не найдено',
  meta,
  onPageChange,
  rowKey = (row) => row.id ?? JSON.stringify(row),
}: DataTableProps<T>) {
  const isDesktop = useIsDesktop();
  const message = loading ? 'Загрузка…' : rows.length === 0 ? emptyText : null;
  const pagination =
    meta && meta.last_page > 1 && onPageChange ? (
      <Pagination meta={meta} onPageChange={onPageChange} compact={!isDesktop} />
    ) : null;

  if (!isDesktop) {
    return (
      <div>
        <CardList columns={columns} rows={rows} message={message} rowKey={rowKey} />
        {pagination}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {/* Широкая таблица прокручивается внутри рамки, а не обрезается ею. */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-700">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 font-medium ${c.className ?? ''}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {message ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-500">
                  {message}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-zinc-50">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${c.className ?? ''}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination}
    </div>
  );
}

type PaginationProps = { meta: PageMeta; onPageChange: (page: number) => void; compact: boolean };

/** На телефоне — под карточками, кнопки во всю ширину; на десктопе — полоса внизу таблицы. */
function Pagination({ meta, onPageChange, compact }: PaginationProps) {
  const buttons = (
    <>
      <button
        type="button"
        className={buttonSecondary}
        disabled={meta.current_page <= 1}
        onClick={() => onPageChange(meta.current_page - 1)}
      >
        Назад
      </button>
      <button
        type="button"
        className={buttonSecondary}
        disabled={meta.current_page >= meta.last_page}
        onClick={() => onPageChange(meta.current_page + 1)}
      >
        Вперёд
      </button>
    </>
  );

  if (compact) {
    return (
      <div className="mt-3 space-y-2 text-sm">
        <p className="text-center text-zinc-500">
          Стр. {meta.current_page} из {meta.last_page}
        </p>
        <div className="grid grid-cols-2 gap-2">{buttons}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-sm">
      <span className="text-zinc-500">
        Стр. {meta.current_page} из {meta.last_page}
      </span>
      <div className="flex gap-2">{buttons}</div>
    </div>
  );
}
```

- [ ] **Step 6: Роли колонок у брендов**

В `admin/src/app/brands/page.tsx` заменить массив `columns`:

```tsx
  const columns: Column<Brand>[] = [
    { key: 'id', header: 'ID', mobile: 'hidden', render: (b) => b.id },
    {
      key: 'name',
      header: 'Название',
      mobile: 'title',
      render: (b) => <span className="font-medium text-zinc-900">{b.name?.ru || '—'}</span>,
    },
    { key: 'slug', header: 'Slug', mobile: 'meta', render: (b) => b.slug },
    { key: 'status', header: 'Статус', mobile: 'badge', render: (b) => (b.is_active ? 'Активен' : 'Выключен') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      mobile: 'actions',
      render: (b) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(b)}>Изменить</button>
          <ConfirmButton onConfirm={() => brands.remove(b.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];
```

- [ ] **Step 7: Прогнать мобильные и десктопные тесты**

```bash
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Mobile --reporter=list
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Desktop --reporter=list 2>&1 | tail -30
cd admin && npx tsc --noEmit && npm run lint
```

Expected: весь `Mobile` PASS (включая `no-horizontal-scroll` — карточки не должны его сломать); `Desktop` — как в исходном состоянии (спеки ищут `tbody tr` — на 1280 px это по-прежнему таблица).

- [ ] **Step 8: Commit**

```bash
git add admin/src/lib/breakpoints.ts admin/src/lib/useIsDesktop.ts admin/src/components/ui/DataTable.tsx admin/src/components/ui/DataTableCards.tsx admin/src/app/brands/page.tsx admin/e2e/mobile/brands.spec.ts
git commit -m "feat(admin): render DataTable rows as cards on phones"
```

---

### Task 4: ActionSheet — действия заказа шторкой на телефоне

**Files:**
- Create: `admin/src/components/ui/ActionSheet.tsx`
- Create: `admin/e2e/mobile/orders-actions.spec.ts`
- Modify: `admin/src/components/orders/OrderRowActions.tsx`

**Interfaces:**
- Consumes: `Modal` с `footer` (задача 2), `useIsDesktop()` (задача 3), `actionLabel`, `allowedTransitions`, `isDestructive`, `statusLabel` из `orders/orderStatus.ts`.
- Produces: `type SheetAction = { key: string; label: string; destructive?: boolean; onSelect: () => void }`, `ActionSheet({ title, actions, onClose }: { title: string; actions: SheetAction[]; onClose: () => void })`. Диалог называется по `title`; пункты — кнопки в `<ul>`; внизу — «Закрыть».

- [ ] **Step 1: Написать падающий тест**

Создать `admin/e2e/mobile/orders-actions.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { requireOrder } from "../fixtures";
import { ADMIN_SESSION } from "../session";

/**
 * Действия над заказом из списка на телефоне — шторкой снизу.
 *
 * Тест только открывает и закрывает шторку, статус не меняет: заказ «выкуп»
 * параллельно ведёт по цепочке десктопный orders.spec.ts. Поэтому пункты
 * сверяются со списком всех возможных подписей, а не с переходами текущего
 * статуса — статус может сдвинуться между загрузкой списка и нажатием.
 */
test.use({ storageState: ADMIN_SESSION });

const ACTION_LABELS = [
  "Подтвердить заказ",
  "Передать в доставку",
  "Завершить заказ",
  "Отменить заказ",
  "Вернуть в подтверждённые",
];

test("«⋯» открывает шторку с действиями, «Закрыть» её убирает", async ({ page }) => {
  const order = requireOrder("buyout");

  await page.goto(`/orders?q=${encodeURIComponent(order.number)}`);

  const card = page.getByRole("listitem").filter({ hasText: new RegExp(`#${order.id}\\b`) });
  await expect(card).toBeVisible();

  const trigger = card.getByRole("button", { name: "Действия" });
  test.skip(
    (await trigger.count()) === 0,
    "заказ уже в финальном статусе — прогоните `php artisan mvp:acceptance --fresh --fixtures`",
  );
  await trigger.click();

  const sheet = page.getByRole("dialog", { name: `Заказ #${order.id}` });
  await expect(sheet).toBeVisible();

  const labels = (await sheet.getByRole("list").getByRole("button").allTextContents()).map((label) => label.trim());
  expect(labels.length).toBeGreaterThan(0);
  for (const label of labels) {
    expect(ACTION_LABELS).toContain(label);
  }

  await sheet.getByRole("button", { name: "Закрыть" }).click();
  await expect(sheet).toBeHidden();
});
```

- [ ] **Step 2: Убедиться, что тест падает**

```bash
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Mobile e2e/mobile/orders-actions.spec.ts --reporter=list
```

Expected: FAIL — не находит `dialog "Заказ #…"` (открывается выпадашка без роли диалога). Если тест SKIPPED — фикстурный заказ завершён; сообщить пользователю и спросить про перезапуск приёмки (`--fresh` пересоздаёт дев-базу).

- [ ] **Step 3: ActionSheet**

Создать `admin/src/components/ui/ActionSheet.tsx`:

```tsx
'use client';

import Modal from './Modal';
import { buttonSecondary } from './styles';

export type SheetAction = {
  key: string;
  label: string;
  /** Красным: действие необратимо или что-то отменяет. */
  destructive?: boolean;
  onSelect: () => void;
};

type Props = { title: string; actions: SheetAction[]; onClose: () => void };

/**
 * Меню действий шторкой снизу — замена выпадашки «⋯» на телефоне.
 * Пункты во всю ширину и высотой 48 px: до них дотягивается большой палец.
 *
 * Шторка закрывается до выполнения действия, чтобы `window.confirm`
 * (отмена заказа) не всплывал поверх неё.
 */
export default function ActionSheet({ title, actions, onClose }: Props) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={`${buttonSecondary} w-full`}>
          Закрыть
        </button>
      }
    >
      <ul className="-mx-4 divide-y divide-zinc-100 border-y border-zinc-100 md:-mx-6">
        {actions.map((action) => (
          <li key={action.key}>
            <button
              type="button"
              onClick={() => {
                onClose();
                action.onSelect();
              }}
              className={`flex min-h-12 w-full items-center px-4 text-left text-base active:bg-zinc-100 md:px-6 ${
                action.destructive ? 'text-red-600' : 'text-zinc-800'
              }`}
            >
              {action.label}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
```

- [ ] **Step 4: OrderRowActions — шторка на телефоне, выпадашка на десктопе**

Заменить `admin/src/components/orders/OrderRowActions.tsx` целиком:

```tsx
'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useIsDesktop } from '@/lib/useIsDesktop';
import { toast } from '@/stores/toastStore';
import ActionSheet from '@/components/ui/ActionSheet';
import { actionLabel, allowedTransitions, isDestructive, statusLabel, type OrderStatus } from './orderStatus';

type Props = {
  orderId: number;
  status: OrderStatus;
  onChanged: () => void;
};

/** Примерная высота меню: пунктов немного, а сама высота нужна только чтобы решить, открывать вверх или вниз. */
const MENU_HEIGHT_ESTIMATE = 220;

/**
 * Действия над заказом прямо из строки списка.
 *
 * Показываются только допустимые переходы — те же, что разрешает
 * Order::ALLOWED_TRANSITIONS на бэке. Отмена спрашивает подтверждение: она не
 * просто пишет статус, а возвращает товар на склад через
 * OrderCancellationService, и отменить это нечем.
 *
 * На телефоне «⋯» открывает ActionSheet — пункты во всю ширину экрана. На
 * десктопе — выпадашка `position: fixed` от координат кнопки-триггера, а не
 * `absolute` внутри строки: DataTable даёт таблице `overflow-hidden` ради
 * скруглённых углов, и `absolute`-меню на нижних строках обрезало бы этим же
 * краем.
 */
export default function OrderRowActions({ orderId, status, onChanged }: Props) {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const transitions = allowedTransitions(status);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < MENU_HEIGHT_ESTIMATE;

      setMenuPosition({
        right: window.innerWidth - rect.right,
        ...(openUpward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      });
    }
    setOpen((v) => !v);
  };

  const move = async (next: OrderStatus) => {
    if (isDestructive(next) && !window.confirm('Отменить заказ? Товар вернётся на склад, отменить это будет нельзя.')) {
      return;
    }

    setOpen(false);
    setBusy(true);

    try {
      await api.patch(`/admin/orders/${orderId}`, { status: next });
      toast.success(`Статус изменён: ${statusLabel(next)}`);
      onChanged();
    } catch {
      // 401/403/5xx показывает перехватчик в lib/api; здесь остаётся 422 —
      // переход, который бэк считает недопустимым.
      toast.error('Не удалось изменить статус');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/orders/${orderId}`}
        className="inline-flex min-h-11 items-center rounded-md px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 md:min-h-0"
      >
        Открыть
      </Link>

      {transitions.length > 0 && (
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            disabled={busy}
            aria-label="Действия"
            aria-expanded={open}
            onClick={isDesktop ? openMenu : () => setOpen(true)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 md:min-h-0 md:min-w-0"
          >
            ⋯
          </button>

          {open && isDesktop && menuPosition && (
            <>
              {/* Клик мимо меню закрывает его. */}
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div
                style={{ position: 'fixed', ...menuPosition }}
                className="z-20 min-w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
              >
                {transitions.map((next) => (
                  <button
                    key={next}
                    type="button"
                    onClick={() => move(next)}
                    className={`block w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 ${
                      isDestructive(next) ? 'text-red-600' : 'text-zinc-700'
                    }`}
                  >
                    {actionLabel(status, next)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {open && !isDesktop && (
        <ActionSheet
          title={`Заказ #${orderId}`}
          actions={transitions.map((next) => ({
            key: next,
            label: actionLabel(status, next),
            destructive: isDestructive(next),
            onSelect: () => void move(next),
          }))}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Прогнать тесты**

```bash
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Mobile e2e/mobile/orders-actions.spec.ts --reporter=list
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Desktop e2e/orders.spec.ts --reporter=list
cd admin && npx tsc --noEmit && npm run lint
```

Expected: мобильный PASS; десктопный `orders.spec.ts` — как в исходном состоянии.

- [ ] **Step 6: Commit**

```bash
git add admin/src/components/ui/ActionSheet.tsx admin/src/components/orders/OrderRowActions.tsx admin/e2e/mobile/orders-actions.spec.ts
git commit -m "feat(admin): order row actions in a bottom sheet on phones"
```

---

### Task 5: Шапка экрана, вкладки, поля, кнопки, формы

**Files:**
- Create: `admin/e2e/mobile/controls.spec.ts`
- Modify: `admin/src/components/ui/PageHeader.tsx`
- Modify: `admin/src/components/ui/Tabs.tsx`
- Modify: `admin/src/components/orders/OrderTabs.tsx`
- Modify: `admin/src/components/ui/styles.ts`
- Modify: `admin/src/app/globals.css`
- Modify: `admin/src/components/warehouse/GoodsReceiptForm.tsx:70`, `admin/src/components/banners/BannerForm.tsx:63`, `admin/src/components/collections/CollectionForm.tsx:51`, `admin/src/components/products/VariantsTab.tsx:117`, `admin/src/app/stores/page.tsx:100`, `admin/src/app/suppliers/page.tsx:88`

**Interfaces:**
- Consumes: —
- Produces: утилита Tailwind `no-scrollbar`; обновлённые `inputClass`, `buttonPrimary`, `buttonSecondary`, `buttonDanger`, `buttonLink` (имена и назначение прежние). DOM-контракт `PageHeader`: контейнер — дед `<h1>` (`h1 → группа заголовка → контейнер`).

- [ ] **Step 1: Написать падающие тесты**

Создать `admin/e2e/mobile/controls.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { ADMIN_SESSION } from "../session";

/**
 * Мелочи, без которых админкой на телефоне неудобно пользоваться: шапка
 * экрана на виду, вкладки одной строкой, поля без зума iOS, кнопки под
 * палец, формы в одну колонку.
 */
test.use({ storageState: ADMIN_SESSION });

test("шапка экрана прилипает к верху при прокрутке", async ({ page }) => {
  await page.goto("/stock-movements");
  await page.waitForLoadState("networkidle");

  const heading = page.getByRole("heading", { level: 1, name: "Движения" });
  const header = heading.locator("xpath=../..");
  expect(await header.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(heading).toBeInViewport();
});

test("вкладки статусов заказа — одна строка, которая листается вбок", async ({ page }) => {
  await page.goto("/orders");

  const tablist = page.getByRole("tablist", { name: "Статус заказа" });
  await expect(tablist.getByRole("tab").first()).toBeVisible();

  const tops = await tablist
    .getByRole("tab")
    .evaluateAll((tabs) => tabs.map((tab) => Math.round(tab.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);

  const { scrollWidth, clientWidth } = await tablist.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(scrollWidth).toBeGreaterThan(clientWidth);
});

test("поле поиска 16px — iOS не зумит страницу при фокусе", async ({ page }) => {
  await page.goto("/orders");

  const fontSize = await page.getByRole("searchbox").evaluate((el) => getComputedStyle(el).fontSize);
  expect(fontSize).toBe("16px");
});

test("кнопки не ниже 44px", async ({ page }) => {
  await page.goto("/brands");

  const box = (await page.getByRole("button", { name: "Добавить бренд" }).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test("поля формы приёмки идут в одну колонку", async ({ page }) => {
  await page.goto("/goods-receipts");
  await page.getByRole("button", { name: "Новая приёмка" }).click();

  const dialog = page.getByRole("dialog");
  const number = (await dialog.getByLabel("Номер", { exact: true }).boundingBox())!;
  const date = (await dialog.getByLabel("Дата приёмки").boundingBox())!;
  expect(Math.round(date.x)).toBe(Math.round(number.x));
  expect(date.y).toBeGreaterThan(number.y);

  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toBeHidden();
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

```bash
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Mobile e2e/mobile/controls.spec.ts --reporter=list
```

Expected: все пять FAIL: `position` = `static`; у вкладок несколько разных `top`; `fontSize` = `14px`; высота кнопки 36; `date.x` ≠ `number.x`.

- [ ] **Step 3: Утилита `no-scrollbar`**

В конец `admin/src/app/globals.css` добавить:

```css
/* Ряд вкладок листается пальцем или колесом — полоса прокрутки под ним не нужна. */
@utility no-scrollbar {
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}
```

- [ ] **Step 4: Классы полей и кнопок**

Заменить `admin/src/components/ui/styles.ts` целиком:

```ts
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
```

- [ ] **Step 5: Шапка экрана**

Заменить `admin/src/components/ui/PageHeader.tsx` целиком:

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

type Props = { title: string; back?: string; actions?: ReactNode };

/**
 * Заголовок экрана.
 *
 * На телефоне прилипает к верху при прокрутке — длинный список не уводит из
 * виду ни название раздела, ни «Добавить»; действия переносятся под
 * заголовок, а не вылезают за край. `-mx-4` растягивает фон на поля каркаса.
 * Фон сплошной, без backdrop-blur: `backdrop-filter` сделал бы шапку точкой
 * отсчёта для `position: fixed` — модалки из `actions` открывались бы
 * внутри неё.
 */
export default function PageHeader({ title, back, actions }: Props) {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-zinc-50 px-4 py-3 md:static md:mx-0 md:mb-6 md:bg-transparent md:p-0">
      <div className="flex min-w-0 items-center gap-1 md:gap-3">
        {back && (
          <Link
            href={back}
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 md:ml-0 md:h-auto md:w-auto"
            aria-label="Назад"
          >
            ←
          </Link>
        )}
        <h1 className="min-w-0 break-words text-xl font-bold text-zinc-900 md:text-2xl">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 6: Вкладки одной строкой**

Заменить `admin/src/components/ui/Tabs.tsx` целиком:

```tsx
'use client';

import { useState, type ReactNode } from 'react';

export type Tab = { key: string; label: string; content: ReactNode; disabled?: boolean; hint?: string };

/**
 * Вкладки. Ряд не переносится: на узком экране он листается вбок одной
 * строкой. Серая линия под рядом — внутренняя тень, а не `border`: активная
 * вкладка перекрывает её своей рамкой без `-mb-px`, а отрицательный отступ
 * внутри `overflow-x-auto` дал бы вертикальную полосу прокрутки.
 */
export default function Tabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs.find((t) => !t.disabled)?.key);
  const current = tabs.find((t) => t.key === active);

  return (
    <div>
      <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-zinc-200)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === active}
            disabled={t.disabled}
            title={t.disabled ? t.hint : undefined}
            onClick={() => setActive(t.key)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 md:py-2 ${
              t.key === active ? 'border-blue-600 text-blue-700' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-4">
        {current?.content}
      </div>
    </div>
  );
}
```

В `admin/src/components/orders/OrderTabs.tsx`:
- у `<div role="tablist" aria-label="Статус заказа" …>` заменить `className="flex flex-wrap gap-1 px-2 py-2"` на `className="no-scrollbar flex gap-1 overflow-x-auto px-2 py-2"`;
- у `Link` внутри этого ряда в начало `className` добавить `shrink-0 whitespace-nowrap ` (получится `` `shrink-0 whitespace-nowrap flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${…}` ``);
- в JSDoc компонента после строки «Вкладка с нулём не прячется…» добавить строку: ` * Ряд статусов не переносится, а листается вбок: на телефоне семь вкладок в три ряда съедали пол-экрана.`

- [ ] **Step 7: Формы в одну колонку на телефоне**

В каждом из шести мест заменить `className="grid grid-cols-2 gap-4"` на `className="grid grid-cols-1 gap-4 sm:grid-cols-2"`:

- `admin/src/components/warehouse/GoodsReceiptForm.tsx:70`
- `admin/src/components/banners/BannerForm.tsx:63`
- `admin/src/components/collections/CollectionForm.tsx:51`
- `admin/src/components/products/VariantsTab.tsx:117`
- `admin/src/app/stores/page.tsx:100`
- `admin/src/app/suppliers/page.tsx:88`

Проверка, что голых `grid-cols-2` в формах не осталось:

```bash
grep -rn '"grid grid-cols-2 gap-4"' admin/src
```

Expected: пусто.

- [ ] **Step 8: Прогнать все мобильные и десктопные тесты**

```bash
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Mobile --reporter=list
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --project=Desktop --reporter=list 2>&1 | tail -30
cd admin && npx tsc --noEmit && npm run lint
```

Expected: `Mobile` целиком PASS; `Desktop` — как в исходном состоянии.

- [ ] **Step 9: Commit**

```bash
git add admin/e2e/mobile/controls.spec.ts admin/src/components/ui/PageHeader.tsx admin/src/components/ui/Tabs.tsx admin/src/components/orders/OrderTabs.tsx admin/src/components/ui/styles.ts admin/src/app/globals.css admin/src/components/warehouse/GoodsReceiptForm.tsx admin/src/components/banners/BannerForm.tsx admin/src/components/collections/CollectionForm.tsx admin/src/components/products/VariantsTab.tsx admin/src/app/stores/page.tsx admin/src/app/suppliers/page.tsx
git commit -m "feat(admin): touch-sized controls, one-row tabs, sticky page header"
```

---

### Task 6: Итоговая проверка этапа и PR

**Files:** —

- [ ] **Step 1: Сборка как в CI**

```bash
cd admin && npx tsc --noEmit && npm run lint && npm run build
```

Expected: все три с кодом 0 (или с теми же предупреждениями, что в исходном состоянии). `next build` должен собрать все маршруты без ошибок.

- [ ] **Step 2: Полный e2e обоих проектов**

```bash
cd admin && ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test --reporter=list 2>&1 | tail -60
```

Expected: `Mobile` — всё PASS (или SKIP у `orders-actions` при исчерпанной фикстуре, с сообщением); `Desktop` — не хуже исходного состояния из задачи 0. Любое новое красное — чинить до PR.

- [ ] **Step 3: Визуальная проверка на 375 и 1280 px**

1. `preview_start` с `{name: "admin-dev"}` (если Playwright уже держит сервер на 3002 — он будет переиспользован).
2. Если открылся `/login` — попросить пользователя войти в панели браузера. Самому пароль не вводить и токен не подставлять.
3. `resize_window` с `{width: 375, height: 812}`; снять скриншоты `/orders`, `/orders/<id заказа «выкуп»>`, `/products`, `/brands`, `/stock-movements`, открытое меню «Ещё», открытую форму бренда.
4. `resize_window` с `preset: "desktop"`; снять `/orders` и `/brands` — сверить, что десктоп прежний: сайдбар, таблицы, модалка по центру.
5. Показать скриншоты пользователю (`SendUserFile`), отметить замеченное.

- [ ] **Step 4: Завершить ветку**

Использовать superpowers:finishing-a-development-branch. Для PR:

- заголовок: `feat(admin): phone-first shell and shared components (TASK-504, stage 1)`;
- в теле: что сделано по разделам спека, скриншоты до/после, отличия от спека (раздел «Отличия от спека» этого плана), результаты `tsc`/`lint`/`build`/e2e;
- **без** строки `Generated with Claude Code` и без `Co-Authored-By` (правило пользователя); перед публикацией проверить `gh pr view --json body`.
