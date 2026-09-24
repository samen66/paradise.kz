# Раздел «Склад», этап 1: оболочка и мягкий стиль — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Шесть пунктов «Запасов» превращаются в один раздел «Склад» (`/warehouse`) с вкладками «Остатки · Движения · Документы» и справочниками за кнопкой «⚙», старые адреса перенаправляются, а вся админка получает мягкие токены стиля, пустые состояния и скелеты загрузки.

**Architecture:** Next.js App Router: `app/warehouse/layout.tsx` рисует общую шапку (`PageHeader` + новый `LinkTabs`) на страницах-вкладках; содержимое страниц переносится из шести старых каталогов почти без изменений. Редиректы — `redirects()` в `next.config.ts`. Стиль меняется только через `components/ui/styles.ts` и общие компоненты (`DataTable`, `Modal`, новые `EmptyState`, `Skeleton`). API не меняется.

**Tech Stack:** Next.js 16 (App Router, TypeScript), React 19, Tailwind CSS 4, react-hook-form + zod, Playwright (проекты `Desktop` и `Mobile`).

**Spec:** `docs/superpowers/specs/2026-09-24-admin-warehouse-redesign-design.md` (раздел «Этапы», пункт 1). Этапы 2–4 получат свои планы после слияния этого — они пишутся по реальному коду, который оставит этот этап.

## Global Constraints

- Все команды фронтенда — из каталога `admin/`.
- Телефон 360–412 px: без горизонтальной прокрутки страницы; интерактивные элементы не ниже 44 px (`min-h-11`), поля — 16 px (`text-base`) до `md`.
- Компьютер ≥ 1024 px: раскладка страниц прежняя, меняется только внешний вид токенов.
- Интерфейс — на русском.
- API и бэкенд в этом этапе не меняются.
- Коммиты — без трейлера `Co-Authored-By` и без строки «Generated with Claude Code» (личное правило пользователя в `~/.claude/CLAUDE.md`).
- Работа — в отдельной ветке `feat/warehouse-shell`, не в `main`.
- E2E идут поверх `php artisan mvp:acceptance --fresh --fixtures`; если фикстуры устарели (см. `docs/e2e-runbook.md`), перезапустить приёмку: `docker exec paradisekz-app-1 php artisan mvp:acceptance --fresh --fixtures --no-interaction` (стирает dev-базу — только если фикстур нет или они не сходятся).
- Известный красный тест до начала работы: `stock.spec.ts` «товар в наличии… 7 шт» падает при дрейфе фикстур — это окружение, не регрессия.

## Review Focus

1. **Модалка из липкой шапки на телефоне.** «+ Принять товар» в шапке (`sticky z-30`) открывает `CrudModal`; без портала модалка оказалась бы в контексте наложения шапки и под нижней панелью (`z-40`) — кнопка «Сохранить» не нажималась бы. Тест: Task 4, мобильный «модалка из шапки раздела — над нижней панелью».
2. **Старые ссылки с параметрами.** Закладка `/stock-movements?document=receipt:5` должна открыть движения этого документа, а не все. Тест: Task 3, «старые адреса ведут в новый раздел с параметрами».
3. **Нижняя панель на вложенных страницах раздела.** На `/warehouse/receipts/12` «Склад» внизу должен быть подсвечен. Тест: Task 4, мобильный «„Склад“ в нижней панели активен внутри раздела».
4. **Неизвестный `kind` в адресе документов.** `?kind=foo` (ручной ввод, старая ссылка) показывает приёмки, а не пустой экран. Тест: Task 4, «неизвестный вид документов показывает приёмки».
5. **Лента вкладок на 360 px.** Вкладки раздела и справочников листаются внутри себя, страница вбок не едет. Тест: Task 5, новые маршруты в `no-horizontal-scroll.spec.ts`.

---

## Карта файлов

**Создаются:**
- `admin/src/components/ui/EmptyState.tsx` — пустое состояние: иконка, заголовок, подсказка, действие.
- `admin/src/components/ui/Skeleton.tsx` — серый пульсирующий прямоугольник.
- `admin/src/components/ui/LinkTabs.tsx` — вкладки-ссылки: подчёркнутые с `md`, «таблетки» на телефоне.
- `admin/src/components/warehouse/WarehouseHeader.tsx` — шапка раздела: «Склад», кнопки создания, «⚙ Справочники», вкладки.
- `admin/src/components/warehouse/NewReceiptButton.tsx`, `NewWriteOffButton.tsx` — кнопка + прежняя модалка создания документа.
- `admin/src/components/warehouse/DirectoryHeader.tsx` — шапка справочников с переключателем.
- `admin/src/components/warehouse/ReceiptsList.tsx`, `WriteOffsList.tsx` — списки документов (тело прежних страниц без шапки).
- `admin/src/app/warehouse/layout.tsx`, `documents/page.tsx`.
- `admin/e2e/warehouse-shell.spec.ts`, `admin/e2e/mobile/warehouse.spec.ts`.

**Переносятся (`git mv`) и правятся:**
- `app/stock/page.tsx` → `app/warehouse/stock/page.tsx`
- `app/stock-movements/page.tsx` → `app/warehouse/movements/page.tsx`
- `app/goods-receipts/[id]/page.tsx` → `app/warehouse/receipts/[id]/page.tsx`
- `app/write-offs/[id]/page.tsx` → `app/warehouse/write-offs/[id]/page.tsx`
- `app/stores/page.tsx` → `app/warehouse/stores/page.tsx`
- `app/suppliers/page.tsx` → `app/warehouse/suppliers/page.tsx`

**Удаляются:** `app/goods-receipts/page.tsx`, `app/write-offs/page.tsx` (их тело уходит в `ReceiptsList` / `WriteOffsList`).

**Меняются:** `components/ui/styles.ts`, `Modal.tsx`, `CrudModal.tsx`, `SaveBar.tsx`, `ActionSheet.tsx`, `DataTable.tsx`, `DataTableCards.tsx`; `components/shell/navConfig.ts`; `lib/warehouse.ts`; `components/NoActiveStoreWarning.tsx`; `components/products/form/StockCard.tsx`; `admin/next.config.ts`; e2e `stock.spec.ts`, `warehouse.spec.ts`, `mobile/controls.spec.ts`, `mobile/shell.spec.ts`, `mobile/no-horizontal-scroll.spec.ts`.

---

### Task 1: Мягкие токены, `buttonGhost`, портал для `Modal`

**Files:**
- Modify: `admin/src/components/ui/styles.ts`
- Modify: `admin/src/components/ui/Modal.tsx`
- Modify: `admin/src/components/ui/CrudModal.tsx:10,55`
- Modify: `admin/src/components/ui/SaveBar.tsx:4,49`
- Modify: `admin/src/components/ui/ActionSheet.tsx:4,32`
- Modify: `admin/src/components/ui/DataTable.tsx:7,115,123`

**Interfaces:**
- Produces: `buttonGhost: string` из `@/components/ui/styles` — белая кнопка с рамкой для «Отмена»/«Закрыть»/пагинации. `buttonSecondary` теперь тонированная синяя. `cardClass` — `rounded-2xl` с мягкой тенью. `Modal` рендерится порталом в `document.body` (API компонента не меняется).

Автотестов на цвета нет и не будет — проверка этой задачи: сборка, типы и то, что существующие мобильные тесты (размеры кнопок, шторки) остаются зелёными. Портал проверяется мобильным тестом в Task 4 — там появляется первая модалка внутри липкой шапки.

- [ ] **Step 1: Создать ветку**

```bash
git switch -c feat/warehouse-shell
```

- [ ] **Step 2: Заменить токены в `styles.ts`**

Файл целиком:

```ts
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
```

- [ ] **Step 3: Нейтральные кнопки — на `buttonGhost`**

`CrudModal.tsx`: импорт `import { buttonGhost, buttonPrimary } from './styles';`, кнопка «Отмена» — `className={buttonGhost}`.

`SaveBar.tsx`: импорт `import { buttonGhost, buttonPrimary } from './styles';`, кнопка «Отменить» — `className={buttonGhost}`.

`ActionSheet.tsx`: импорт `import { buttonGhost } from './styles';`, кнопка «Закрыть» — ``className={`${buttonGhost} w-full`}``.

`DataTable.tsx`: импорт `import { buttonGhost } from './styles';`, обе кнопки пагинации («Назад», «Вперёд») — `className={buttonGhost}`.

- [ ] **Step 4: `Modal` — порталом в `document.body`**

В `Modal.tsx` добавить импорт `import { createPortal } from 'react-dom';`, дополнить комментарий компонента абзацем:

```ts
 * Рисуется порталом в `document.body`: липкая шапка экрана (`PageHeader`,
 * `sticky z-30`) — свой контекст наложения, и модалка, открытая кнопкой из
 * шапки, иначе оказалась бы под нижней панелью (`z-40`).
```

и заменить `return (` … `);` на:

```tsx
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-4" onMouseDown={onClose}>
      {/* …внутренности без изменений… */}
    </div>,
    document.body,
  );
```

Модалки монтируются только после действия пользователя, поэтому на сервере `document` не нужен.

- [ ] **Step 5: Проверить типы, линт, сборку**

```bash
cd admin && npx tsc --noEmit && npm run lint && npm run build
```

Expected: без ошибок.

- [ ] **Step 6: Прогнать существующие мобильные тесты**

```bash
cd admin && npx playwright test --project=Mobile e2e/mobile/controls.spec.ts e2e/mobile/shell.spec.ts e2e/mobile/brands.spec.ts
```

Expected: PASS (тест «поля формы приёмки идут в одну колонку» ещё ходит на `/goods-receipts` — пока старая страница на месте, он зелёный).

- [ ] **Step 7: Commit**

```bash
git add admin/src/components/ui
git commit -m "feat(admin): soft style tokens, ghost button, modal portal"
```

---

### Task 2: `EmptyState`, `Skeleton`, пустые состояния и скелеты в `DataTable`

**Files:**
- Create: `admin/src/components/ui/EmptyState.tsx`
- Create: `admin/src/components/ui/Skeleton.tsx`
- Modify: `admin/src/components/ui/DataTable.tsx`
- Modify: `admin/src/components/ui/DataTableCards.tsx`
- Test: `admin/e2e/mobile/brands.spec.ts` (существующий), новый тест в `admin/e2e/warehouse-shell.spec.ts` появится в Task 3 — здесь проверка через справочник поставщиков.

**Interfaces:**
- Consumes: `cardClass`, `buttonGhost` из Task 1.
- Produces:
  - `EmptyState({ title: string; hint?: string; icon?: ReactNode; action?: ReactNode; bare?: boolean })` — `bare` убирает рамку и фон (внутри ячейки таблицы).
  - `Skeleton({ className?: string })`.
  - `DataTable` получает проп `empty?: ReactNode` (перекрывает `emptyText`); при `loading` рисует скелеты и скрытый текст «Загрузка…» (`sr-only`); `emptyText` рисуется как `EmptyState` с одним заголовком.
  - `CardList({ columns, rows, loading, empty, rowKey })` — новая сигнатура (единственный потребитель — `DataTable`).

- [ ] **Step 1: Написать падающий тест пустого состояния**

Создать `admin/e2e/empty-state.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { ADMIN_SESSION } from "./session";

/**
 * Пустой список — не серая строка, а блок с заголовком: так видно, что
 * загрузка закончилась и записей правда нет.
 */
test.use({ storageState: ADMIN_SESSION });

test("пустой поиск поставщиков показывает пустое состояние", async ({ page }) => {
  await page.goto("/suppliers");
  await page.getByPlaceholder(/Поиск/).fill(`нет-такого-${Date.now()}`);

  const empty = page.getByTestId("empty-state");
  await expect(empty).toBeVisible();
  await expect(empty).toContainText("Поставщиков нет");
  await expect(page.getByText("Загрузка…", { exact: true })).toBeHidden();
});
```

Проверить, что у страницы поставщиков есть поле поиска с плейсхолдером, начинающимся на «Поиск», и `emptyText="Поставщиков нет"`:

```bash
grep -n "placeholder\|emptyText" admin/src/app/suppliers/page.tsx
```

Если текст другой — поправить ожидания теста под фактические строки страницы (сами строки не менять).

- [ ] **Step 2: Запустить — должен упасть**

```bash
cd admin && npx playwright test --project=Desktop e2e/empty-state.spec.ts
```

Expected: FAIL — `getByTestId("empty-state")` не найден.

- [ ] **Step 3: Создать `EmptyState.tsx`**

```tsx
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
```

- [ ] **Step 4: Создать `Skeleton.tsx`**

```tsx
/** Заглушка на время загрузки. Размер задаёт вызывающий через `className`. */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-zinc-200/70 ${className}`} />;
}
```

- [ ] **Step 5: `DataTableCards.tsx` — новая сигнатура `CardList`**

Заменить тип пропсов и тело `CardList` (функция `RowCard` не меняется; импорты дополнить):

```tsx
import { Fragment, type ReactNode } from 'react';
import type { Column, MobileRole } from './DataTable';
import Skeleton from './Skeleton';
import { cardClass } from './styles';

type CardListProps<T> = {
  columns: Column<T>[];
  rows: T[];
  loading: boolean;
  /** Что показать, когда записей нет (EmptyState). */
  empty: ReactNode;
  rowKey: (row: T) => string | number;
};

export function CardList<T>({ columns, rows, loading, empty, rowKey }: CardListProps<T>) {
  if (loading) {
    return (
      <ul className="space-y-3" aria-busy="true">
        <span className="sr-only">Загрузка…</span>
        {[0, 1, 2].map((i) => (
          <li key={i} className={`${cardClass} space-y-3 p-4`}>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </li>
        ))}
      </ul>
    );
  }

  if (rows.length === 0) {
    return <>{empty}</>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={rowKey(row)} className={`${cardClass} p-4 text-sm text-zinc-700`}>
          <RowCard columns={columns} row={row} />
        </li>
      ))}
    </ul>
  );
}
```

Комментарий над `CardList` оставить прежним.

- [ ] **Step 6: `DataTable.tsx` — проп `empty`, скелеты, `cardClass`**

Импорты:

```tsx
import type { ReactNode } from 'react';
import type { PageMeta } from '@/lib/crud';
import { useIsDesktop } from '@/lib/useIsDesktop';
import { CardList } from './DataTableCards';
import EmptyState from './EmptyState';
import Skeleton from './Skeleton';
import { buttonGhost, cardClass } from './styles';
```

В `DataTableProps<T>` добавить:

```ts
  /** Пустое состояние целиком (EmptyState с подсказкой и действием); перекрывает `emptyText`. */
  empty?: ReactNode;
```

Тело компонента от `const isDesktop` до конца `return` заменить:

```tsx
  const isDesktop = useIsDesktop();
  const emptyNode = empty ?? <EmptyState title={emptyText} bare={isDesktop} />;
  const pagination =
    meta && meta.last_page > 1 && onPageChange ? (
      <Pagination meta={meta} onPageChange={onPageChange} compact={!isDesktop} />
    ) : null;

  if (!isDesktop) {
    return (
      <div>
        <CardList columns={columns} rows={rows} loading={loading} empty={emptyNode} rowKey={rowKey} />
        {pagination}
      </div>
    );
  }

  return (
    <div className={`${cardClass} overflow-hidden`}>
      {/* Широкая таблица прокручивается внутри рамки, а не обрезается ею. */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-700" aria-busy={loading}>
          <thead className="border-b border-zinc-100 bg-zinc-50/70">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 font-medium text-zinc-500 ${c.className ?? ''}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  {columns.map((c, index) => (
                    <td key={c.key} className="px-4 py-3">
                      {i === 0 && index === 0 && <span className="sr-only">Загрузка…</span>}
                      <Skeleton className={index === 0 ? 'h-4 w-40' : 'h-4 w-16'} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>{emptyNode}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-zinc-50/70">
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
```

Добавить `empty` в деструктуризацию пропсов. В `Pagination` рамку полосы сменить на `border-zinc-100`.

- [ ] **Step 7: Запустить тест — должен пройти**

```bash
cd admin && npx playwright test --project=Desktop e2e/empty-state.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Типы, линт, сборка и соседние тесты**

```bash
cd admin && npx tsc --noEmit && npm run lint && npm run build
npx playwright test --project=Desktop e2e/attributes.spec.ts e2e/products.spec.ts e2e/catalog-groups.spec.ts
npx playwright test --project=Mobile e2e/mobile/brands.spec.ts
```

Expected: всё зелёное — списки с данными рисуются как раньше.

- [ ] **Step 9: Commit**

```bash
git add admin/src/components/ui admin/e2e/empty-state.spec.ts
git commit -m "feat(admin): empty states and loading skeletons in DataTable"
```

---

### Task 3: Раздел `/warehouse`: шапка, вкладки, Остатки и Движения, навигация, редиректы

**Files:**
- Create: `admin/src/components/ui/LinkTabs.tsx`
- Create: `admin/src/components/warehouse/WarehouseHeader.tsx`
- Create: `admin/src/app/warehouse/layout.tsx`
- Move + modify: `admin/src/app/stock/page.tsx` → `admin/src/app/warehouse/stock/page.tsx`
- Move + modify: `admin/src/app/stock-movements/page.tsx` → `admin/src/app/warehouse/movements/page.tsx`
- Modify: `admin/src/lib/warehouse.ts`
- Modify: `admin/src/components/shell/navConfig.ts`
- Modify: `admin/src/components/products/form/StockCard.tsx`
- Modify: `admin/next.config.ts`
- Create: `admin/e2e/warehouse-shell.spec.ts`
- Modify: `admin/e2e/stock.spec.ts`, `admin/e2e/mobile/controls.spec.ts`, `admin/e2e/mobile/no-horizontal-scroll.spec.ts`

**Interfaces:**
- Consumes: `PageHeader({ title, back?, actions?, below? })`, `buttonGhost`.
- Produces:
  - `LinkTabs({ label: string; tabs: LinkTab[]; active: string })`, `type LinkTab = { key: string; href: string; label: string; count?: number | null }` — `<nav aria-label={label}>` со ссылками, у активной `aria-current="page"`.
  - В `lib/warehouse.ts`: `warehouseHref` (см. код ниже), `type DocumentKind = 'receipts' | 'write_offs'`, `parseDocumentKind(value: string | null): DocumentKind`.
  - `WAREHOUSE_TABS: LinkTab[]`, `warehouseTabFor(pathname: string): string | null`, `WarehouseHeader({ active: string; actions?: ReactNode })` из `components/warehouse/WarehouseHeader.tsx`. В этой задаче `actions` пустые, кнопки создания добавит Task 4.

- [ ] **Step 1: Написать падающий e2e оболочки**

Создать `admin/e2e/warehouse-shell.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { ADMIN_SESSION } from "./session";

/**
 * Раздел «Склад»: один вход, вкладки, прежние адреса ведут сюда же.
 *
 * Шесть пунктов меню «Запасы» свернулись в один. Старые адреса живут в
 * закладках и в ссылках из уведомлений — редирект обязан донести и
 * параметры, иначе «движения этого документа» превратятся во «все движения».
 */
test.use({ storageState: ADMIN_SESSION });

test("«Склад» открывается на остатках, вкладки ведут по разделу", async ({ page }) => {
  await page.goto("/warehouse");
  await expect(page).toHaveURL(/\/warehouse\/stock$/);
  await expect(page.getByRole("heading", { level: 1, name: "Склад" })).toBeVisible();

  const tabs = page.getByRole("navigation", { name: "Разделы склада" });
  await expect(tabs.getByRole("link", { name: "Остатки" })).toHaveAttribute("aria-current", "page");

  await tabs.getByRole("link", { name: "Движения" }).click();
  await expect(page).toHaveURL(/\/warehouse\/movements$/);
  await expect(tabs.getByRole("link", { name: "Движения" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Остатки" })).not.toHaveAttribute("aria-current", "page");
});

test("старые адреса ведут в новый раздел с параметрами", async ({ page }) => {
  const cases: [string, RegExp][] = [
    ["/stock", /\/warehouse\/stock$/],
    ["/stock-movements?type=receipt", /\/warehouse\/movements\?type=receipt$/],
    ["/stock-movements?document=receipt:1", /\/warehouse\/movements\?document=receipt(%3A|:)1$/],
  ];

  for (const [from, to] of cases) {
    await page.goto(from);
    await expect(page, from).toHaveURL(to);
  }

  // Параметр дошёл до экрана, а не только до адреса.
  await expect(page.getByText("Показаны движения одного документа.")).toBeVisible();
});

test("«Склад» в меню ведёт в раздел", async ({ page }) => {
  await page.goto("/orders");
  await page.getByRole("link", { name: "Склад", exact: true }).first().click();
  await expect(page).toHaveURL(/\/warehouse\/stock$/);
});
```

- [ ] **Step 2: Запустить — должен упасть**

```bash
cd admin && npx playwright test --project=Desktop e2e/warehouse-shell.spec.ts
```

Expected: FAIL — `/warehouse` отвечает 404.

- [ ] **Step 3: Адреса раздела в `lib/warehouse.ts`**

Добавить в конец файла и заменить `documentHref`:

```ts
export type DocumentKind = 'receipts' | 'write_offs';

/** Неизвестное значение (ручной ввод, старая ссылка) — приёмки, а не пустой экран. */
export const parseDocumentKind = (value: string | null): DocumentKind =>
  value === 'write_offs' ? 'write_offs' : 'receipts';

/** Адреса раздела «Склад». Все ссылки на склад в админке строятся отсюда. */
export const warehouseHref = {
  overview: '/warehouse',
  stock: '/warehouse/stock',
  movements: '/warehouse/movements',
  documents: (kind: DocumentKind = 'receipts') => `/warehouse/documents?kind=${kind}`,
  receipt: (id: number) => `/warehouse/receipts/${id}`,
  writeOff: (id: number) => `/warehouse/write-offs/${id}`,
  stores: '/warehouse/stores',
  suppliers: '/warehouse/suppliers',
} as const;

export const documentHref = (document: NonNullable<StockMovement['document']>): string =>
  document.type === 'receipt'
    ? warehouseHref.receipt(document.id)
    : document.type === 'write_off'
      ? warehouseHref.writeOff(document.id)
      : `/orders/${document.id}`;
```

(Старое определение `documentHref` удалить — оно стояло в конце файла, строки 180–185.)

- [ ] **Step 4: Создать `LinkTabs.tsx`**

```tsx
import Link from 'next/link';

export type LinkTab = { key: string; href: string; label: string; count?: number | null };

type Props = { label: string; tabs: LinkTab[]; active: string };

/**
 * Вкладки-ссылки: каждая вкладка — адрес, поэтому F5, «назад» и ссылка в
 * мессенджере открывают ту же вкладку. (Общий `ui/Tabs` держит вкладку в
 * состоянии и сам рисует панель — для разделов не подходит.)
 *
 * С `md` — подчёркнутые вкладки; на телефоне — «таблетки» одной строкой,
 * которая листается вбок и выходит под поля каркаса (`-mx-4 px-4`), чтобы
 * крайняя вкладка не обрезалась по рамке.
 */
export default function LinkTabs({ label, tabs, active }: Props) {
  return (
    <nav
      aria-label={label}
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:gap-1 md:px-0 md:shadow-[inset_0_-1px_0_var(--color-zinc-200)]"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors md:min-h-0 md:rounded-none md:border-b-2 md:py-2.5 ${
              isActive
                ? 'bg-blue-600 text-white md:border-blue-600 md:bg-transparent md:text-blue-700'
                : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-zinc-900 md:border-transparent md:bg-transparent md:ring-0'
            }`}
          >
            {tab.label}
            {tab.count ? (
              <span className={`rounded-full px-1.5 text-xs ${isActive ? 'bg-white/20 md:bg-blue-50' : 'bg-zinc-100'}`}>
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 5: Создать `WarehouseHeader.tsx`**

```tsx
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { warehouseHref } from '@/lib/warehouse';
import LinkTabs, { type LinkTab } from '@/components/ui/LinkTabs';
import PageHeader from '@/components/ui/PageHeader';
import { buttonGhost } from '@/components/ui/styles';

/** Вкладки раздела. «Обзор» добавит этап 2. */
export const WAREHOUSE_TABS: LinkTab[] = [
  { key: 'stock', href: warehouseHref.stock, label: 'Остатки' },
  { key: 'movements', href: warehouseHref.movements, label: 'Движения' },
  { key: 'documents', href: warehouseHref.documents(), label: 'Документы' },
];

/** Вкладка, которой принадлежит адрес, или null — на документе и в справочниках шапки раздела нет. */
export function warehouseTabFor(pathname: string): string | null {
  return WAREHOUSE_TABS.find((tab) => tab.href.split('?')[0] === pathname)?.key ?? null;
}

/**
 * Шапка раздела «Склад»: заголовок, действия, вкладки. Липкая на телефоне
 * (через `below` у PageHeader), так что вкладки и «Принять товар» всегда
 * под рукой.
 */
export default function WarehouseHeader({ active, actions }: { active: string; actions?: ReactNode }) {
  return (
    <PageHeader
      title="Склад"
      actions={
        <>
          {actions}
          <Link href={warehouseHref.stores} className={buttonGhost} aria-label="Справочники" title="Справочники">
            <span aria-hidden="true">⚙</span>
            <span className="ml-1.5 hidden md:inline">Справочники</span>
          </Link>
        </>
      }
      below={<LinkTabs label="Разделы склада" tabs={WAREHOUSE_TABS} active={active} />}
    />
  );
}
```

- [ ] **Step 6: Создать `app/warehouse/layout.tsx`**

```tsx
'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import WarehouseHeader, { warehouseTabFor } from '@/components/warehouse/WarehouseHeader';

/**
 * Раздел «Склад». На страницах-вкладках — общая шапка с вкладками; карточка
 * документа и справочники рисуют свою шапку с «← назад».
 */
export default function WarehouseLayout({ children }: { children: ReactNode }) {
  const tab = warehouseTabFor(usePathname());

  return (
    <div>
      {tab && <WarehouseHeader active={tab} />}
      {children}
    </div>
  );
}
```

- [ ] **Step 7: Перенести Остатки**

```bash
mkdir -p admin/src/app/warehouse/stock admin/src/app/warehouse/movements
git mv admin/src/app/stock/page.tsx admin/src/app/warehouse/stock/page.tsx
git mv admin/src/app/stock-movements/page.tsx admin/src/app/warehouse/movements/page.tsx
```

В `app/warehouse/stock/page.tsx`:
- импорт `Link` оставить; добавить `import { warehouseHref } from '@/lib/warehouse';`
- блок заголовка (от `<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">` до его закрывающего `</div>`, включающий `<h1>Склад</h1>`, счётчик и ссылку «Приёмки и списания →») заменить на:

```tsx
        {total > 0 && <p className="text-sm text-zinc-500">{total} позиций</p>}
```

- ссылку «Движения» в строке таблицы — на новый адрес:

```tsx
                            href={`${warehouseHref.movements}?product_id=${row.product_id}${row.store ? `&store_id=${row.store.id}` : ''}`}
```

- [ ] **Step 8: Перенести Движения**

В `app/warehouse/movements/page.tsx`:
- удалить импорт `PageHeader`;
- блок `<PageHeader title="Движения" actions={…} />` заменить на:

```tsx
      {hasFilters && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            className={buttonSecondary}
            onClick={() => {
              movements.setPage(1);
              router.replace(pathname);
              setProductName('');
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      )}
```

- [ ] **Step 9: Навигация**

`navConfig.ts` — группа «Запасы» целиком:

```ts
  {
    // Одна ссылка, но с заголовком группы: Sidebar и MoreSheet берут
    // `group.title ?? 'root'` ключом, вторая группа без заголовка повторила бы ключ.
    title: 'Запасы',
    links: [{ href: '/warehouse', label: 'Склад' }],
  },
```

и в `PRIMARY_LINKS` — `{ href: '/warehouse', label: 'Склад', icon: 'stock' }`.

`StockCard.tsx` — импорт `import { warehouseHref } from '@/lib/warehouse';`, ссылки:

```tsx
        <Link href={warehouseHref.stock} className={buttonLink}>По складам →</Link>
        <Link href={`${warehouseHref.movements}?product_id=${product.id}`} className={buttonLink}>Движения →</Link>
```

- [ ] **Step 10: Редиректы в `next.config.ts`**

Файл целиком:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production Docker image.
  output: "standalone",
  experimental: {
  },
  /**
   * Раздел «Склад» переехал под /warehouse. Старые адреса живут в закладках
   * и ссылках — ведём их на новые; строку запроса Next переносит сам.
   * `/warehouse` пока открывает остатки — «Обзор» появится в этапе 2.
   */
  async redirects() {
    return [
      { source: "/warehouse", destination: "/warehouse/stock", permanent: false },
      { source: "/stock", destination: "/warehouse/stock", permanent: false },
      { source: "/stock-movements", destination: "/warehouse/movements", permanent: false },
    ];
  },
};

export default nextConfig;
```

Остальные редиректы добавят Task 4 и Task 5 — вместе со своими страницами.

- [ ] **Step 11: Обновить старые e2e под новые адреса**

`e2e/stock.spec.ts`: три `page.goto("/stock")` → `page.goto("/warehouse/stock")`. Шапочный комментарий: «Страница „Склад“» → «Вкладка „Остатки“ раздела „Склад“».

`e2e/mobile/controls.spec.ts`, тест «шапка экрана прилипает к верху при прокрутке»:

```ts
  await page.goto("/warehouse/movements");
  await page.waitForLoadState("networkidle");

  const heading = page.getByRole("heading", { level: 1, name: "Склад" });
```

`e2e/mobile/no-horizontal-scroll.spec.ts` — после `const ROUTES = …` добавить маршруты раздела (они не в меню, в меню только `/warehouse`):

```ts
const WAREHOUSE_ROUTES = ["/warehouse/stock", "/warehouse/movements"];

for (const route of [...ROUTES, ...WAREHOUSE_ROUTES]) {
```

(заменить заголовок существующего цикла `for (const route of ROUTES) {`).

- [ ] **Step 12: Прогнать — должно пройти**

```bash
cd admin && npx tsc --noEmit && npm run lint
npx playwright test --project=Desktop e2e/warehouse-shell.spec.ts e2e/stock.spec.ts e2e/empty-state.spec.ts
npx playwright test --project=Mobile e2e/mobile/controls.spec.ts e2e/mobile/no-horizontal-scroll.spec.ts e2e/mobile/shell.spec.ts
```

Expected: PASS (кроме известного дрейфа фикстур «7 шт» в `stock.spec`, если он был красным до начала). Next dev-сервер подхватывает `next.config.ts` только после перезапуска — если редирект-тест красный с 404, перезапустить `npm run dev`.

- [ ] **Step 13: Commit**

```bash
git add -A admin/src admin/next.config.ts admin/e2e
git commit -m "feat(admin): warehouse section shell with stock and movements tabs"
```

---

### Task 4: Документы: вкладка, кнопки создания в шапке, карточки документов

**Files:**
- Create: `admin/src/components/warehouse/ReceiptsList.tsx`
- Create: `admin/src/components/warehouse/WriteOffsList.tsx`
- Create: `admin/src/components/warehouse/NewReceiptButton.tsx`
- Create: `admin/src/components/warehouse/NewWriteOffButton.tsx`
- Create: `admin/src/app/warehouse/documents/page.tsx`
- Move + modify: `admin/src/app/goods-receipts/[id]/page.tsx` → `admin/src/app/warehouse/receipts/[id]/page.tsx`
- Move + modify: `admin/src/app/write-offs/[id]/page.tsx` → `admin/src/app/warehouse/write-offs/[id]/page.tsx`
- Delete: `admin/src/app/goods-receipts/page.tsx`, `admin/src/app/write-offs/page.tsx`
- Modify: `admin/src/app/warehouse/layout.tsx`, `admin/next.config.ts`
- Modify: `admin/e2e/warehouse-shell.spec.ts`, `admin/e2e/warehouse.spec.ts`, `admin/e2e/mobile/controls.spec.ts`, `admin/e2e/mobile/no-horizontal-scroll.spec.ts`
- Create: `admin/e2e/mobile/warehouse.spec.ts`

**Interfaces:**
- Consumes: `warehouseHref`, `parseDocumentKind`, `DocumentKind`, `LinkTabs`, `WarehouseHeader({ active, actions })` (Task 3); `CrudModal`, `receiptSchema`/`toReceiptForm`/`toReceiptPayload`/`ReceiptFields` из `GoodsReceiptForm.tsx`, `writeOffSchema`/`toWriteOffForm`/`WriteOffFields` из `WriteOffForm.tsx`.
- Produces: `NewReceiptButton()` — основная кнопка «+ Принять товар»; `NewWriteOffButton()` — вторичная «Списать». Этап 3 заменит их внутренности на создание без модалки, не меняя имён.

- [ ] **Step 1: Дописать падающие тесты**

В `admin/e2e/warehouse-shell.spec.ts` добавить:

```ts
test("вкладка «Документы» переключает приёмки и списания", async ({ page }) => {
  await page.goto("/warehouse/stock");
  await page.getByRole("navigation", { name: "Разделы склада" }).getByRole("link", { name: "Документы" }).click();
  await expect(page).toHaveURL(/\/warehouse\/documents\?kind=receipts$/);

  const kinds = page.getByRole("navigation", { name: "Вид документов" });
  await expect(kinds.getByRole("link", { name: "Приёмки" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("columnheader", { name: "Поставщик" })).toBeVisible();

  await kinds.getByRole("link", { name: "Списания" }).click();
  await expect(page).toHaveURL(/kind=write_offs$/);
  await expect(page.getByRole("columnheader", { name: "Причина" })).toBeVisible();
});

test("неизвестный вид документов показывает приёмки", async ({ page }) => {
  await page.goto("/warehouse/documents?kind=foo");
  await expect(
    page.getByRole("navigation", { name: "Вид документов" }).getByRole("link", { name: "Приёмки" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("columnheader", { name: "Поставщик" })).toBeVisible();
});

test("старые адреса документов ведут в раздел", async ({ page, request }) => {
  const cases: [string, RegExp][] = [
    ["/goods-receipts", /\/warehouse\/documents\?kind=receipts$/],
    ["/write-offs?status=draft", /\/warehouse\/documents\?(kind=write_offs&status=draft|status=draft&kind=write_offs)$/],
  ];
  for (const [from, to] of cases) {
    await page.goto(from);
    await expect(page, from).toHaveURL(to);
  }

  // Старая ссылка на конкретный документ.
  const api = adminApi(request);
  const store = await api.create<{ data: { id: number } }>("/admin/stores", { name: `E2E склад ${Date.now()}`, is_active: false });
  const receipt = await api.create<{ data: { id: number } }>("/admin/goods-receipts", { store_id: store.data.id });
  try {
    await page.goto(`/goods-receipts/${receipt.data.id}`);
    await expect(page).toHaveURL(new RegExp(`/warehouse/receipts/${receipt.data.id}$`));
    await expect(page.getByRole("heading", { level: 1, name: `Приёмка №${receipt.data.id}` })).toBeVisible();
  } finally {
    await api.delete(`/admin/goods-receipts/${receipt.data.id}`);
  }
});
```

и импорт в начало файла: `import { adminApi } from "./adminApi";`.

Создать `admin/e2e/mobile/warehouse.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { ADMIN_SESSION } from "../session";

/**
 * Раздел «Склад» на телефоне: вкладки одной строкой, «Склад» внизу
 * подсвечен в любом месте раздела, модалка из липкой шапки не прячется под
 * нижней панелью.
 */
test.use({ storageState: ADMIN_SESSION });

test("«Склад» в нижней панели активен внутри раздела", async ({ page }) => {
  await page.goto("/warehouse/documents?kind=write_offs");
  const nav = page.getByRole("navigation", { name: "Основное меню" });
  await expect(nav.getByRole("link", { name: "Склад" })).toHaveAttribute("aria-current", "page");
});

test("вкладки раздела — одна строка", async ({ page }) => {
  await page.goto("/warehouse/stock");
  const tops = await page
    .getByRole("navigation", { name: "Разделы склада" })
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
});

test("модалка из шапки раздела — над нижней панелью", async ({ page }) => {
  await page.goto("/warehouse/stock");
  await page.getByRole("button", { name: /Принять товар/ }).click();

  const dialog = page.getByRole("dialog", { name: "Новая приёмка" });
  await expect(dialog).toBeVisible();

  // Кнопку видно — мало; проверяем, что в её центре именно она, а не нижняя панель.
  const save = dialog.getByRole("button", { name: "Сохранить" });
  const box = (await save.boundingBox())!;
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.textContent?.trim() ?? null,
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  expect(hit).toBe("Сохранить");

  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toBeHidden();
});
```

- [ ] **Step 2: Запустить — должны упасть**

```bash
cd admin && npx playwright test --project=Desktop e2e/warehouse-shell.spec.ts
npx playwright test --project=Mobile e2e/mobile/warehouse.spec.ts
```

Expected: FAIL — `/warehouse/documents` 404, кнопки «Принять товар» нет.

- [ ] **Step 3: `ReceiptsList.tsx` — тело прежней страницы приёмок**

```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useResource } from '@/lib/crud';
import { formatTenge } from '@/lib/money';
import { formatDateTime, warehouseHref, type GoodsReceiptListItem } from '@/lib/warehouse';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { inputClass } from '@/components/ui/styles';
import DocumentStatusBadge from './DocumentStatusBadge';
import StoreSelect from './StoreSelect';

/** Список приёмок с фильтрами по статусу и складу. Создание — кнопкой в шапке раздела. */
export default function ReceiptsList() {
  const [status, setStatus] = useState('');
  const [storeId, setStoreId] = useState('');
  const params: Record<string, string> = {};
  if (status) params['filter[status]'] = status;
  if (storeId) params['filter[store_id]'] = storeId;

  const receipts = useResource<GoodsReceiptListItem>('/admin/goods-receipts', params);

  const columns: Column<GoodsReceiptListItem>[] = [
    {
      key: 'number',
      header: 'Приёмка',
      render: (r) => (
        <Link href={warehouseHref.receipt(r.id)} className="font-medium text-zinc-900 hover:text-blue-700">
          {r.number || `№${r.id}`}
        </Link>
      ),
    },
    { key: 'date', header: 'Дата', render: (r) => formatDateTime(r.received_at) },
    { key: 'supplier', header: 'Поставщик', render: (r) => r.supplier?.name ?? '—' },
    { key: 'store', header: 'Склад', render: (r) => r.store.name },
    { key: 'items', header: 'Позиций', render: (r) => r.items_count },
    { key: 'total', header: 'Сумма', render: (r) => formatTenge(r.total_cost) },
    { key: 'status', header: 'Статус', render: (r) => <DocumentStatusBadge status={r.status} postedLabel="Проведена" /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          aria-label="Статус"
          className={`${inputClass} max-w-48`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            receipts.setPage(1);
          }}
        >
          <option value="">Все статусы</option>
          <option value="draft">Черновики</option>
          <option value="posted">Проведённые</option>
        </select>
        <StoreSelect
          aria-label="Склад"
          emptyLabel="Все склады"
          className="max-w-64"
          value={storeId}
          onChange={(e) => {
            setStoreId(e.target.value);
            receipts.setPage(1);
          }}
        />
      </div>
      <DataTable
        columns={columns}
        rows={receipts.items}
        loading={receipts.loading}
        meta={receipts.meta}
        onPageChange={receipts.setPage}
        emptyText="Приёмок нет"
      />
    </div>
  );
}
```

- [ ] **Step 4: `WriteOffsList.tsx` — тело прежней страницы списаний**

```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useResource } from '@/lib/crud';
import { formatDateTime, warehouseHref, WRITE_OFF_REASONS, type WriteOffListItem } from '@/lib/warehouse';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { inputClass } from '@/components/ui/styles';
import DocumentStatusBadge from './DocumentStatusBadge';
import StoreSelect from './StoreSelect';

/** Список списаний с фильтрами по статусу, складу и причине. Создание — кнопкой в шапке раздела. */
export default function WriteOffsList() {
  const [status, setStatus] = useState('');
  const [storeId, setStoreId] = useState('');
  const [reason, setReason] = useState('');
  const params: Record<string, string> = {};
  if (status) params['filter[status]'] = status;
  if (storeId) params['filter[store_id]'] = storeId;
  if (reason) params['filter[reason]'] = reason;

  const writeOffs = useResource<WriteOffListItem>('/admin/write-offs', params);
  const resetPage = () => writeOffs.setPage(1);

  const columns: Column<WriteOffListItem>[] = [
    {
      key: 'label',
      header: 'Списание',
      render: (w) => (
        <Link href={warehouseHref.writeOff(w.id)} className="font-medium text-zinc-900 hover:text-blue-700">
          №{w.id}
        </Link>
      ),
    },
    { key: 'date', header: 'Дата', render: (w) => formatDateTime(w.posted_at ?? w.created_at) },
    { key: 'store', header: 'Склад', render: (w) => w.store.name },
    { key: 'reason', header: 'Причина', render: (w) => WRITE_OFF_REASONS[w.reason] ?? w.reason },
    { key: 'items', header: 'Позиций', render: (w) => w.items_count },
    { key: 'status', header: 'Статус', render: (w) => <DocumentStatusBadge status={w.status} postedLabel="Проведено" /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <select aria-label="Статус" className={`${inputClass} max-w-48`} value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
          <option value="">Все статусы</option>
          <option value="draft">Черновики</option>
          <option value="posted">Проведённые</option>
        </select>
        <StoreSelect aria-label="Склад" emptyLabel="Все склады" className="max-w-64" value={storeId} onChange={(e) => { setStoreId(e.target.value); resetPage(); }} />
        <select aria-label="Причина" className={`${inputClass} max-w-56`} value={reason} onChange={(e) => { setReason(e.target.value); resetPage(); }}>
          <option value="">Все причины</option>
          {Object.entries(WRITE_OFF_REASONS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <DataTable
        columns={columns}
        rows={writeOffs.items}
        loading={writeOffs.loading}
        meta={writeOffs.meta}
        onPageChange={writeOffs.setPage}
        emptyText="Списаний нет"
      />
    </div>
  );
}
```

- [ ] **Step 5: Кнопки создания**

`NewReceiptButton.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import api from '@/lib/api';
import { useResource } from '@/lib/crud';
import { warehouseHref, type GoodsReceipt, type Supplier } from '@/lib/warehouse';
import CrudModal from '@/components/ui/CrudModal';
import { buttonPrimary } from '@/components/ui/styles';
import { ReceiptFields, receiptSchema, toReceiptForm, toReceiptPayload } from './GoodsReceiptForm';

/**
 * «+ Принять товар»: шапка приёмки в модалке, затем карточка документа.
 * Этап 3 заменит модалку созданием черновика сразу.
 */
export default function NewReceiptButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
        + Принять товар
      </button>
      {open && <NewReceiptModal onClose={() => setOpen(false)} />}
    </>
  );
}

/** Отдельный компонент — поставщики грузятся, только когда модалка открыта. */
function NewReceiptModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const suppliers = useResource<Supplier>('/admin/suppliers');

  return (
    <CrudModal
      title="Новая приёмка"
      schema={receiptSchema}
      defaultValues={toReceiptForm(null)}
      onSubmit={async (values) => {
        const res = await api.post<{ data: GoodsReceipt }>('/admin/goods-receipts', toReceiptPayload(values));
        router.push(warehouseHref.receipt(res.data.data.id));
      }}
      onClose={onClose}
    >
      {(form) => <ReceiptFields form={form} suppliers={suppliers.items} />}
    </CrudModal>
  );
}
```

`NewWriteOffButton.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import api from '@/lib/api';
import { warehouseHref, type WriteOff } from '@/lib/warehouse';
import CrudModal from '@/components/ui/CrudModal';
import { buttonSecondary } from '@/components/ui/styles';
import { toWriteOffForm, WriteOffFields, writeOffSchema } from './WriteOffForm';

/**
 * «Списать»: шапка списания в модалке, затем карточка документа.
 * Этап 3 заменит модалку созданием черновика сразу.
 */
export default function NewWriteOffButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={buttonSecondary} onClick={() => setOpen(true)}>
        Списать
      </button>
      {open && (
        <CrudModal
          title="Новое списание"
          schema={writeOffSchema}
          defaultValues={toWriteOffForm(null)}
          onSubmit={async (values) => {
            const res = await api.post<{ data: WriteOff }>('/admin/write-offs', values);
            router.push(warehouseHref.writeOff(res.data.data.id));
          }}
          onClose={() => setOpen(false)}
        >
          {(form) => <WriteOffFields form={form} />}
        </CrudModal>
      )}
    </>
  );
}
```

Проверить, что `POST /admin/goods-receipts` и `/admin/write-offs` отвечают `{ data: {...} }` (так их читал `useResource.create` — `res.data?.data ?? res.data`):

```bash
grep -n "return response()->json\|JsonResource\|new .*Resource" ../app/Http/Controllers/Api/Admin/GoodsReceiptController.php ../app/Http/Controllers/Api/Admin/WriteOffController.php
```

Если `store` отвечает без обёртки `data`, читать `res.data.data ?? res.data` — как `useResource.create`.

- [ ] **Step 6: Кнопки — в шапку раздела**

`app/warehouse/layout.tsx`: импорты `NewReceiptButton`, `NewWriteOffButton`; строка шапки:

```tsx
      {tab && (
        <WarehouseHeader
          active={tab}
          actions={
            <>
              <NewReceiptButton />
              <NewWriteOffButton />
            </>
          }
        />
      )}
```

- [ ] **Step 7: Страница `app/warehouse/documents/page.tsx`**

```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { parseDocumentKind, warehouseHref } from '@/lib/warehouse';
import LinkTabs from '@/components/ui/LinkTabs';
import ReceiptsList from '@/components/warehouse/ReceiptsList';
import WriteOffsList from '@/components/warehouse/WriteOffsList';

function DocumentsView() {
  const kind = parseDocumentKind(useSearchParams().get('kind'));

  return (
    <div className="space-y-4">
      <LinkTabs
        label="Вид документов"
        active={kind}
        tabs={[
          { key: 'receipts', href: warehouseHref.documents('receipts'), label: 'Приёмки' },
          { key: 'write_offs', href: warehouseHref.documents('write_offs'), label: 'Списания' },
        ]}
      />
      {kind === 'receipts' ? <ReceiptsList /> : <WriteOffsList />}
    </div>
  );
}

export default function DocumentsPage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense fallback={null}>
      <DocumentsView />
    </Suspense>
  );
}
```

- [ ] **Step 8: Перенести карточки документов, удалить старые списки**

```bash
mkdir -p "admin/src/app/warehouse/receipts/[id]" "admin/src/app/warehouse/write-offs/[id]"
git mv "admin/src/app/goods-receipts/[id]/page.tsx" "admin/src/app/warehouse/receipts/[id]/page.tsx"
git mv "admin/src/app/write-offs/[id]/page.tsx" "admin/src/app/warehouse/write-offs/[id]/page.tsx"
git rm admin/src/app/goods-receipts/page.tsx admin/src/app/write-offs/page.tsx
```

В `app/warehouse/receipts/[id]/page.tsx` добавить `warehouseHref` в импорт из `@/lib/warehouse` и заменить адреса:
- `<Link href="/goods-receipts" …>← К приёмкам</Link>` → `href={warehouseHref.documents('receipts')}`
- `back="/goods-receipts"` → `back={warehouseHref.documents('receipts')}`
- `router.push('/goods-receipts')` → `router.push(warehouseHref.documents('receipts'))`
- ``href={`/stock-movements?document=receipt:${receipt.id}`}`` → ``href={`${warehouseHref.movements}?document=receipt:${receipt.id}`}``

В `app/warehouse/write-offs/[id]/page.tsx` — то же с `'write_offs'`:
- `href="/write-offs"` → `href={warehouseHref.documents('write_offs')}`
- `back="/write-offs"` → `back={warehouseHref.documents('write_offs')}`
- `router.push('/write-offs')` → `router.push(warehouseHref.documents('write_offs'))`
- ``href={`/stock-movements?document=write_off:${writeOff.id}`}`` → ``href={`${warehouseHref.movements}?document=write_off:${writeOff.id}`}``

Проверить, что старых адресов в `src` не осталось:

```bash
grep -rnE "'/(goods-receipts|write-offs|stock-movements)|\`/(goods-receipts|write-offs|stock-movements)" admin/src
```

Expected: пусто.

- [ ] **Step 9: Редиректы документов**

В `redirects()` в `admin/next.config.ts` добавить после `/stock-movements`:

```ts
      { source: "/goods-receipts", destination: "/warehouse/documents?kind=receipts", permanent: false },
      { source: "/goods-receipts/:id", destination: "/warehouse/receipts/:id", permanent: false },
      { source: "/write-offs", destination: "/warehouse/documents?kind=write_offs", permanent: false },
      { source: "/write-offs/:id", destination: "/warehouse/write-offs/:id", permanent: false },
```

- [ ] **Step 10: Обновить `warehouse.spec.ts`, `controls.spec.ts`, `no-horizontal-scroll.spec.ts`**

`e2e/warehouse.spec.ts` — вспомогательная функция после `addLine`:

```ts
/** Черновик на удаление: адрес карточки — /warehouse/…, а API — /admin/goods-receipts|write-offs/{id}. */
function draftPath(page: Page, apiPrefix: "/admin/goods-receipts" | "/admin/write-offs"): string {
  return `${apiPrefix}/${new URL(page.url()).pathname.split("/").pop()}`;
}
```

Тест «приёмка проводится…» (строку `page.goto("/suppliers")` не трогать — поставщики переезжают в Task 5, там же меняется и она):
- `await page.goto("/goods-receipts");` + `getByRole("button", { name: "Новая приёмка" })` →

```ts
  await page.goto("/warehouse/documents?kind=receipts");
  await page.getByRole("button", { name: /Принять товар/ }).click();
```

- `await expect(page).toHaveURL(/\/goods-receipts\/\d+$/);` → `/\/warehouse\/receipts\/\d+$/`
- `drafts.push(\`/admin${new URL(page.url()).pathname}\`);` → `drafts.push(draftPath(page, "/admin/goods-receipts"));`
- `await page.goto("/stock");` → `await page.goto("/warehouse/stock");`
- `await expect(page).toHaveURL(/\/stock-movements\?/);` → `await expect(page).toHaveURL(/\/warehouse\/movements\?/);`

Тест «списание больше остатка…»:

```ts
  await page.goto("/warehouse/documents?kind=write_offs");
  await page.getByRole("button", { name: "Списать", exact: true }).click();
```

- `toHaveURL(/\/write-offs\/\d+$/)` → `toHaveURL(/\/warehouse\/write-offs\/\d+$/)`
- `drafts.push(…)` → `drafts.push(draftPath(page, "/admin/write-offs"));`

`e2e/mobile/controls.spec.ts`, тест «поля формы приёмки идут в одну колонку»:

```ts
  await page.goto("/warehouse/documents?kind=receipts");
  await page.getByRole("button", { name: /Принять товар/ }).click();
```

`e2e/mobile/no-horizontal-scroll.spec.ts`:

```ts
const WAREHOUSE_ROUTES = [
  "/warehouse/stock",
  "/warehouse/movements",
  "/warehouse/documents?kind=receipts",
  "/warehouse/documents?kind=write_offs",
];
```

и в тесте «документы не прокручиваются вбок» префиксы:

```ts
    ["/admin/goods-receipts", "/warehouse/receipts"],
    ["/admin/write-offs", "/warehouse/write-offs"],
```

- [ ] **Step 11: Прогнать — должно пройти**

Перезапустить `npm run dev` (новые редиректы), затем:

```bash
cd admin && npx tsc --noEmit && npm run lint
npx playwright test --project=Desktop e2e/warehouse-shell.spec.ts e2e/warehouse.spec.ts
npx playwright test --project=Mobile e2e/mobile/warehouse.spec.ts e2e/mobile/controls.spec.ts e2e/mobile/no-horizontal-scroll.spec.ts
```

Expected: PASS, кроме теста «приёмка проводится…» в `warehouse.spec.ts`, который ещё ходит на `/suppliers` — он должен остаться зелёным, потому что старая страница поставщиков ещё на месте.

- [ ] **Step 12: Commit**

```bash
git add -A admin/src admin/next.config.ts admin/e2e
git commit -m "feat(admin): documents tab, create buttons in the warehouse header"
```

---

### Task 5: Справочники под `/warehouse`, «Места хранения», ссылки и финальная проверка

**Files:**
- Create: `admin/src/components/warehouse/DirectoryHeader.tsx`
- Move + modify: `admin/src/app/stores/page.tsx` → `admin/src/app/warehouse/stores/page.tsx`
- Move + modify: `admin/src/app/suppliers/page.tsx` → `admin/src/app/warehouse/suppliers/page.tsx`
- Modify: `admin/src/components/NoActiveStoreWarning.tsx`, `admin/next.config.ts`
- Modify: `admin/e2e/warehouse-shell.spec.ts`, `admin/e2e/warehouse.spec.ts`, `admin/e2e/empty-state.spec.ts`, `admin/e2e/mobile/shell.spec.ts`, `admin/e2e/mobile/no-horizontal-scroll.spec.ts`

**Interfaces:**
- Consumes: `LinkTabs`, `PageHeader`, `warehouseHref`.
- Produces: `DirectoryHeader({ active: 'stores' | 'suppliers'; actions?: ReactNode })`.

- [ ] **Step 1: Дописать падающий тест справочников**

В `admin/e2e/warehouse-shell.spec.ts`:

```ts
test("справочники открываются из шапки и переключаются", async ({ page }) => {
  await page.goto("/warehouse/stock");
  await page.getByRole("link", { name: "Справочники" }).click();

  await expect(page).toHaveURL(/\/warehouse\/stores$/);
  await expect(page.getByRole("heading", { level: 1, name: "Справочники" })).toBeVisible();
  const dirs = page.getByRole("navigation", { name: "Справочники склада" });
  await expect(dirs.getByRole("link", { name: "Места хранения" })).toHaveAttribute("aria-current", "page");

  await dirs.getByRole("link", { name: "Поставщики" }).click();
  await expect(page).toHaveURL(/\/warehouse\/suppliers$/);

  await page.getByRole("link", { name: "Назад" }).click();
  await expect(page).toHaveURL(/\/warehouse\/stock$/);
});

test("старые адреса справочников ведут в раздел", async ({ page }) => {
  await page.goto("/stores");
  await expect(page).toHaveURL(/\/warehouse\/stores$/);
  await page.goto("/suppliers");
  await expect(page).toHaveURL(/\/warehouse\/suppliers$/);
});
```

- [ ] **Step 2: Запустить — должен упасть**

```bash
cd admin && npx playwright test --project=Desktop e2e/warehouse-shell.spec.ts -g "справочник"
```

Expected: FAIL — ссылка «Справочники» ведёт на 404 `/warehouse/stores`.

- [ ] **Step 3: `DirectoryHeader.tsx`**

```tsx
import type { ReactNode } from 'react';
import { warehouseHref } from '@/lib/warehouse';
import LinkTabs from '@/components/ui/LinkTabs';
import PageHeader from '@/components/ui/PageHeader';

/** Шапка справочников склада: «← Склад», переключатель «Места хранения / Поставщики». */
export default function DirectoryHeader({ active, actions }: { active: 'stores' | 'suppliers'; actions?: ReactNode }) {
  return (
    <PageHeader
      title="Справочники"
      back={warehouseHref.overview}
      actions={actions}
      below={
        <LinkTabs
          label="Справочники склада"
          active={active}
          tabs={[
            { key: 'stores', href: warehouseHref.stores, label: 'Места хранения' },
            { key: 'suppliers', href: warehouseHref.suppliers, label: 'Поставщики' },
          ]}
        />
      }
    />
  );
}
```

- [ ] **Step 4: Перенести справочники**

```bash
mkdir -p admin/src/app/warehouse/stores admin/src/app/warehouse/suppliers
git mv admin/src/app/stores/page.tsx admin/src/app/warehouse/stores/page.tsx
git mv admin/src/app/suppliers/page.tsx admin/src/app/warehouse/suppliers/page.tsx
```

`app/warehouse/stores/page.tsx`:
- импорт `PageHeader` заменить на `import DirectoryHeader from '@/components/warehouse/DirectoryHeader';`
- `<PageHeader title="Склады" actions={…Добавить склад…} />` →

```tsx
      <DirectoryHeader
        active="stores"
        actions={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить место хранения</button>}
      />
```

- подсказку под шапкой:

```tsx
      <p className="mb-4 text-sm text-zinc-500">
        Место «по умолчанию» витрина выбирает первым. Выключенное место не видно клиентам, но в нём можно проводить приёмки и списания.
      </p>
```

- `emptyText="Складов нет"` → `emptyText="Мест хранения нет"`
- заголовок модалки `editing ? 'Изменить склад' : 'Новый склад'` → `editing ? 'Изменить место хранения' : 'Новое место хранения'`
- вопрос удаления → `"Удалить место хранения? Место с историей удалить нельзя — его можно только выключить."`
- подпись флажка `Склад по умолчанию` → `По умолчанию`

`app/warehouse/suppliers/page.tsx`: импорт `PageHeader` → `DirectoryHeader`; `<PageHeader title="Поставщики" actions={…} />` → `<DirectoryHeader active="suppliers" actions={…} />` с той же кнопкой «Добавить поставщика».

`NoActiveStoreWarning.tsx`: `import { warehouseHref } from '@/lib/warehouse';`, `href={warehouseHref.stores}`; в комментарии `/stores` → `/warehouse/stores`.

- [ ] **Step 5: Редиректы справочников**

В `redirects()` добавить:

```ts
      { source: "/stores", destination: "/warehouse/stores", permanent: false },
      { source: "/suppliers", destination: "/warehouse/suppliers", permanent: false },
```

- [ ] **Step 6: Убедиться, что старых каталогов не осталось**

```bash
ls admin/src/app | grep -E "^(stock|stock-movements|goods-receipts|write-offs|stores|suppliers)$"
grep -rnE "['\"\`]/(stock|stock-movements|goods-receipts|write-offs|stores|suppliers)(['\"\`/?])" admin/src
```

Expected: оба пусто (строки API вида `'/admin/stores'` под шаблон не попадают — у них префикс `/admin`). Если пустые каталоги остались после `git mv` — удалить их `rmdir`.

- [ ] **Step 7: Обновить оставшиеся e2e**

`e2e/warehouse.spec.ts`:
- `await page.goto("/suppliers");` → `await page.goto("/warehouse/suppliers");`
- `await page.goto("/stores");` → `await page.goto("/warehouse/stores");`

`e2e/empty-state.spec.ts`: `await page.goto("/suppliers");` → `await page.goto("/warehouse/suppliers");`

`e2e/mobile/shell.spec.ts`, тест «„Ещё“ показывает все разделы…» — «Поставщиков» в меню больше нет, раздел не из главных теперь «Бренды»:

```ts
  await sheet.getByRole("link", { name: "Бренды", exact: true }).click();
  await expect(page).toHaveURL(/\/brands$/);
```

`e2e/mobile/no-horizontal-scroll.spec.ts` — в `WAREHOUSE_ROUTES` добавить `"/warehouse/stores"`, `"/warehouse/suppliers"`.

- [ ] **Step 8: Полная проверка этапа**

Перезапустить `npm run dev`, затем:

```bash
cd admin && npx tsc --noEmit && npm run lint && npm run build
npx playwright test
```

Expected: всё зелёное (оба проекта), кроме тестов, которые были красными до начала этапа из-за фикстур (см. Global Constraints) — их сравнить со списком базового прогона.

- [ ] **Step 9: Ручная проверка**

На телефоне (Pixel 7 в `preview` или DevTools 360 px) и на ПК пройти: `/warehouse` → Остатки → Движения → Документы → Списания → «+ Принять товар» (модалка поверх нижней панели) → «Отмена» → ⚙ → Места хранения → Поставщики → «←». Отдельно открыть `/orders` и `/products/{id}`: новые токены стиля не сломали раскладку (кнопки не вылезли, `SaveBar` на месте).

- [ ] **Step 10: Commit**

```bash
git add -A admin/src admin/next.config.ts admin/e2e
git commit -m "feat(admin): warehouse directories under /warehouse, storage places naming"
```

- [ ] **Step 11: Проверить, что в коммитах нет трейлеров атрибуции**

```bash
git log main..HEAD --format=%B | grep -iE "co-authored-by|generated with" || echo "clean"
```

Expected: `clean`.
