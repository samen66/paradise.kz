# Раздел «Склад», этап 3б: экраны быстрой приёмки и списания — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Менеджер нажимает «+ Принять товар» — сразу открывается черновик; товары видны списком без ввода, добавляются по одному из поля или десятками через «☰ Подбор»; количество и цена правятся прямо в строке и сохраняются сами; ни одной модалки. То же — у списания.

**Architecture:** Один каркас «живого документа» в `admin/src/components/warehouse/document/` для приёмки и списания: хук `useDocument(kind, id)` держит шапку и строки (строки — с введённым текстом, чтобы полусобранное «1.» не терялось), правки уходят через очередь `useAutosave` (`lib/useAutosave.ts`, отложенно 600 мс, по ключу, по порядку), список товаров для поля и «Подбора» — хук `useProductPicker` поверх `GET /admin/product-picker` из этапа 3а. Создание — `createDraft` (`lib/warehouse.ts`) без тела, кроме склада из фильтра страницы. Вкладка «Документы» переводит фильтры в адрес. Модалки создания и строк удаляются.

**Tech Stack:** Next.js 16 (App Router, `'use client'`), React 19, TypeScript, Tailwind CSS 4, axios, zustand (тосты); Playwright (Desktop Chrome + Pixel 7).

**Spec:** `docs/superpowers/specs/2026-09-24-admin-warehouse-redesign-design.md` — разделы «Документы» (вкладка, «Создание документа», «Карточка документа», «Добавление товаров»), «Экран „Остатки“» (меню «⋯»), «Ошибки и состояния загрузки», «Тестирование → Фронтенд», «Этапы» п. 3б. API — этап 3а (уже в `main`): `POST /admin/goods-receipts|write-offs` с пустым телом, `POST …/items { product_id }` (повтор → 200 и +к количеству), `POST …/items/batch { items: [{product_id, quantity}] }`, `GET /admin/product-picker?store_id=&filter[search|category_id|recent|in_stock]=&page=` (по 30; строка `{id, name, code, article, uom, on_hand, suggested_unit_cost}`).

## Global Constraints

- Остатки только читаются: экраны меняют остаток только проведением документа через API; ничего в `products.stock` и `product_store_stock` не пишется.
- Деньги: API отдаёт тиыны (`unit_cost`, `suggested_unit_cost`, `total_cost`), принимает тенге (`unit_cost` в `POST/PUT …/items`); перевод — только `lib/money.ts` (`tiynToTenge`, `formatTenge`). Количество — строка до 3 знаков (`QUANTITY_PATTERN`), `> 0`.
- `filter[recent]` и `filter[in_stock]` шлются как `1` (правило `boolean` на сервере не принимает `true`).
- Ошибка переполнения количества в пачке приходит как 422 с ключом `quantity` и текстом в `message` — показывать тостом.
- Сохранение строки: `PUT …/items/{id}` через 600 мс после последнего ввода или сразу при `blur`; степпер — через 600 мс после последнего нажатия.
- Телефон 360–412 px: без горизонтальной прокрутки, элементы ≥ 44 px (`min-h-11`), поля 16 px до `md` (`inputClass` уже так делает). ПК ≥ 1024 px. Нижняя навигация до `lg` — `h-16` + safe-area; закреплённые снизу панели ставятся над ней, как `SaveBar`.
- Интерфейс — на русском, тексты — как в спеке.
- `admin/AGENTS.md`: у этой версии Next ломающие изменения — перед незнакомым API сверяться с `admin/node_modules/next/dist/docs/`. `useSearchParams` в клиентском компоненте, который рендерится из `layout`/страницы, — под `<Suspense>` (иначе падает `next build`).
- Проверка фронтенда — из `admin/`: `npx tsc --noEmit`, `npm run lint`, `npm run build`; e2e — `npx playwright test --project=Desktop <файл>` и `--project=Mobile <файл>`. Dev-сервер :3002 уже запущен из этого checkout; не останавливать. Перед тем как верить красному прогону — проверить память `e2e-browser-tests` (перезапуск next-server под нагрузкой, стёртая dev-база).
- e2e заводят свои данные: товар — выключенным, место хранения — неактивным (`e2e/warehouseApi.ts`), черновики удаляют в `afterEach`; метка — `uniqueStamp()`.
- Коммиты — без `Co-Authored-By` и без «Generated with Claude Code».
- Ветка `feat/warehouse-documents-ui` от локального `main` в основном checkout (e2e ходят в dev-сервер :3002 этого checkout).

### Решения плана, уточняющие спеку

- **После выбора товара в поле фокус остаётся в поле**, новая строка подсвечивается на 2 с. В спеке сказано и «фокус в „Кол-во“», и «поле остаётся в фокусе для следующего товара»; второе удобнее для ввода подряд (и для сканера в части 3). Количество правится степпером строки.
- **Меню «⋯» в «Остатках» — только «Принять товар» и «Списать»**; ссылки «Движения» и «Открыть товар» остаются в строке, как в этапе 2 (одно нажатие вместо двух; e2e этапа 2 на них опираются). «Списать» не показывается при остатке ≤ 0.
- **Строка документа в списке не кликабельна целиком** — ссылкой остаётся номер (как сейчас); `DataTable` не умеет ссылку на строку, а делать её ради одного списка не стоит.
- **Раскладка шапки раздела на телефоне** (кнопки во всю ширину, ⚙ в строке заголовка) — не в этом этапе: остаётся как есть, переносится в этап 4.
- **Поле даты в шапке сохраняется при `blur`**, а не при `change`: `datetime-local` шлёт `change` на каждую часть даты.
- **Шапка документа свёрнута и на ПК**, и на телефоне (строка «Склад · Поставщик · Дата ✎ Изменить»), раскрывается нажатием; при ошибке сохранения поля раскрыта сама.
- **`useResource` отдаёт приоритет `page` из `params`** над своим внутренним — так список документов берёт страницу из адреса. Другие вызовы `page` в `params` не передают, для них ничего не меняется.
- **Документ, который не удалось загрузить**, — «Не удалось загрузить документ» + «Повторить»; 404 — «Документ не найден» + «← К документам».

## Review Focus

1. **Правки подряд, пока идёт сохранение** — степпер и сразу цена в той же строке: после перезагрузки страницы значения совпадают с последним вводом (сохранения одного ключа идут по очереди, последний ввод приходит последним). Тест: Task 2 e2e «живая приёмка» (перезагрузка после степпера и цены).
2. **Промежуточный ввод** («1.», пустое поле, «0») — строка подсвечена ошибкой, ничего не отправлено, «Провести» недоступна с подсказкой; исправили — сохранилось. Тест: Task 2 e2e «неверное количество блокирует проведение».
3. **Уход со страницы с несохранённым** — клик по «← Документы», пока висит ошибка сохранения или ввод ещё не ушёл, спрашивает подтверждение. Тест: Task 2 e2e «неверное количество блокирует проведение» (вопрос `UNSAVED_QUESTION` при клике «Назад»).
4. **Товар, которого нет на складе, в списании** — не предлагается ни в поле, ни в «Подборе», а степпер «Подбора» не даёт выбрать больше остатка минус уже внесённое. Тест: Task 4 e2e «списание: подбор ограничен остатком».
5. **Закрытие «Подбора» с выбранными товарами** — спрашивает «Отменить подбор?»; отказ оставляет выбор. Тест: Task 3 e2e «Подбор: закрытие с выбором спрашивает».

---

## Карта файлов

| Файл | Что | Задача |
|---|---|---|
| `admin/src/lib/useAutosave.ts` | новый: очередь автосохранения, состояние индикатора | 1 |
| `admin/src/lib/useProductPicker.ts` | новый: список `product-picker` с задержкой поиска и догрузкой | 1 |
| `admin/src/lib/warehouse.ts` | `DraftKind`, `documentApiPath`, `draftHref`, `PickerProduct`, `DocumentItem`, `toLocalInput`, `localInputToIso`, `parseWriteOffReason`, `createDraft` | 1, 5, 6 |
| `admin/src/lib/crud.ts` | `page` из `params` важнее внутреннего | 6 |
| `admin/src/stores/toastStore.ts`, `admin/src/components/ui/Toaster.tsx` | тост с действием («Вернуть») | 1 |
| `admin/src/components/ui/Modal.tsx` | вариант `panel`: телефон — весь экран, ПК — панель справа | 1 |
| `admin/src/components/ui/ConfirmButton.tsx` | `disabled`, `title` | 1 |
| `admin/src/components/ui/LinkTabs.tsx` | вариант `segmented` | 6 |
| `admin/src/components/warehouse/document/QuantityStepper.tsx` | новый: «− N +» | 1 |
| `admin/src/components/warehouse/document/LoadMoreSentinel.tsx` | новый: догрузка при прокрутке | 1 |
| `admin/src/components/warehouse/document/useDocument.ts` | новый: данные и действия документа | 2 |
| `admin/src/components/warehouse/document/DocumentScreen.tsx` | новый: экран документа (черновик и проведённый) | 2, 3 |
| `admin/src/components/warehouse/document/DocumentHeader.tsx` | новый: заголовок, статус, индикатор | 2 |
| `admin/src/components/warehouse/document/DocumentFields.tsx` | новый: шапка документа на странице | 2 |
| `admin/src/components/warehouse/document/DocumentLines.tsx` | новый: строки (таблица / карточки) | 2 |
| `admin/src/components/warehouse/document/AddProductField.tsx` | новый: поле со списком без ввода | 2 |
| `admin/src/components/warehouse/document/pickerText.ts` | новый: подпись строки выбора | 2 |
| `admin/src/components/warehouse/document/DocumentFooter.tsx` | новый: итоги и «Провести» | 2 |
| `admin/src/components/warehouse/document/ProductPicker.tsx` | новый: «☰ Подбор» | 3 |
| `admin/src/app/warehouse/receipts/[id]/page.tsx` | → `<DocumentScreen kind="receipt" />` | 2 |
| `admin/src/app/warehouse/write-offs/[id]/page.tsx` | → `<DocumentScreen kind="write_off" />` | 4 |
| `admin/src/components/warehouse/useCreateDraft.ts` | новый | 5 |
| `admin/src/components/warehouse/CreateDocumentButton.tsx` | новый: кнопка + `HeaderCreateButtons` | 5 |
| `admin/src/components/warehouse/StockRowActions.tsx` | новый: «⋯» в строке остатков | 5 |
| `admin/src/app/warehouse/layout.tsx`, `admin/src/app/warehouse/page.tsx`, `admin/src/app/warehouse/stock/page.tsx` | кнопки создания, «⋯» | 5 |
| `admin/src/components/warehouse/{NewReceiptButton,NewWriteOffButton,GoodsReceiptForm,WriteOffForm}.tsx`, `QuantityForm.ts` | удаляются | 5 |
| `admin/src/app/warehouse/documents/page.tsx`, `admin/src/components/warehouse/{ReceiptsList,WriteOffsList}.tsx` | фильтры в адресе, чипы, пустые состояния | 6 |
| `admin/e2e/warehouseApi.ts` | `createReceiptDraft`, `createWriteOffDraft` | 2 |
| `admin/e2e/warehouse.spec.ts` | приёмка, «Подбор», списание, создание кнопкой | 2–5 |
| `admin/e2e/documents.spec.ts` | новый: вкладка «Документы» | 6 |
| `admin/e2e/stock.spec.ts`, `admin/e2e/warehouse-shell.spec.ts`, `admin/e2e/mobile/warehouse.spec.ts`, `admin/e2e/mobile/controls.spec.ts` | правки под «без модалок» | 2, 3, 5 |

---

### Task 0: Ветка и исходное состояние

- [ ] **Step 1: Ветка**

```bash
git switch main
git switch -c feat/warehouse-documents-ui
```

- [ ] **Step 2: Исходный прогон**

```bash
cd admin
npx tsc --noEmit
npx playwright test --project=Desktop e2e/warehouse.spec.ts e2e/warehouse-shell.spec.ts e2e/stock.spec.ts
npx playwright test --project=Mobile e2e/mobile/warehouse.spec.ts e2e/mobile/controls.spec.ts
```

Expected: `tsc` без ошибок; e2e зелёные, кроме известного `stock.spec.ts` «товар в наличии… 7 шт» (дрейф фикстур). Записать в журнал фактический список красных — дальше сравнивать с ним.

---

### Task 1: Основа — автосохранение, список выбора, тост с действием, панель, степпер

Задача без экрана: общие части, которые задачи 2–4 используют. Поведение существующих экранов не меняется (у `Modal`, `ConfirmButton`, тостов новые параметры необязательны).

**Files:**
- Create: `admin/src/lib/useAutosave.ts`, `admin/src/lib/useProductPicker.ts`, `admin/src/components/warehouse/document/QuantityStepper.tsx`, `admin/src/components/warehouse/document/LoadMoreSentinel.tsx`
- Modify: `admin/src/lib/warehouse.ts`, `admin/src/stores/toastStore.ts`, `admin/src/components/ui/Toaster.tsx`, `admin/src/components/ui/Modal.tsx`, `admin/src/components/ui/ConfirmButton.tsx`

**Interfaces:**
- Produces:
  - `useAutosave(delayMs?: number)` → `{ state: SaveState; errors: Record<string, string>; hasUnsaved: boolean; schedule(key: string, job: () => Promise<unknown>): void; flush(key: string): void; run(key: string, job: () => Promise<unknown>): Promise<boolean>; cancel(key: string): void; retry(): void }`; `SaveState = 'idle' | 'saving' | 'saved' | 'error'`; `saveErrorMessage(error: unknown): string`. Функции стабильны между рендерами.
  - `useProductPicker(query: PickerQuery)` → `{ items: PickerProduct[]; loading: boolean; hasMore: boolean; loadMore(): void; term: string }`; `PickerQuery = { storeId: number | null; search?: string; categoryId?: number | null; recent?: boolean; inStock?: boolean; enabled?: boolean }`.
  - `lib/warehouse.ts`: `DraftKind = 'receipt' | 'write_off'`; `documentApiPath(kind): string`; `draftHref(kind, id): string`; `kindOfDocuments(kind: DraftKind): DocumentKind`; `PickerProduct`; `DocumentItem`; `toLocalInput(value: string | null): string`; `localInputToIso(value: string): string | null`.
  - `toast.undo(message: string, action: { label: string; onClick: () => void }): void`.
  - `<Modal variant="panel">`; `<ConfirmButton disabled title>`.
  - `<QuantityStepper value label onChange onBlur? min? max? />`; `stepQuantity(value: string, delta: number, min?: number, max?: number): string`.
  - `<LoadMoreSentinel onVisible disabled />`.

- [ ] **Step 1: Типы и помощники в `lib/warehouse.ts`**

Дописать в конец `admin/src/lib/warehouse.ts`:

```ts
/** Вид документа в API и на карточке (во вкладке «Документы» — `DocumentKind`). */
export type DraftKind = 'receipt' | 'write_off';

export const documentApiPath = (kind: DraftKind): string => (kind === 'receipt' ? '/admin/goods-receipts' : '/admin/write-offs');

export const draftHref = (kind: DraftKind, id: number): string =>
  kind === 'receipt' ? warehouseHref.receipt(id) : warehouseHref.writeOff(id);

export const kindOfDocuments = (kind: DraftKind): DocumentKind => (kind === 'receipt' ? 'receipts' : 'write_offs');

/** Строка поля «+ Товар» и «Подбора» — `GET /admin/product-picker`. */
export type PickerProduct = {
  id: number;
  name: Translatable;
  code: string | null;
  article: string | null;
  uom: string | null;
  /** Остаток на складе документа. */
  on_hand: number;
  /** Себестоимость новой строки приёмки, тиыны. */
  suggested_unit_cost: number;
};

/** Строка документа из `GET …/items`: у приёмки есть `unit_cost`, у списания — `available`. */
export type DocumentItem = {
  id: number;
  product_id: number;
  quantity: string;
  unit_cost?: number;
  available?: number;
  product: ProductRef;
};

/** ISO → значение `<input type="datetime-local">` в часовом поясе браузера. */
export const toLocalInput = (value: string | null): string => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * Значение `datetime-local` («2026-09-17T14:30», без пояса) → ISO. Как
 * прежний `toReceiptPayload`: `new Date(...)` читает его в поясе браузера,
 * сервер хранит UTC — иначе алматинские 14:30 после перезагрузки стали бы 19:30.
 */
export const localInputToIso = (value: string): string | null => (value ? new Date(value).toISOString() : null);
```

- [ ] **Step 2: `useAutosave`**

`admin/src/lib/useAutosave.ts`:

```ts
'use client';

import { isAxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type Job = () => Promise<unknown>;

type LaravelError = { message?: string; errors?: Record<string, string[]> };

/** Текст под полем: первое сообщение 422, иначе общий. 5xx и сеть уже показал перехватчик api. */
export function saveErrorMessage(error: unknown): string {
  if (isAxiosError<LaravelError>(error) && error.response?.status === 422) {
    const data = error.response.data;
    const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
    return first ?? data?.message ?? 'Не сохранено';
  }

  return 'Не сохранено — проверьте сеть и нажмите «Повторить»';
}

const without = (errors: Record<string, string>, key: string): Record<string, string> => {
  if (!(key in errors)) {
    return errors;
  }
  const next = { ...errors };
  delete next[key];
  return next;
};

/**
 * Очередь автосохранения «живого документа».
 *
 * Каждое поле сохраняется под своим ключом (`line:12`, `header:note`).
 * `schedule` откладывает запрос на `delayMs` и заменяет ещё не отправленный
 * запрос того же ключа; `flush` отправляет отложенный сразу (blur); `run` —
 * сразу. Запросы одного ключа идут строго по очереди, так что последним на
 * сервер приходит последний ввод. Ошибка остаётся у ключа до удачного
 * сохранения или `cancel`; `retry` повторяет все упавшие.
 */
export function useAutosave(delayMs = 600) {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const waiting = useRef(new Map<string, Job>());
  const chains = useRef(new Map<string, Promise<void>>());
  const failed = useRef(new Map<string, Job>());
  const [waitingCount, setWaitingCount] = useState(0);
  const [inFlight, setInFlight] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedOnce, setSavedOnce] = useState(false);

  const run = useCallback((key: string, job: Job): Promise<boolean> => {
    setInFlight((n) => n + 1);
    let ok = false;
    const previous = chains.current.get(key) ?? Promise.resolve();
    const next = previous.then(async () => {
      try {
        await job();
        ok = true;
        failed.current.delete(key);
        setErrors((current) => without(current, key));
        setSavedOnce(true);
      } catch (error) {
        failed.current.set(key, job);
        setErrors((current) => ({ ...current, [key]: saveErrorMessage(error) }));
      } finally {
        setInFlight((n) => n - 1);
      }
    });
    chains.current.set(key, next);

    return next.then(() => ok);
  }, []);

  const flush = useCallback(
    (key: string) => {
      const timer = timers.current.get(key);
      if (timer) {
        clearTimeout(timer);
        timers.current.delete(key);
      }
      const job = waiting.current.get(key);
      waiting.current.delete(key);
      setWaitingCount(waiting.current.size);
      if (job) {
        void run(key, job);
      }
    },
    [run],
  );

  const schedule = useCallback(
    (key: string, job: Job) => {
      const timer = timers.current.get(key);
      if (timer) {
        clearTimeout(timer);
      }
      waiting.current.set(key, job);
      setWaitingCount(waiting.current.size);
      timers.current.set(key, setTimeout(() => flush(key), delayMs));
    },
    [delayMs, flush],
  );

  const cancel = useCallback((key: string) => {
    const timer = timers.current.get(key);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(key);
    }
    waiting.current.delete(key);
    failed.current.delete(key);
    setWaitingCount(waiting.current.size);
    setErrors((current) => without(current, key));
  }, []);

  const retry = useCallback(() => {
    for (const [key, job] of [...failed.current]) {
      void run(key, job);
    }
  }, [run]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const hasErrors = Object.keys(errors).length > 0;
  const state: SaveState = inFlight > 0 || waitingCount > 0 ? 'saving' : hasErrors ? 'error' : savedOnce ? 'saved' : 'idle';

  return { state, errors, hasUnsaved: inFlight > 0 || waitingCount > 0 || hasErrors, schedule, flush, run, cancel, retry };
}
```

- [ ] **Step 3: `useProductPicker`**

`admin/src/lib/useProductPicker.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import type { PickerProduct } from '@/lib/warehouse';

export type PickerQuery = {
  storeId: number | null;
  search?: string;
  categoryId?: number | null;
  recent?: boolean;
  inStock?: boolean;
  /** false — не запрашивать (список закрыт). */
  enabled?: boolean;
};

type PickerPage = { data: PickerProduct[]; current_page: number; last_page: number };

type Resolved = { storeId: number; term: string; categoryId: number | null; recent: boolean; inStock: boolean };

const paramsFor = (q: Resolved, page: number): Record<string, string | number> => {
  const params: Record<string, string | number> = { store_id: q.storeId, page };
  if (q.term) {
    params['filter[search]'] = q.term;
  }
  if (q.categoryId) {
    params['filter[category_id]'] = q.categoryId;
  }
  // Сервер проверяет правилом boolean: `true` строкой он отклоняет, `1` — нет.
  if (q.recent) {
    params['filter[recent]'] = 1;
  }
  if (q.inStock) {
    params['filter[in_stock]'] = 1;
  }
  return params;
};

/**
 * Товары для поля «+ Товар» и «Подбора»: поиск с задержкой 250 мс,
 * страницы по 30 с догрузкой `loadMore`. Ответ устаревшего запроса
 * отбрасывается. `term` — искомая строка, по которой уже пришёл ответ
 * (пока она отстаёт от ввода, идёт поиск).
 */
export function useProductPicker({ storeId, search = '', categoryId = null, recent = false, inStock = false, enabled = true }: PickerQuery) {
  const [term, setTerm] = useState(search.trim());
  const [items, setItems] = useState<PickerProduct[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [answeredTerm, setAnsweredTerm] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!enabled || storeId === null) {
      return;
    }
    const id = ++requestId.current;
    // Запрос к API — внешней системе; состояние загрузки ставится здесь же.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api
      .get<PickerPage>('/admin/product-picker', { params: paramsFor({ storeId, term, categoryId, recent, inStock }, 1) })
      .then((res) => {
        if (id === requestId.current) {
          setItems(res.data.data);
          setPage(res.data.current_page);
          setLastPage(res.data.last_page);
          setAnsweredTerm(term);
        }
      })
      .catch(() => {
        if (id === requestId.current) {
          setItems([]);
          setAnsweredTerm(term);
        }
      })
      .finally(() => {
        if (id === requestId.current) {
          setLoading(false);
        }
      });
  }, [enabled, storeId, term, categoryId, recent, inStock]);

  const loadMore = useCallback(() => {
    if (loading || page >= lastPage || storeId === null) {
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    api
      .get<PickerPage>('/admin/product-picker', { params: paramsFor({ storeId, term, categoryId, recent, inStock }, page + 1) })
      .then((res) => {
        if (id === requestId.current) {
          setItems((current) => [...current, ...res.data.data]);
          setPage(res.data.current_page);
          setLastPage(res.data.last_page);
        }
      })
      .finally(() => {
        if (id === requestId.current) {
          setLoading(false);
        }
      });
  }, [loading, page, lastPage, storeId, term, categoryId, recent, inStock]);

  return { items, loading, hasMore: page < lastPage, loadMore, term: answeredTerm ?? '' };
}
```

- [ ] **Step 4: Тост с действием**

`admin/src/stores/toastStore.ts` — заменить целиком:

```ts
import { create } from 'zustand';

export type ToastKind = 'success' | 'error';

/** Кнопка в тосте: «Вернуть» после удаления строки документа. */
export type ToastAction = { label: string; onClick: () => void };

export type Toast = { id: number; kind: ToastKind; message: string; action?: ToastAction };

type ToastState = {
  toasts: Toast[];
  push: (kind: ToastKind, message: string, action?: ToastAction) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, message, action) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, kind, message, action }] }));
    setTimeout(() => get().dismiss(id), 5000);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Callable from anywhere, including the axios interceptor (outside React). */
export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
  /** Сообщение с кнопкой отмены; живёт 5 с, как остальные. */
  undo: (message: string, action: ToastAction) => useToastStore.getState().push('success', message, action),
};
```

`admin/src/components/ui/Toaster.tsx` — заменить `{toasts.map(...)}` на:

```tsx
      {toasts.map((t) =>
        t.action ? (
          <div
            key={t.id}
            className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ${
              t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-white'
            }`}
          >
            <span className="min-w-0">{t.message}</span>
            <button
              type="button"
              className="inline-flex min-h-11 shrink-0 items-center font-semibold text-blue-300 hover:text-blue-200 md:min-h-0"
              onClick={() => {
                dismiss(t.id);
                t.action?.onClick();
              }}
            >
              {t.action.label}
            </button>
          </div>
        ) : (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={`rounded-lg px-4 py-3 text-left text-sm shadow-lg ${
              t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-white'
            }`}
          >
            {t.message}
          </button>
        ),
      )}
```

- [ ] **Step 5: `Modal` — вариант `panel`**

В `admin/src/components/ui/Modal.tsx`:

1. Тип пропсов: `type ModalProps = { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; variant?: 'sheet' | 'panel' };`, сигнатура — `export default function Modal({ title, onClose, children, footer, variant = 'sheet' }: ModalProps)`.
2. В PHPDoc дописать абзац: «`variant="panel"` — на телефоне на весь экран, с `md` — панель справа шириной 420 px во всю высоту; в заголовке кнопка ✕ (на весь экран не во что нажать мимо). Для „Подбора“ и поиска товара.»
3. Внутри `return createPortal(...)`: перед разметкой объявить `const panel = variant === 'panel';` и заменить классы/заголовок:

```tsx
  const panel = variant === 'panel';

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex bg-black/50 ${panel ? 'items-stretch justify-end' : 'items-end justify-center md:items-center md:p-4'}`}
      onMouseDown={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={
          panel
            ? 'flex h-dvh w-full flex-col bg-white shadow-xl outline-none md:max-w-[420px]'
            : 'flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl outline-none md:max-w-lg md:rounded-xl'
        }
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-5 pb-3 md:px-6 md:pt-6 md:pb-4">
          <h2 id={titleId} className="text-lg font-semibold text-zinc-900">
            {title}
          </h2>
          {panel && (
            <button
              type="button"
              aria-label="Закрыть"
              onClick={onClose}
              className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-xl text-zinc-400 hover:text-zinc-700"
            >
              ✕
            </button>
          )}
        </div>
```

(дальше — прежние блок содержимого и `footer` без изменений). Классы заголовка `h2` перенесены на обёртку — у существующих модалок внешний вид не меняется.

- [ ] **Step 6: `ConfirmButton` — `disabled`, `title`**

`admin/src/components/ui/ConfirmButton.tsx`: в `Props` добавить `disabled?: boolean; title?: string;`, в деструктуризацию — `disabled = false, title`, у `<button>`: `disabled={busy || disabled} title={title}`.

- [ ] **Step 7: Степпер и догрузка**

`admin/src/components/warehouse/document/QuantityStepper.tsx`:

```tsx
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
```

`admin/src/components/warehouse/document/LoadMoreSentinel.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';

/** Невидимая полоска в конце списка: доехали до неё прокруткой — `onVisible`. */
export default function LoadMoreSentinel({ onVisible, disabled }: { onVisible: () => void; disabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || disabled) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onVisible();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisible, disabled]);

  return <div ref={ref} className="h-6" aria-hidden="true" />;
}
```

- [ ] **Step 8: Проверка — типы, линтер, прежние модалки и тосты работают**

```bash
cd admin
npx tsc --noEmit
npm run lint
npx playwright test --project=Desktop e2e/warehouse-shell.spec.ts e2e/warehouse.spec.ts
npx playwright test --project=Mobile e2e/mobile/warehouse.spec.ts
```

Expected: `tsc` и `lint` без ошибок; e2e — как в Task 0 (модалки «Новая приёмка», тост «Удалено», фокус модалки — без изменений).

- [ ] **Step 9: Коммит**

```bash
git add admin/src/lib/useAutosave.ts admin/src/lib/useProductPicker.ts admin/src/lib/warehouse.ts admin/src/stores/toastStore.ts admin/src/components/ui/Toaster.tsx admin/src/components/ui/Modal.tsx admin/src/components/ui/ConfirmButton.tsx admin/src/components/warehouse/document/QuantityStepper.tsx admin/src/components/warehouse/document/LoadMoreSentinel.tsx
git commit -m "feat(admin): autosave queue, product picker hook, undo toast, panel modal"
```

---

### Task 2: «Живая» приёмка — строки на месте, поле со списком без ввода

**Files:**
- Create: `admin/src/components/warehouse/document/{useDocument.ts,DocumentScreen.tsx,DocumentHeader.tsx,DocumentFields.tsx,DocumentLines.tsx,AddProductField.tsx,pickerText.ts,DocumentFooter.tsx}`
- Modify: `admin/src/app/warehouse/receipts/[id]/page.tsx` (заменить целиком)
- Modify: `admin/e2e/warehouseApi.ts`, `admin/e2e/warehouse.spec.ts`
- Create/Modify: `admin/e2e/mobile/warehouse.spec.ts` (новый тест)

**Interfaces:**
- Consumes (Task 1): `useAutosave`, `useProductPicker`, `DraftKind`, `documentApiPath`, `kindOfDocuments`, `PickerProduct`, `DocumentItem`, `toLocalInput`, `localInputToIso`, `toast.undo`, `Modal variant="panel"`, `ConfirmButton disabled`, `QuantityStepper`, `LoadMoreSentinel`.
- Produces:
  - `useDocument(kind: DraftKind, id: string)` → `{ header: GoodsReceipt | WriteOff | null; rows: LineRow[]; loadError: 'not_found' | 'error' | null; reload(): Promise<void>; highlightId: number | null; saveState: SaveState; errors: Record<string, string>; retry(): void; editLine(id: number, patch: { quantity?: string; cost?: string }): void; flushLine(id: number): void; removeLine(id: number): Promise<void>; addProduct(productId: number): Promise<void>; addMany(items: { product_id: number; quantity: string }[]): Promise<boolean>; saveHeader(patch: Record<string, string | null>): void; post(): Promise<void>; removeDraft(): Promise<void>; totals: { count: number; units: number; cost: number | null }; blocker: string | null }`.
  - `LineRow = { id: number; productId: number; product: ProductRef; quantity: string; cost: string; unitCost: number | null; available: number | null; invalid: string | null }`; `lineKey(id: number): string`.
  - `<DocumentScreen kind />` — карточка документа целиком; Task 3 добавляет в неё «Подбор», Task 4 — страница списания.
  - e2e: `createReceiptDraft(request, storeId): Promise<number>`, `createWriteOffDraft(request, storeId): Promise<number>`.
  - Подписи для e2e: поле `Добавить товар` (ПК), кнопка `+ Добавить товар` (телефон), список `Товары`, строка `data-testid="document-line"`, поля `Количество: <товар>`, `Себестоимость: <товар>`, кнопки `Больше: <товар>`, `Меньше: <товар>`, `Удалить: <товар>`, шапка `data-testid="document-fields"` с кнопкой «Изменить», поля шапки `Склад`, `Поставщик`, `Дата приёмки`, `Номер накладной`, `Комментарий`, `Причина`; панель итогов `data-testid="document-footer"`; индикатор «Сохраняю…» / «✓ Сохранено» / «⚠ Не сохранено» + «Повторить».

- [ ] **Step 1: e2e-помощники**

В `admin/e2e/warehouseApi.ts` дописать:

```ts
/** Черновик приёмки на месте хранения теста — сразу через API, без экрана создания. */
export async function createReceiptDraft(request: APIRequestContext, storeId: number): Promise<number> {
  const receipt = await adminApi(request).create<Created>("/admin/goods-receipts", { store_id: storeId });
  return receipt.data.id;
}

export async function createWriteOffDraft(request: APIRequestContext, storeId: number): Promise<number> {
  const writeOff = await adminApi(request).create<Created>("/admin/write-offs", { store_id: storeId, reason: "damaged" });
  return writeOff.data.id;
}
```

- [ ] **Step 2: Падающие e2e (ПК)**

В `admin/e2e/warehouse.spec.ts`:
- импорт: `import { createProduct, createReceiptDraft, createStore, receive, uniqueStamp } from "./warehouseApi";`. e2e не импортируют `src`, поэтому вопрос ухода сравнивается строкой `"Уйти без сохранения? Изменения пропадут."` (как `UNSAVED_QUESTION`).
- в `test.beforeEach` оставить `page.on("dialog", (dialog) => dialog.accept())`; тест «неверное количество…» ставит свой обработчик сам (см. ниже).
- **заменить** тест «приёмка проводится, остаток растёт, движение видно в журнале» и функцию `addLine` на:

```ts
/** Строка документа по товару. */
function documentLine(page: Page, productName: string) {
  return page.getByTestId("document-line").filter({ hasText: productName });
}

async function addFromField(page: Page, query: string, productName: string) {
  const field = page.getByLabel("Добавить товар", { exact: true });
  await field.fill(query);
  await expect(page.getByRole("option").filter({ hasText: productName })).toHaveCount(1);
  await field.press("Enter");
  await expect(documentLine(page, productName)).toHaveCount(1);
}

test("живая приёмка: товар из поля, правки сохраняются сами, проведение", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const { productName, storeId, storeName } = await setupProductAndStore(request, stamp);
  const receiptId = await createReceiptDraft(request, storeId);
  drafts.push(`/admin/goods-receipts/${receiptId}`);

  await page.goto(`/warehouse/receipts/${receiptId}`);
  await expect(page.getByTestId("document-fields")).toContainText(storeName);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Список открывается по фокусу, без ввода.
  await page.getByLabel("Добавить товар", { exact: true }).click();
  await expect(page.getByRole("listbox", { name: "Товары" }).getByRole("option").first()).toBeVisible();

  // Поиск строчными находит товар с заглавной.
  await addFromField(page, productName.toLowerCase(), productName);

  const line = documentLine(page, productName);
  const quantity = line.getByLabel(`Количество: ${productName}`);
  const cost = line.getByLabel(`Себестоимость: ${productName}`);
  await expect(quantity).toHaveValue("1");
  await line.getByRole("button", { name: `Больше: ${productName}` }).click();
  await expect(quantity).toHaveValue("2");
  await cost.fill("1500");
  await cost.blur();
  await expect(page.getByText("✓ Сохранено")).toBeVisible();
  await expect(page.getByTestId("document-footer")).toContainText(/2 шт · Итого 3\s000 ₸/);

  // Номер накладной — из шапки на странице, без модалки.
  await page.getByTestId("document-fields").getByRole("button", { name: /Изменить/ }).click();
  await page.getByLabel("Номер накладной").fill(`E2E-${stamp}`);
  await page.getByLabel("Номер накладной").blur();
  await expect(page.getByText("✓ Сохранено")).toBeVisible();

  await page.reload();
  await expect(documentLine(page, productName).getByLabel(`Количество: ${productName}`)).toHaveValue("2");
  await expect(documentLine(page, productName).getByLabel(`Себестоимость: ${productName}`)).toHaveValue("1500");

  await page.getByRole("button", { name: "Провести" }).click();
  await expect(page.getByText(/^Проведена /)).toBeVisible();
  await expect(page.getByRole("button", { name: "Провести" })).toHaveCount(0);

  await page.goto("/warehouse/stock");
  await page.getByPlaceholder("Название, код или артикул").fill(productName);
  const stockRow = page.locator("tbody tr").filter({ hasText: productName });
  await expect(stockRow).toContainText("2");

  await stockRow.getByRole("link", { name: "Движения" }).click();
  const movement = page.locator("tbody tr").filter({ hasText: `Приёмка E2E-${stamp}` });
  await expect(movement).toContainText("Приход");
  await expect(movement).toContainText("+2");
});

test("недавно принятые видны в поле, повторный товар прибавляется, удаление отменяется", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const { productId, productName, storeId } = await setupProductAndStore(request, stamp);
  await receive(request, storeId, productId, 1);
  const receiptId = await createReceiptDraft(request, storeId);
  drafts.push(`/admin/goods-receipts/${receiptId}`);

  await page.goto(`/warehouse/receipts/${receiptId}`);
  await page.getByLabel("Добавить товар", { exact: true }).click();
  const list = page.getByRole("listbox", { name: "Товары" });
  await expect(list).toContainText("Недавно принимали");
  await list.getByRole("option").filter({ hasText: productName }).first().click();
  await expect(documentLine(page, productName).getByLabel(`Количество: ${productName}`)).toHaveValue("1");
  // Себестоимость подставилась из проведённой приёмки (1 000 ₸ в receive()).
  await expect(documentLine(page, productName).getByLabel(`Себестоимость: ${productName}`)).toHaveValue("1000");

  await addFromField(page, productName, productName);
  await expect(documentLine(page, productName)).toHaveCount(1);
  await expect(documentLine(page, productName).getByLabel(`Количество: ${productName}`)).toHaveValue("2");

  await documentLine(page, productName).getByRole("button", { name: `Удалить: ${productName}` }).click();
  await expect(documentLine(page, productName)).toHaveCount(0);
  await page.getByRole("button", { name: "Вернуть" }).click();
  await expect(documentLine(page, productName).getByLabel(`Количество: ${productName}`)).toHaveValue("2");
});

test("неверное количество блокирует проведение и уход без вопроса", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const { productName, storeId } = await setupProductAndStore(request, stamp);
  const receiptId = await createReceiptDraft(request, storeId);
  drafts.push(`/admin/goods-receipts/${receiptId}`);

  await page.goto(`/warehouse/receipts/${receiptId}`);
  await addFromField(page, productName, productName);
  const quantity = documentLine(page, productName).getByLabel(`Количество: ${productName}`);

  await quantity.fill("0");
  await expect(documentLine(page, productName)).toContainText("Количество больше нуля");
  await expect(page.getByRole("button", { name: "Провести" })).toBeDisabled();
  await expect(page.getByTestId("document-footer")).toContainText("Исправьте строки с ошибкой");

  // Уход со страницы спрашивает; отказ оставляет на месте.
  page.removeAllListeners("dialog");
  const questions: string[] = [];
  page.on("dialog", (dialog) => {
    questions.push(dialog.message());
    void dialog.dismiss();
  });
  await page.getByRole("link", { name: "Назад" }).click();
  expect(questions).toEqual(["Уйти без сохранения? Изменения пропадут."]);
  await expect(page).toHaveURL(new RegExp(`/warehouse/receipts/${receiptId}$`));

  await quantity.fill("3");
  await quantity.blur();
  await expect(page.getByText("✓ Сохранено")).toBeVisible();
  await expect(page.getByRole("button", { name: "Провести" })).toBeEnabled();
});
```

(`import type { Page } …` уже есть; `receive` импортирован.)

- [ ] **Step 3: Падающий e2e (телефон)**

В `admin/e2e/mobile/warehouse.spec.ts` импорт — `import { createProduct, createReceiptDraft, createStore, receive, uniqueStamp } from "../warehouseApi";`, и новый тест:

```ts
test("на телефоне товар добавляется из поиска на весь экран, степпер сохраняет", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const product = await createProduct(request, stamp);
  const store = await createStore(request, stamp);
  const receiptId = await createReceiptDraft(request, store.id);

  try {
    await page.goto(`/warehouse/receipts/${receiptId}`);
    await page.getByRole("button", { name: "+ Добавить товар" }).click();
    const dialog = page.getByRole("dialog", { name: "Добавить товар" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Поиск товара").fill(product.name);
    await dialog.getByRole("option").filter({ hasText: product.name }).click();
    await expect(dialog).toBeHidden();

    const card = page.getByTestId("document-line").filter({ hasText: product.name });
    await card.getByRole("button", { name: `Больше: ${product.name}` }).click();
    await expect(card.getByLabel(`Количество: ${product.name}`)).toHaveValue("2");
    await expect(page.getByText("✓ Сохранено")).toBeVisible();

    // Панель «Провести» — над нижней навигацией, а не под ней.
    const post = page.getByRole("button", { name: "Провести" });
    const box = (await post.boundingBox())!;
    const hit = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.textContent?.trim() ?? null,
      [box.x + box.width / 2, box.y + box.height / 2],
    );
    expect(hit).toBe("Провести");
  } finally {
    await adminApi(request).delete(`/admin/goods-receipts/${receiptId}`);
  }
});
```

- [ ] **Step 4: Запустить — падают**

```bash
cd admin
npx playwright test --project=Desktop e2e/warehouse.spec.ts -g "живая приёмка|недавно принятые|неверное количество"
npx playwright test --project=Mobile e2e/mobile/warehouse.spec.ts -g "на телефоне товар"
```

Expected: FAIL — нет поля «Добавить товар» / `data-testid="document-line"` (старая страница с модалками).

- [ ] **Step 5: `useDocument`**

`admin/src/components/warehouse/document/useDocument.ts`:

```ts
'use client';

import { isAxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { serverMessage } from '@/lib/errors';
import { TENGE_PATTERN, tiynToTenge } from '@/lib/money';
import { plural, ru, type ProductRef } from '@/lib/text';
import { useAutosave, type SaveState } from '@/lib/useAutosave';
import { useUnsavedGuard } from '@/lib/useUnsavedGuard';
import {
  documentApiPath,
  kindOfDocuments,
  lineCost,
  QUANTITY_PATTERN,
  warehouseHref,
  type DocumentItem,
  type DraftKind,
  type GoodsReceipt,
  type WriteOff,
} from '@/lib/warehouse';
import { toast } from '@/stores/toastStore';

export type DocumentHeaderData = GoodsReceipt | WriteOff;

/** Строка документа на экране: количество и цена — как введены, а не как сохранены. */
export type LineRow = {
  id: number;
  productId: number;
  product: ProductRef;
  /** «2», «1.5», «1.» — текст поля. */
  quantity: string;
  /** Себестоимость в ₸ текстом поля (только приёмка). */
  cost: string;
  /** Себестоимость с сервера, тиыны — для проведённой приёмки. */
  unitCost: number | null;
  /** Остаток на складе списания. */
  available: number | null;
  /** Ошибка ввода, найденная до отправки. */
  invalid: string | null;
};

export const lineKey = (id: number): string => `line:${id}`;

const QUANTITY_MESSAGE = 'Количество больше нуля, до 3 знаков после точки';
const COST_MESSAGE = 'Себестоимость в ₸, до двух знаков после точки';

const toRow = (item: DocumentItem): LineRow => ({
  id: item.id,
  productId: item.product_id,
  product: item.product,
  quantity: String(Number(item.quantity)),
  cost: tiynToTenge(item.unit_cost),
  unitCost: item.unit_cost ?? null,
  available: item.available ?? null,
  invalid: null,
});

/**
 * Строки с сервера поверх введённых: у уже известной строки остаётся её
 * ввод (он мог ещё не уйти), кроме строк из `fresh` — их значения только что
 * изменил сам сервер (повторный товар, пачка, возврат).
 */
const mergeRows = (items: DocumentItem[], previous: LineRow[], fresh: Set<number>): LineRow[] =>
  items.map((item) => {
    const known = previous.find((row) => row.id === item.id);
    return known && !fresh.has(item.id) ? { ...known, product: item.product, available: item.available ?? null } : toRow(item);
  });

const validate = (row: LineRow, kind: DraftKind): string | null => {
  if (!QUANTITY_PATTERN.test(row.quantity) || Number(row.quantity) <= 0) {
    return QUANTITY_MESSAGE;
  }
  if (kind === 'receipt' && !TENGE_PATTERN.test(row.cost)) {
    return COST_MESSAGE;
  }
  return null;
};

const toMilli = (quantity: string): number => (QUANTITY_PATTERN.test(quantity) ? Math.round(Number(quantity) * 1000) : 0);

const reportRefusal = (error: unknown): void => {
  const message = serverMessage(error);
  if (message) {
    toast.error(message);
  }
};

/**
 * Данные и действия «живого документа» (приёмки или списания): загрузка
 * шапки и строк, правки строк и шапки через очередь автосохранения,
 * добавление по одному и пачкой, удаление с «Вернуть», проведение.
 */
export function useDocument(kind: DraftKind, id: string) {
  const router = useRouter();
  const base = `${documentApiPath(kind)}/${id}`;
  const { state: saveState, errors, hasUnsaved, schedule, flush, run, cancel, retry } = useAutosave();
  const [header, setHeader] = useState<DocumentHeaderData | null>(null);
  const [rows, setRows] = useState<LineRow[]>([]);
  const rowsRef = useRef<LineRow[]>([]);
  const [loadError, setLoadError] = useState<'not_found' | 'error' | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  const commitRows = useCallback((next: LineRow[]) => {
    rowsRef.current = next;
    setRows(next);
  }, []);

  const load = useCallback(async () => {
    try {
      const [doc, items] = await Promise.all([
        api.get<{ data: DocumentHeaderData }>(base),
        api.get<{ data: DocumentItem[] }>(`${base}/items`),
      ]);
      setHeader(doc.data.data);
      commitRows(items.data.data.map(toRow));
      setLoadError(null);
    } catch (error) {
      setLoadError(isAxiosError(error) && error.response?.status === 404 ? 'not_found' : 'error');
    }
  }, [base, commitRows]);

  useEffect(() => {
    // Fetch-on-mount: load() synchronizes with the API, an external system.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const refreshLines = useCallback(
    async (fresh: Set<number> = new Set()) => {
      const res = await api.get<{ data: DocumentItem[] }>(`${base}/items`);
      commitRows(mergeRows(res.data.data, rowsRef.current, fresh));
    },
    [base, commitRows],
  );

  const flash = useCallback((lineId: number) => {
    setHighlightId(lineId);
    window.setTimeout(() => setHighlightId((current) => (current === lineId ? null : current)), 2000);
  }, []);

  const addProduct = useCallback(
    async (productId: number) => {
      try {
        const res = await api.post<{ data: DocumentItem }>(`${base}/items`, { product_id: productId });
        const lineId = res.data.data.id;
        cancel(lineKey(lineId));
        await refreshLines(new Set([lineId]));
        flash(lineId);
      } catch (error) {
        reportRefusal(error);
      }
    },
    [base, cancel, refreshLines, flash],
  );

  const addMany = useCallback(
    async (items: { product_id: number; quantity: string }[]): Promise<boolean> => {
      try {
        const res = await api.post<{ data: DocumentItem[] }>(`${base}/items/batch`, { items });
        const touched = new Set(items.map((item) => item.product_id));
        const fresh = new Set(res.data.data.filter((item) => touched.has(item.product_id)).map((item) => item.id));
        fresh.forEach((lineId) => cancel(lineKey(lineId)));
        commitRows(mergeRows(res.data.data, rowsRef.current, fresh));
        toast.success(`Добавлено ${items.length} ${plural(items.length, ['позиция', 'позиции', 'позиций'])}`);
        return true;
      } catch (error) {
        reportRefusal(error);
        return false;
      }
    },
    [base, cancel, commitRows],
  );

  const editLine = useCallback(
    (lineId: number, patch: { quantity?: string; cost?: string }) => {
      const current = rowsRef.current.find((row) => row.id === lineId);
      if (!current) {
        return;
      }
      const next: LineRow = { ...current, ...patch };
      next.invalid = validate(next, kind);
      commitRows(rowsRef.current.map((row) => (row.id === lineId ? next : row)));

      if (next.invalid) {
        cancel(lineKey(lineId));
        return;
      }

      const payload = kind === 'receipt' ? { quantity: next.quantity, unit_cost: next.cost } : { quantity: next.quantity };
      schedule(lineKey(lineId), () => api.put(`${base}/items/${lineId}`, payload));
    },
    [base, kind, cancel, schedule, commitRows],
  );

  const flushLine = useCallback((lineId: number) => flush(lineKey(lineId)), [flush]);

  const restoreLine = useCallback(
    async (row: LineRow) => {
      const quantity = row.invalid ? undefined : row.quantity;
      const payload =
        kind === 'receipt'
          ? { product_id: row.productId, quantity, unit_cost: row.invalid ? undefined : row.cost }
          : { product_id: row.productId, quantity };
      try {
        const res = await api.post<{ data: DocumentItem }>(`${base}/items`, payload);
        await refreshLines(new Set([res.data.data.id]));
        flash(res.data.data.id);
      } catch (error) {
        reportRefusal(error);
      }
    },
    [base, kind, refreshLines, flash],
  );

  const removeLine = useCallback(
    async (lineId: number) => {
      const row = rowsRef.current.find((r) => r.id === lineId);
      if (!row) {
        return;
      }
      cancel(lineKey(lineId));
      commitRows(rowsRef.current.filter((r) => r.id !== lineId));
      try {
        await api.delete(`${base}/items/${lineId}`);
        toast.undo(`Позиция удалена: ${ru(row.product.name) || `#${row.productId}`}`, {
          label: 'Вернуть',
          onClick: () => void restoreLine(row),
        });
      } catch (error) {
        await refreshLines();
        reportRefusal(error);
      }
    },
    [base, cancel, commitRows, refreshLines, restoreLine],
  );

  const saveHeader = useCallback(
    (patch: Record<string, string | null>) => {
      const field = Object.keys(patch)[0];
      void run(`header:${field}`, async () => {
        const res = await api.put<{ data: DocumentHeaderData }>(base, patch);
        setHeader(res.data.data);
        // У списания «На складе» считается по складу документа.
        if ('store_id' in patch) {
          await refreshLines();
        }
      });
    },
    [base, run, refreshLines],
  );

  const post = useCallback(async () => {
    try {
      const res = await api.post<{ data: DocumentHeaderData }>(`${base}/post`);
      setHeader(res.data.data);
      await refreshLines(new Set(rowsRef.current.map((row) => row.id)));
      toast.success(kind === 'receipt' ? 'Приёмка проведена' : 'Списание проведено');
    } catch (error) {
      reportRefusal(error);
      await load();
    }
  }, [base, kind, refreshLines, load]);

  const removeDraft = useCallback(async () => {
    await api.delete(base);
    toast.success('Черновик удалён');
    router.push(warehouseHref.documents(kindOfDocuments(kind)));
  }, [base, kind, router]);

  const units = rows.reduce((sum, row) => sum + toMilli(row.quantity), 0) / 1000;
  const cost =
    kind === 'receipt'
      ? rows.reduce((sum, row) => sum + (row.invalid ? 0 : lineCost(row.quantity, Math.round(Number(row.cost) * 100))), 0)
      : null;
  const overStock = kind === 'write_off' && rows.some((row) => row.available !== null && Number(row.quantity) > row.available);
  const hasInvalid = rows.some((row) => row.invalid !== null);

  const blocker =
    rows.length === 0
      ? 'Добавьте хотя бы один товар'
      : hasInvalid
        ? 'Исправьте строки с ошибкой'
        : saveState === 'error'
          ? 'Есть несохранённые изменения — нажмите «Повторить»'
          : hasUnsaved
            ? 'Сохраняю изменения…'
            : overStock
              ? 'В строке больше, чем на складе'
              : null;

  useUnsavedGuard(hasUnsaved || hasInvalid);

  return {
    header,
    rows,
    loadError,
    reload: load,
    highlightId,
    saveState: saveState as SaveState,
    errors,
    retry,
    editLine,
    flushLine,
    removeLine,
    addProduct,
    addMany,
    saveHeader,
    post,
    removeDraft,
    totals: { count: rows.length, units, cost },
    blocker,
  };
}
```

- [ ] **Step 6: Подпись строки выбора и поле «+ Товар»**

`admin/src/components/warehouse/document/pickerText.ts`:

```ts
import { formatTenge } from '@/lib/money';
import { formatQty, type DraftKind, type PickerProduct } from '@/lib/warehouse';

/** «ART-1 · ост. 3 · 1 500 ₸» — у списания без цены. */
export const pickerMeta = (product: PickerProduct, kind: DraftKind): string =>
  [
    product.article || product.code,
    `ост. ${formatQty(product.on_hand)}`,
    kind === 'receipt' ? formatTenge(product.suggested_unit_cost) : null,
  ]
    .filter(Boolean)
    .join(' · ');
```

`admin/src/components/warehouse/document/AddProductField.tsx`:

```tsx
'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { ru } from '@/lib/text';
import { useIsDesktop } from '@/lib/useIsDesktop';
import { useProductPicker } from '@/lib/useProductPicker';
import type { DraftKind, PickerProduct } from '@/lib/warehouse';
import Modal from '@/components/ui/Modal';
import { buttonGhost, buttonLink, inputClass } from '@/components/ui/styles';
import LoadMoreSentinel from './LoadMoreSentinel';
import { pickerMeta } from './pickerText';

type Props = { kind: DraftKind; storeId: number; onPick: (product: PickerProduct) => Promise<void> };

const RECENT_LIMIT = 8;

/**
 * «+ Товар»: список открывается сразу по фокусу — «Недавно принимали» и
 * «Весь каталог», ввод фильтрует. ↑/↓ — выбор, Enter — добавить, Esc —
 * закрыть. После добавления поле чистится и остаётся в фокусе. На телефоне —
 * кнопка, открывающая тот же поиск на весь экран.
 */
export default function AddProductField({ kind, storeId, onPick }: Props) {
  const isDesktop = useIsDesktop();
  const [panelOpen, setPanelOpen] = useState(false);

  if (isDesktop) {
    return <ProductSearch kind={kind} storeId={storeId} onPick={onPick} layout="popover" />;
  }

  return (
    <>
      <button type="button" className={`${buttonGhost} w-full`} onClick={() => setPanelOpen(true)}>
        + Добавить товар
      </button>
      {panelOpen && (
        <Modal title="Добавить товар" variant="panel" onClose={() => setPanelOpen(false)}>
          <ProductSearch kind={kind} storeId={storeId} onPick={onPick} layout="panel" onDone={() => setPanelOpen(false)} />
        </Modal>
      )}
    </>
  );
}

type SearchProps = Props & { layout: 'popover' | 'panel'; onDone?: () => void };

function ProductSearch({ kind, storeId, onPick, layout, onDone }: SearchProps) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(layout === 'panel');
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const inStock = kind === 'write_off';
  const searching = query.trim() !== '';

  const recent = useProductPicker({ storeId, recent: true, inStock, enabled: open && !searching });
  const all = useProductPicker({ storeId, search: query, inStock, enabled: open });
  const recentItems = searching ? [] : recent.items.slice(0, RECENT_LIMIT);
  const options = [...recentItems, ...all.items];
  const settled = all.term === query.trim() && !all.loading;

  const pick = async (product: PickerProduct) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await onPick(product);
      setQuery('');
      setActive(0);
      onDone?.();
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      const product = options[active];
      if (product && settled) {
        e.preventDefault();
        void pick(product);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      onDone?.();
    }
  };

  const option = (product: PickerProduct, index: number, section: string) => (
    <li
      key={`${section}-${product.id}`}
      role="option"
      aria-selected={index === active}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => setActive(index)}
      onClick={() => void pick(product)}
      className={`min-h-11 cursor-pointer px-3 py-2 ${index === active ? 'bg-blue-50' : ''}`}
    >
      <div className="text-sm font-medium text-zinc-900">{ru(product.name) || `#${product.id}`}</div>
      <div className="text-xs text-zinc-500">{pickerMeta(product, kind)}</div>
    </li>
  );

  const list = open && (
    <ul
      id={listId}
      role="listbox"
      aria-label="Товары"
      className={
        layout === 'popover'
          ? 'absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg'
          : 'mt-3 -mx-4 md:-mx-6'
      }
    >
      {recentItems.length > 0 && (
        <li role="presentation" className="px-3 pt-2 pb-1 text-xs font-medium uppercase text-zinc-400">
          Недавно принимали
        </li>
      )}
      {recentItems.map((product, i) => option(product, i, 'recent'))}
      {!searching && (
        <li role="presentation" className="px-3 pt-2 pb-1 text-xs font-medium uppercase text-zinc-400">
          Весь каталог
        </li>
      )}
      {all.items.map((product, i) => option(product, recentItems.length + i, 'all'))}
      {all.hasMore && (
        <li role="presentation">
          <LoadMoreSentinel onVisible={all.loadMore} disabled={all.loading} />
        </li>
      )}
      {all.loading && (
        <li role="presentation" className="px-3 py-2 text-sm text-zinc-400">
          Загрузка…
        </li>
      )}
      {searching && settled && all.items.length === 0 && (
        <li role="presentation" className="px-3 py-3 text-sm text-zinc-600">
          Ничего не найдено по «{query.trim()}».{' '}
          <a href="/products/create" target="_blank" rel="noopener" className={buttonLink}>
            Создать товар
          </a>
        </li>
      )}
    </ul>
  );

  return (
    <div className={layout === 'popover' ? 'relative flex-1' : ''}>
      <input
        type="search"
        role="combobox"
        aria-expanded={Boolean(open)}
        aria-controls={listId}
        aria-label={layout === 'popover' ? 'Добавить товар' : 'Поиск товара'}
        placeholder="+ Товар: название, код…"
        autoFocus={layout === 'panel'}
        className={inputClass}
        value={query}
        aria-busy={busy}
        onFocus={() => setOpen(true)}
        onBlur={() => layout === 'popover' && setOpen(false)}
        onChange={(e) => {
          // Пока товар добавляется, ввод не принимается, но поле не
          // выключается — `disabled` снял бы с него фокус.
          if (busy) {
            return;
          }
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {list}
    </div>
  );
}
```


- [ ] **Step 7: Шапка, поля шапки, строки, итоги**

`admin/src/components/warehouse/document/DocumentHeader.tsx`:

```tsx
import type { SaveState } from '@/lib/useAutosave';
import { kindOfDocuments, warehouseHref, type DocumentStatus, type DraftKind } from '@/lib/warehouse';
import PageHeader from '@/components/ui/PageHeader';
import DocumentStatusBadge from '../DocumentStatusBadge';

type Props = { kind: DraftKind; title: string; status: DocumentStatus; saveState: SaveState; onRetry: () => void };

/** «← Документы», заголовок, статус и — у черновика — индикатор сохранения. */
export default function DocumentHeader({ kind, title, status, saveState, onRetry }: Props) {
  return (
    <PageHeader
      title={title}
      back={warehouseHref.documents(kindOfDocuments(kind))}
      actions={
        <div className="flex items-center gap-3">
          <DocumentStatusBadge status={status} postedLabel={kind === 'receipt' ? 'Проведена' : 'Проведено'} />
          {status === 'draft' && (
            <p role="status" aria-live="polite" className="text-sm">
              {saveState === 'saving' && <span className="text-zinc-500">Сохраняю…</span>}
              {saveState === 'saved' && <span className="text-green-700">✓ Сохранено</span>}
              {saveState === 'error' && (
                <span className="text-red-600">
                  ⚠ Не сохранено{' '}
                  <button type="button" className="font-medium underline" onClick={onRetry}>
                    Повторить
                  </button>
                </span>
              )}
            </p>
          )}
        </div>
      }
    />
  );
}
```

`admin/src/components/warehouse/document/DocumentFields.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useResource } from '@/lib/crud';
import {
  formatDateTime,
  localInputToIso,
  toLocalInput,
  WRITE_OFF_REASONS,
  type DraftKind,
  type GoodsReceipt,
  type Supplier,
  type WriteOff,
} from '@/lib/warehouse';
import Field from '@/components/ui/Field';
import { cardClass, inputClass } from '@/components/ui/styles';
import StoreSelect from '../StoreSelect';

type Props = {
  kind: DraftKind;
  header: GoodsReceipt | WriteOff;
  /** Ошибки автосохранения, ключи `header:<поле>`. */
  errors: Record<string, string>;
  onSave: (patch: Record<string, string | null>) => void;
};

type Values = Record<string, string>;

const valuesOf = (kind: DraftKind, header: GoodsReceipt | WriteOff): Values => {
  if (kind === 'receipt') {
    const receipt = header as GoodsReceipt;
    return {
      store_id: String(receipt.store_id),
      supplier_id: receipt.supplier_id ? String(receipt.supplier_id) : '',
      received_at: toLocalInput(receipt.received_at),
      number: receipt.number ?? '',
      note: receipt.note ?? '',
    };
  }
  const writeOff = header as WriteOff;
  return { store_id: String(writeOff.store_id), reason: writeOff.reason, note: writeOff.note ?? '' };
};

/**
 * Шапка документа на странице. Свёрнута в строку «Склад · Поставщик · Дата
 * ✎ Изменить»; раскрыта — поля в 4 колонки на ПК, в одну на телефоне.
 * Выбор сохраняется сразу, текст и дата — при уходе с поля. Поле с ошибкой
 * держит шапку раскрытой.
 */
export default function DocumentFields({ kind, header, errors, onSave }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<Values>(() => valuesOf(kind, header));
  const suppliers = useResource<Supplier>(kind === 'receipt' ? '/admin/suppliers' : null);
  const errorOf = (field: string): string | undefined => errors[`header:${field}`];
  const hasError = Object.keys(errors).some((key) => key.startsWith('header:'));
  const open = expanded || hasError;

  const set = (field: string, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const choose = (field: string, value: string) => {
    set(field, value);
    onSave({ [field]: value === '' ? null : value });
  };
  const commit = (field: string, value: string | null) => {
    const saved = valuesOf(kind, header)[field];
    if ((values[field] ?? '') !== saved) {
      onSave({ [field]: value });
    }
  };

  const summary =
    kind === 'receipt'
      ? [header.store.name, (header as GoodsReceipt).supplier?.name ?? 'Без поставщика', formatDateTime((header as GoodsReceipt).received_at)]
      : [header.store.name, WRITE_OFF_REASONS[(header as WriteOff).reason] ?? (header as WriteOff).reason];

  return (
    <section data-testid="document-fields" className={`${cardClass} p-4`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm text-zinc-700"
      >
        <span className="min-w-0 truncate">{summary.join(' · ')}</span>
        <span className="shrink-0 font-medium text-blue-600">✎ Изменить</span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="Склад" htmlFor="doc-store" error={errorOf('store_id')}>
            <StoreSelect id="doc-store" value={values.store_id} onChange={(e) => choose('store_id', e.target.value)} />
          </Field>

          {kind === 'receipt' ? (
            <>
              <Field label="Поставщик" htmlFor="doc-supplier" error={errorOf('supplier_id')}>
                <select id="doc-supplier" className={inputClass} value={values.supplier_id} onChange={(e) => choose('supplier_id', e.target.value)}>
                  <option value="">Без поставщика</option>
                  {suppliers.items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Дата приёмки" htmlFor="doc-date" error={errorOf('received_at')}>
                <input
                  id="doc-date"
                  type="datetime-local"
                  className={inputClass}
                  value={values.received_at}
                  onChange={(e) => set('received_at', e.target.value)}
                  onBlur={(e) => commit('received_at', localInputToIso(e.target.value))}
                />
              </Field>
              <Field label="Номер накладной" htmlFor="doc-number" error={errorOf('number')}>
                <input
                  id="doc-number"
                  className={inputClass}
                  value={values.number}
                  onChange={(e) => set('number', e.target.value)}
                  onBlur={(e) => commit('number', e.target.value.trim() === '' ? null : e.target.value.trim())}
                />
              </Field>
            </>
          ) : (
            <Field label="Причина" htmlFor="doc-reason" error={errorOf('reason')}>
              <select id="doc-reason" className={inputClass} value={values.reason} onChange={(e) => choose('reason', e.target.value)}>
                {Object.entries(WRITE_OFF_REASONS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="md:col-span-4">
            <Field label="Комментарий" htmlFor="doc-note" error={errorOf('note')}>
              <textarea
                id="doc-note"
                rows={2}
                className={inputClass}
                value={values.note}
                onChange={(e) => set('note', e.target.value)}
                onBlur={(e) => commit('note', e.target.value.trim() === '' ? null : e.target.value)}
              />
            </Field>
          </div>
        </div>
      )}
    </section>
  );
}
```

`admin/src/components/warehouse/document/DocumentLines.tsx`:

```tsx
'use client';

import { formatTenge } from '@/lib/money';
import { ru } from '@/lib/text';
import { useIsDesktop } from '@/lib/useIsDesktop';
import { formatQty, lineCost, type DraftKind } from '@/lib/warehouse';
import EmptyState from '@/components/ui/EmptyState';
import MoneyInput from '@/components/ui/MoneyInput';
import { cardClass } from '@/components/ui/styles';
import QuantityStepper from './QuantityStepper';
import { lineKey, type LineRow } from './useDocument';

type Props = {
  kind: DraftKind;
  rows: LineRow[];
  highlightId: number | null;
  errors: Record<string, string>;
  onEdit: (id: number, patch: { quantity?: string; cost?: string }) => void;
  onFlush: (id: number) => void;
  onRemove: (id: number) => void;
};

const nameOf = (row: LineRow): string => ru(row.product.name) || `#${row.productId}`;

const sumOf = (row: LineRow): string =>
  row.invalid ? '—' : formatTenge(lineCost(row.quantity, Math.round(Number(row.cost) * 100)));

/** Текст под строкой: ошибка сервера, ввода или «больше, чем на складе». */
const problemOf = (row: LineRow, errors: Record<string, string>, kind: DraftKind): string | null =>
  errors[lineKey(row.id)] ??
  row.invalid ??
  (kind === 'write_off' && row.available !== null && Number(row.quantity) > row.available ? 'Больше, чем на складе' : null);

/** Позиции черновика: таблица с полями на ПК, карточки со степпером на телефоне. */
export default function DocumentLines({ kind, rows, highlightId, errors, onEdit, onFlush, onRemove }: Props) {
  const isDesktop = useIsDesktop();

  if (rows.length === 0) {
    return <EmptyState title="Добавьте товары" hint="Найдите товар в поле ниже или откройте «Подбор»." />;
  }

  const removeButton = (row: LineRow) => (
    <button
      type="button"
      aria-label={`Удалить: ${nameOf(row)}`}
      onClick={() => onRemove(row.id)}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-red-600 md:h-9 md:w-9"
    >
      ✕
    </button>
  );

  const quantity = (row: LineRow) => (
    <QuantityStepper
      value={row.quantity}
      label={nameOf(row)}
      onChange={(value) => onEdit(row.id, { quantity: value })}
      onBlur={() => onFlush(row.id)}
    />
  );

  const cost = (row: LineRow) => (
    <MoneyInput
      aria-label={`Себестоимость: ${nameOf(row)}`}
      value={row.cost}
      onChange={(e) => onEdit(row.id, { cost: e.target.value })}
      onBlur={() => onFlush(row.id)}
      className="w-32"
    />
  );

  const problem = (row: LineRow) => {
    const text = problemOf(row, errors, kind);
    return text ? (
      <p role="alert" className="mt-1 text-xs text-red-600">
        {text}
      </p>
    ) : null;
  };

  if (!isDesktop) {
    return (
      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            data-testid="document-line"
            className={`${cardClass} p-4 transition-colors ${row.id === highlightId ? 'ring-2 ring-blue-400' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-zinc-900">{nameOf(row)}</div>
                <div className="text-xs text-zinc-500">{row.product.article || row.product.code || '—'}</div>
              </div>
              {removeButton(row)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {quantity(row)}
              {kind === 'receipt' ? cost(row) : <span className="text-sm text-zinc-600">На складе: {formatQty(row.available ?? 0)}</span>}
            </div>
            {kind === 'receipt' && <div className="mt-2 text-sm text-zinc-700">Сумма: {sumOf(row)}</div>}
            {problem(row)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={`${cardClass} overflow-hidden`}>
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-2 font-medium">Товар</th>
            <th className="px-4 py-2 font-medium">Кол-во</th>
            {kind === 'receipt' ? (
              <>
                <th className="px-4 py-2 font-medium">Себест., ₸</th>
                <th className="px-4 py-2 text-right font-medium">Сумма</th>
              </>
            ) : (
              <th className="px-4 py-2 text-right font-medium">На складе</th>
            )}
            <th className="w-12" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row) => (
            <tr key={row.id} data-testid="document-line" className={`transition-colors ${row.id === highlightId ? 'bg-blue-50' : ''}`}>
              <td className="px-4 py-2 align-top">
                <div className="font-medium text-zinc-900">{nameOf(row)}</div>
                <div className="text-xs text-zinc-500">{row.product.article || row.product.code || '—'}</div>
                {problem(row)}
              </td>
              <td className="px-4 py-2 align-top">{quantity(row)}</td>
              {kind === 'receipt' ? (
                <>
                  <td className="px-4 py-2 align-top">{cost(row)}</td>
                  <td className="px-4 py-2 text-right align-top font-medium">{sumOf(row)}</td>
                </>
              ) : (
                <td className="px-4 py-2 text-right align-top">{formatQty(row.available ?? 0)}</td>
              )}
              <td className="px-2 py-1 text-right align-top">{removeButton(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`admin/src/components/warehouse/document/DocumentFooter.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { formatTenge } from '@/lib/money';
import { plural } from '@/lib/text';
import { formatQty, type DraftKind } from '@/lib/warehouse';
import ConfirmButton from '@/components/ui/ConfirmButton';
import { buttonGhost, buttonPrimary } from '@/components/ui/styles';

type Props = {
  kind: DraftKind;
  totals: { count: number; units: number; cost: number | null };
  /** Почему нельзя провести; null — можно. */
  blocker: string | null;
  onPost: () => Promise<void>;
  onDelete: () => Promise<void>;
};

const POST_QUESTION: Record<DraftKind, string> = {
  receipt: 'Провести приёмку? Будут созданы партии и движения по складу. Необратимо.',
  write_off: 'Провести списание? Товар уйдёт со склада по FIFO. Необратимо.',
};

/**
 * Итоги и действия черновика. Как SaveBar: до `lg` — над нижней навигацией,
 * с `lg` — прилипает к низу области прокрутки; `--save-bar-h` поднимает тосты.
 */
export default function DocumentFooter({ kind, totals, blocker, onPost, onDelete }: Props) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--save-bar-h', '6rem');
    return () => {
      root.style.removeProperty('--save-bar-h');
    };
  }, []);

  const summary = [
    `${totals.count} ${plural(totals.count, ['позиция', 'позиции', 'позиций'])}`,
    `${formatQty(totals.units)} шт`,
    totals.cost !== null ? `Итого ${formatTenge(totals.cost)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      data-testid="document-footer"
      className="fixed inset-x-0 bottom-[calc(4rem_+_env(safe-area-inset-bottom))] z-30 border-t border-zinc-200 bg-white py-2 pl-[calc(1rem_+_env(safe-area-inset-left))] pr-[calc(1rem_+_env(safe-area-inset-right))] shadow-[0_-2px_8px_rgba(0,0,0,0.06)] lg:sticky lg:bottom-0 lg:mt-6 lg:rounded-xl lg:border lg:px-5 lg:py-3"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900">{summary}</p>
          {blocker && <p className="text-xs text-amber-700">{blocker}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <ConfirmButton className={buttonGhost} question={`Удалить черновик ${kind === 'receipt' ? 'приёмки' : 'списания'}?`} onConfirm={onDelete}>
            Удалить черновик
          </ConfirmButton>
          <ConfirmButton className={buttonPrimary} question={POST_QUESTION[kind]} disabled={blocker !== null} title={blocker ?? undefined} onConfirm={onPost}>
            Провести
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Экран документа и страница приёмки**

`admin/src/components/warehouse/document/DocumentScreen.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatTenge } from '@/lib/money';
import { productLabel } from '@/lib/text';
import {
  formatDateTime,
  formatQty,
  kindOfDocuments,
  lineCost,
  warehouseHref,
  type DraftKind,
  type GoodsReceipt,
  type WriteOff,
} from '@/lib/warehouse';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Skeleton from '@/components/ui/Skeleton';
import { buttonGhost, buttonLink } from '@/components/ui/styles';
import AddProductField from './AddProductField';
import DocumentFields from './DocumentFields';
import DocumentFooter from './DocumentFooter';
import DocumentHeader from './DocumentHeader';
import DocumentLines from './DocumentLines';
import { useDocument, type LineRow } from './useDocument';

/** Карточка приёмки или списания: черновик правится на месте, проведённый — только читается. */
export default function DocumentScreen({ kind }: { kind: DraftKind }) {
  const { id } = useParams<{ id: string }>();
  const doc = useDocument(kind, id);

  if (doc.loadError === 'not_found') {
    return (
      <div className="space-y-3">
        <p className="text-zinc-700">Документ не найден.</p>
        <Link href={warehouseHref.documents(kindOfDocuments(kind))} className={buttonLink}>
          ← К документам
        </Link>
      </div>
    );
  }

  if (doc.loadError === 'error') {
    return (
      <div className="space-y-3">
        <p className="text-zinc-700">Не удалось загрузить документ.</p>
        <button type="button" className={buttonGhost} onClick={() => void doc.reload()}>
          Повторить
        </button>
      </div>
    );
  }

  if (!doc.header) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const header = doc.header;
  const isDraft = header.status === 'draft';
  const title = kind === 'receipt' ? `Приёмка ${(header as GoodsReceipt).number || `№${header.id}`}` : (header as WriteOff).label;

  return (
    <div className={isDraft ? 'space-y-4 pb-40 lg:pb-0' : 'space-y-4'}>
      <DocumentHeader kind={kind} title={title} status={header.status} saveState={doc.saveState} onRetry={doc.retry} />

      {isDraft ? (
        <>
          <DocumentFields key={header.id} kind={kind} header={header} errors={doc.errors} onSave={doc.saveHeader} />
          <DocumentLines
            kind={kind}
            rows={doc.rows}
            highlightId={doc.highlightId}
            errors={doc.errors}
            onEdit={doc.editLine}
            onFlush={doc.flushLine}
            onRemove={(lineId) => void doc.removeLine(lineId)}
          />
          <div className="flex flex-col gap-2 md:flex-row">
            <AddProductField kind={kind} storeId={header.store_id} onPick={(product) => doc.addProduct(product.id)} />
          </div>
          <DocumentFooter kind={kind} totals={doc.totals} blocker={doc.blocker} onPost={doc.post} onDelete={doc.removeDraft} />
        </>
      ) : (
        <PostedDocument kind={kind} header={header} rows={doc.rows} />
      )}
    </div>
  );
}

function PostedDocument({ kind, header, rows }: { kind: DraftKind; header: GoodsReceipt | WriteOff; rows: LineRow[] }) {
  const columns: Column<LineRow>[] = [
    { key: 'product', header: 'Товар', mobile: 'title', render: (row) => productLabel(row.product) },
    { key: 'qty', header: 'Количество', className: 'text-right', mobile: 'badge', render: (row) => formatQty(row.quantity) },
    ...(kind === 'receipt'
      ? [
          { key: 'cost', header: 'Себестоимость', className: 'text-right', mobile: 'meta' as const, render: (row: LineRow) => formatTenge(row.unitCost) },
          {
            key: 'sum',
            header: 'Сумма',
            className: 'text-right',
            mobile: 'meta' as const,
            render: (row: LineRow) => formatTenge(lineCost(row.quantity, row.unitCost ?? 0)),
          },
        ]
      : []),
  ];
  const writeOffCost = kind === 'write_off' ? (header as WriteOff).total_cost : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        <span>
          {kind === 'receipt' ? 'Проведена' : 'Проведено'} {formatDateTime(header.posted_at)}
          {header.user ? `, ${header.user.name}` : ''}
          {writeOffCost !== null ? ` · Себестоимость: ${formatTenge(writeOffCost)}` : ''}
        </span>
        <Link href={`${warehouseHref.movements}?document=${kind}:${header.id}`} className={buttonLink}>
          Движения по документу →
        </Link>
      </div>
      <DataTable columns={columns} rows={rows} emptyText="Позиций нет" />
    </>
  );
}
```

`admin/src/app/warehouse/receipts/[id]/page.tsx` — заменить целиком:

```tsx
'use client';

import DocumentScreen from '@/components/warehouse/document/DocumentScreen';

export default function GoodsReceiptPage() {
  return <DocumentScreen kind="receipt" />;
}
```

- [ ] **Step 9: Проверка**

```bash
cd admin
npx tsc --noEmit
npm run lint
npx playwright test --project=Desktop e2e/warehouse.spec.ts
npx playwright test --project=Mobile e2e/mobile/warehouse.spec.ts
```

Expected: `tsc`, `lint` чистые; три новых теста Desktop и новый Mobile — PASS; тест списания в `warehouse.spec.ts` (старая страница списания) и «склад с историей» — PASS. Если красный «живая приёмка» на `✓ Сохранено` — проверить, что `MoneyInput` отдаёт `onBlur` (он пробрасывает `...props`).

- [ ] **Step 10: Коммит**

```bash
git add admin/src/components/warehouse/document admin/src/app/warehouse/receipts admin/e2e/warehouseApi.ts admin/e2e/warehouse.spec.ts admin/e2e/mobile/warehouse.spec.ts
git commit -m "feat(admin): live receipt document with inline lines and product field"
```

---

### Task 3: «☰ Подбор»

**Files:**
- Create: `admin/src/components/warehouse/document/ProductPicker.tsx`
- Modify: `admin/src/components/warehouse/document/DocumentScreen.tsx` (кнопка и панель)
- Modify: `admin/e2e/warehouse.spec.ts`, `admin/e2e/mobile/warehouse.spec.ts`

**Interfaces:**
- Consumes: `useProductPicker` (Task 1), `useDocument().addMany`, `LineRow` (Task 2), `Modal variant="panel"`, `FilterChips`, `QuantityStepper`, `LoadMoreSentinel`, `pickerMeta`.
- Produces: `<ProductPicker kind storeId rows onAdd onClose />`; кнопка «☰ Подбор»; диалог «Подбор» с полем `Поиск в подборе`, чипами `Категории`, строками `data-testid="picker-row"` (в строке — кнопка `data-testid="picker-pick"` и степпер), кнопкой «Добавить N позиций · M шт».

- [ ] **Step 1: Падающие e2e**

В `admin/e2e/warehouse.spec.ts`:

```ts
test("Подбор: три товара одним нажатием", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const store = await createStore(request, stamp);
  const a = await createProduct(request, stamp, {}, " А");
  const b = await createProduct(request, stamp, {}, " Б");
  const c = await createProduct(request, stamp, {}, " В");
  const receiptId = await createReceiptDraft(request, store.id);
  drafts.push(`/admin/goods-receipts/${receiptId}`);

  await page.goto(`/warehouse/receipts/${receiptId}`);
  await page.getByRole("button", { name: "☰ Подбор" }).click();
  const picker = page.getByRole("dialog", { name: "Подбор" });
  await picker.getByLabel("Поиск в подборе").fill(`E2E товар ${stamp}`);
  const row = (name: string) => picker.getByTestId("picker-row").filter({ hasText: name });
  await expect(row(a.name)).toBeVisible();

  await row(a.name).getByTestId("picker-pick").click();
  await row(b.name).getByTestId("picker-pick").click();
  await row(b.name).getByTestId("picker-pick").click();
  await row(c.name).getByRole("button", { name: `Больше: ${c.name}` }).click();
  await expect(picker).toContainText("Выбрано: 3");

  await picker.getByRole("button", { name: "Добавить 3 позиции · 4 шт" }).click();
  await expect(picker).toBeHidden();
  await expect(page.getByText("Добавлено 3 позиции")).toBeVisible();
  await expect(documentLine(page, a.name).getByLabel(`Количество: ${a.name}`)).toHaveValue("1");
  await expect(documentLine(page, b.name).getByLabel(`Количество: ${b.name}`)).toHaveValue("2");
  await expect(documentLine(page, c.name).getByLabel(`Количество: ${c.name}`)).toHaveValue("1");
});

test("Подбор: закрытие с выбором спрашивает", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const { productName, storeId } = await setupProductAndStore(request, stamp);
  const receiptId = await createReceiptDraft(request, storeId);
  drafts.push(`/admin/goods-receipts/${receiptId}`);

  await page.goto(`/warehouse/receipts/${receiptId}`);
  await page.getByRole("button", { name: "☰ Подбор" }).click();
  const picker = page.getByRole("dialog", { name: "Подбор" });
  await picker.getByLabel("Поиск в подборе").fill(productName);
  await picker.getByTestId("picker-row").filter({ hasText: productName }).getByTestId("picker-pick").click();

  page.removeAllListeners("dialog");
  const questions: string[] = [];
  page.once("dialog", (dialog) => {
    questions.push(dialog.message());
    void dialog.dismiss();
  });
  await picker.getByRole("button", { name: "Закрыть" }).click();
  expect(questions).toEqual(["Отменить подбор? Выбрано 1 товар."]);
  await expect(picker).toContainText("Выбрано: 1");

  page.once("dialog", (dialog) => void dialog.accept());
  await picker.getByRole("button", { name: "Закрыть" }).click();
  await expect(picker).toBeHidden();
  await expect(documentLine(page, productName)).toHaveCount(0);
});
```

В `admin/e2e/mobile/warehouse.spec.ts`:

```ts
test("Подбор на телефоне — на весь экран, «Добавить» над нижней панелью", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const product = await createProduct(request, stamp);
  const store = await createStore(request, stamp);
  const receiptId = await createReceiptDraft(request, store.id);

  try {
    await page.goto(`/warehouse/receipts/${receiptId}`);
    await page.getByRole("button", { name: "☰ Подбор" }).click();
    const picker = page.getByRole("dialog", { name: "Подбор" });
    const box = (await picker.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.round(box.height)).toBe(viewport.height);

    await picker.getByLabel("Поиск в подборе").fill(product.name);
    await picker.getByTestId("picker-row").filter({ hasText: product.name }).getByTestId("picker-pick").click();
    const add = picker.getByRole("button", { name: "Добавить 1 позицию · 1 шт" });
    const addBox = (await add.boundingBox())!;
    const hit = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.textContent?.trim() ?? null,
      [addBox.x + addBox.width / 2, addBox.y + addBox.height / 2],
    );
    expect(hit).toBe("Добавить 1 позицию · 1 шт");
    await add.click();
    await expect(page.getByTestId("document-line").filter({ hasText: product.name })).toHaveCount(1);
  } finally {
    await adminApi(request).delete(`/admin/goods-receipts/${receiptId}`);
  }
});
```

- [ ] **Step 2: Запустить — падают**

```bash
cd admin
npx playwright test --project=Desktop e2e/warehouse.spec.ts -g "Подбор"
npx playwright test --project=Mobile e2e/mobile/warehouse.spec.ts -g "Подбор"
```

Expected: FAIL — нет кнопки «☰ Подбор».

- [ ] **Step 3: `ProductPicker`**

`admin/src/components/warehouse/document/ProductPicker.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useResource } from '@/lib/crud';
import { plural, ru, type Translatable } from '@/lib/text';
import { useProductPicker } from '@/lib/useProductPicker';
import { formatQty, type DraftKind, type PickerProduct } from '@/lib/warehouse';
import FilterChips from '@/components/ui/FilterChips';
import Modal from '@/components/ui/Modal';
import { buttonPrimary, inputClass } from '@/components/ui/styles';
import LoadMoreSentinel from './LoadMoreSentinel';
import { pickerMeta } from './pickerText';
import QuantityStepper from './QuantityStepper';
import type { LineRow } from './useDocument';

type Category = { id: number; parent_id: number | null; name: Translatable };

type Props = {
  kind: DraftKind;
  storeId: number;
  rows: LineRow[];
  onAdd: (items: { product_id: number; quantity: string }[]) => Promise<boolean>;
  onClose: () => void;
};

const RECENT = 'recent';

/**
 * «Подбор»: каталог с поиском и категориями верхнего уровня (с
 * подкатегориями), у строки — степпер; нажатие на строку — +1. Выбор копится
 * при смене поиска и категории и уходит одним запросом (`items/batch`). В
 * списании — только товары с остатком, и больше остатка минус уже внесённое
 * не выбрать. На ПК — панель справа, на телефоне — весь экран.
 */
export default function ProductPicker({ kind, storeId, rows, onAdd, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Map<number, number>>(new Map());
  const [busy, setBusy] = useState(false);
  const categories = useResource<Category>('/admin/categories');
  const picker = useProductPicker({
    storeId,
    search,
    categoryId: category && category !== RECENT ? Number(category) : null,
    recent: category === RECENT,
    inStock: kind === 'write_off',
  });

  const inDocument = useMemo(() => new Map(rows.map((row) => [row.productId, Number(row.quantity) || 0])), [rows]);
  const limitOf = (product: PickerProduct): number | undefined =>
    kind === 'write_off' ? Math.max(0, product.on_hand - (inDocument.get(product.id) ?? 0)) : undefined;

  const setQuantity = (product: PickerProduct, quantity: number) =>
    setSelected((current) => {
      const next = new Map(current);
      const limit = limitOf(product);
      const value = Math.max(0, limit === undefined ? quantity : Math.min(limit, quantity));
      if (value > 0) {
        next.set(product.id, value);
      } else {
        next.delete(product.id);
      }
      return next;
    });

  const count = selected.size;
  const units = [...selected.values()].reduce((sum, quantity) => sum + quantity, 0);
  const documentWord = kind === 'receipt' ? 'в приёмке' : 'в списании';

  const close = () => {
    if (count > 0 && !window.confirm(`Отменить подбор? Выбрано ${count} ${plural(count, ['товар', 'товара', 'товаров'])}.`)) {
      return;
    }
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    try {
      const added = await onAdd([...selected].map(([productId, quantity]) => ({ product_id: productId, quantity: String(quantity) })));
      if (added) {
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const chips = [
    { value: RECENT, label: 'Недавние' },
    { value: '', label: 'Все' },
    ...categories.items.filter((c) => c.parent_id === null).map((c) => ({ value: String(c.id), label: ru(c.name) || `#${c.id}` })),
  ];

  return (
    <Modal
      title="Подбор"
      variant="panel"
      onClose={close}
      footer={
        <button type="button" className={`${buttonPrimary} w-full`} disabled={count === 0 || busy} onClick={() => void submit()}>
          {count === 0
            ? 'Выберите товары'
            : `Добавить ${count} ${plural(count, ['позицию', 'позиции', 'позиций'])} · ${formatQty(units)} шт`}
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-zinc-500">Выбрано: {count}</p>
        <input
          type="search"
          aria-label="Поиск в подборе"
          placeholder="Название, код или артикул"
          className={inputClass}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FilterChips label="Категории" options={chips} value={category} onChange={setCategory} />
        <ul className="divide-y divide-zinc-100">
          {picker.items.map((product) => {
            const quantity = selected.get(product.id) ?? 0;
            const limit = limitOf(product);
            const already = inDocument.get(product.id);
            const name = ru(product.name) || `#${product.id}`;
            return (
              <li key={product.id} data-testid="picker-row" className={`flex items-center gap-3 py-2 ${quantity > 0 ? 'bg-blue-50/60' : ''}`}>
                <button
                  type="button"
                  data-testid="picker-pick"
                  className="min-h-11 min-w-0 flex-1 text-left disabled:opacity-60"
                  disabled={limit !== undefined && quantity >= limit}
                  onClick={() => setQuantity(product, quantity + 1)}
                >
                  <span className="block text-sm font-medium text-zinc-900">{name}</span>
                  <span className="block text-xs text-zinc-500">
                    {pickerMeta(product, kind)}
                    {already ? ` · ${documentWord}: ${formatQty(already)}` : ''}
                  </span>
                </button>
                <QuantityStepper
                  value={String(quantity)}
                  label={name}
                  min={0}
                  max={limit}
                  onChange={(value) => {
                    const next = Number(value);
                    if (Number.isFinite(next)) {
                      setQuantity(product, next);
                    }
                  }}
                />
              </li>
            );
          })}
        </ul>
        {picker.hasMore && <LoadMoreSentinel onVisible={picker.loadMore} disabled={picker.loading} />}
        {picker.loading && <p className="text-sm text-zinc-400">Загрузка…</p>}
        {!picker.loading && picker.items.length === 0 && <p className="text-sm text-zinc-500">Ничего не найдено.</p>}
      </div>
    </Modal>
  );
}
```

Кнопка строки в e2e — `getByTestId("picker-pick")`: по имени её не отличить от «Больше: <товар>» / «Меньше: <товар>» (Playwright ищет имя подстрокой).

- [ ] **Step 4: Кнопка «☰ Подбор» на экране**

В `DocumentScreen.tsx`: импорт `useState` из `react`, `ProductPicker` из `./ProductPicker`, `buttonSecondary` из стилей; в начале компонента — `const [picking, setPicking] = useState(false);` (до ранних `return`, чтобы хуки не зависели от ветки); в блоке добавления:

```tsx
          <div className="flex flex-col gap-2 md:flex-row">
            <AddProductField kind={kind} storeId={header.store_id} onPick={(product) => doc.addProduct(product.id)} />
            <button type="button" className={buttonSecondary} onClick={() => setPicking(true)}>
              ☰ Подбор
            </button>
          </div>
          {picking && (
            <ProductPicker kind={kind} storeId={header.store_id} rows={doc.rows} onAdd={doc.addMany} onClose={() => setPicking(false)} />
          )}
```

- [ ] **Step 5: Проверка**

```bash
cd admin
npx tsc --noEmit && npm run lint
npx playwright test --project=Desktop e2e/warehouse.spec.ts
npx playwright test --project=Mobile e2e/mobile/warehouse.spec.ts
```

Expected: всё PASS (включая тесты Task 2).

- [ ] **Step 6: Коммит**

```bash
git add admin/src/components/warehouse/document admin/e2e/warehouse.spec.ts admin/e2e/mobile/warehouse.spec.ts
git commit -m "feat(admin): product picker adds many lines in one request"
```

---

### Task 4: Списание на том же каркасе

**Files:**
- Modify: `admin/src/app/warehouse/write-offs/[id]/page.tsx` (заменить целиком)
- Modify: `admin/e2e/warehouse.spec.ts` (заменить тест «списание больше остатка…»)

**Interfaces:**
- Consumes: `DocumentScreen` (Task 2–3), `createWriteOffDraft` (Task 2).
- Produces: страница списания — `<DocumentScreen kind="write_off" />`.

- [ ] **Step 1: Падающие e2e**

В `admin/e2e/warehouse.spec.ts` импорт дополнить `createWriteOffDraft`; **заменить** тест «списание больше остатка отклоняется, исправленное проводится» на:

```ts
test("списание: подбор ограничен остатком, строка сверх остатка блокирует проведение", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const { productId, storeId, productName } = await setupProductAndStore(request, stamp);
  const empty = await createProduct(request, stamp, {}, " пусто");
  await receive(request, storeId, productId, 2);
  const writeOffId = await createWriteOffDraft(request, storeId);
  drafts.push(`/admin/write-offs/${writeOffId}`);

  await page.goto(`/warehouse/write-offs/${writeOffId}`);
  await page.getByRole("button", { name: "☰ Подбор" }).click();
  const picker = page.getByRole("dialog", { name: "Подбор" });
  await picker.getByLabel("Поиск в подборе").fill(`E2E товар ${stamp}`);
  const row = picker.getByTestId("picker-row").filter({ hasText: productName });
  await expect(row).toBeVisible();
  // Товара без остатка в списании нет.
  await expect(picker.getByTestId("picker-row").filter({ hasText: empty.name })).toHaveCount(0);

  const more = row.getByRole("button", { name: `Больше: ${productName}` });
  await more.click();
  await more.click();
  await expect(more).toBeDisabled();
  await expect(row.getByLabel(`Количество: ${productName}`)).toHaveValue("2");
  await picker.getByRole("button", { name: "Добавить 1 позицию · 2 шт" }).click();

  const line = documentLine(page, productName);
  await expect(line.getByLabel(`Количество: ${productName}`)).toHaveValue("2");
  await expect(line).toContainText("2");

  await line.getByLabel(`Количество: ${productName}`).fill("3");
  await expect(line).toContainText("Больше, чем на складе");
  await expect(page.getByRole("button", { name: "Провести" })).toBeDisabled();

  await line.getByLabel(`Количество: ${productName}`).fill("1");
  await line.getByLabel(`Количество: ${productName}`).blur();
  await expect(page.getByText("✓ Сохранено")).toBeVisible();
  await page.getByRole("button", { name: "Провести" }).click();
  await expect(page.getByText(/^Проведено /)).toBeVisible();
  await expect(page.getByText(/Себестоимость: 1\s000 ₸/)).toBeVisible();
});
```

- [ ] **Step 2: Запустить — падает**

Run: `cd admin && npx playwright test --project=Desktop e2e/warehouse.spec.ts -g "списание: подбор"`
Expected: FAIL — на старой странице списания нет «☰ Подбор».

- [ ] **Step 3: Страница списания**

`admin/src/app/warehouse/write-offs/[id]/page.tsx` — заменить целиком:

```tsx
'use client';

import DocumentScreen from '@/components/warehouse/document/DocumentScreen';

export default function WriteOffPage() {
  return <DocumentScreen kind="write_off" />;
}
```

- [ ] **Step 4: Проверка**

```bash
cd admin
npx tsc --noEmit && npm run lint
npx playwright test --project=Desktop e2e/warehouse.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add admin/src/app/warehouse/write-offs admin/e2e/warehouse.spec.ts
git commit -m "feat(admin): write-off uses the live document screen"
```

---

### Task 5: Черновик одним нажатием, «⋯» в остатках, удаление модалок

**Files:**
- Modify: `admin/src/lib/warehouse.ts` (`createDraft`)
- Create: `admin/src/components/warehouse/useCreateDraft.ts`, `admin/src/components/warehouse/CreateDocumentButton.tsx`, `admin/src/components/warehouse/StockRowActions.tsx`
- Modify: `admin/src/app/warehouse/layout.tsx`, `admin/src/app/warehouse/page.tsx`, `admin/src/app/warehouse/stock/page.tsx`
- Delete: `admin/src/components/warehouse/NewReceiptButton.tsx`, `NewWriteOffButton.tsx`, `GoodsReceiptForm.tsx`, `WriteOffForm.tsx`, `QuantityForm.ts`
- Modify e2e: `admin/e2e/warehouse.spec.ts`, `admin/e2e/warehouse-shell.spec.ts`, `admin/e2e/stock.spec.ts`, `admin/e2e/mobile/warehouse.spec.ts`, `admin/e2e/mobile/controls.spec.ts`

**Interfaces:**
- Consumes: `DraftKind`, `documentApiPath`, `draftHref` (Task 1).
- Produces: `createDraft(kind: DraftKind, options?: { storeId?: number | null; productId?: number }): Promise<number>`; `useCreateDraft()` → `{ busy: DraftKind | null; create(kind, options?): Promise<void> }`; `<CreateDocumentButton kind storeId? className? />`; `<HeaderCreateButtons />` (склад — из `?store_id=` текущей страницы); `<StockRowActions productId productName stock storeId />` — кнопка «Действия: <товар>».

- [ ] **Step 1: Падающие e2e**

`admin/e2e/warehouse.spec.ts`:

```ts
test("«+ Принять товар» сразу открывает черновик на складе из фильтра", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const store = await createStore(request, stamp);

  await page.goto(`/warehouse/documents?kind=receipts&store_id=${store.id}`);
  await page.getByRole("button", { name: /Принять товар/ }).click();
  await expect(page).toHaveURL(/\/warehouse\/receipts\/\d+$/);
  drafts.push(draftPath(page, "/admin/goods-receipts"));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("document-fields")).toContainText(store.name);
});
```

`admin/e2e/stock.spec.ts` — новый тест (использовать уже импортированные в файле помощники; при нехватке — импортировать `createProduct`, `createStore`, `receive`, `uniqueStamp` из `./warehouseApi` и `adminApi` из `./adminApi`):

```ts
test("«⋯ → Принять товар» открывает приёмку с этим товаром на выбранном складе", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const product = await createProduct(request, stamp);
  const store = await createStore(request, stamp);
  await receive(request, store.id, product.id, 1);

  await page.goto(`/warehouse/stock?store_id=${store.id}`);
  await page.getByPlaceholder("Название, код или артикул").fill(product.name);
  await page.getByRole("button", { name: `Действия: ${product.name}` }).click();
  await page.getByRole("menuitem", { name: "Принять товар" }).click();

  await expect(page).toHaveURL(/\/warehouse\/receipts\/\d+$/);
  const receiptId = new URL(page.url()).pathname.split("/").pop();
  try {
    await expect(page.getByTestId("document-line").filter({ hasText: product.name })).toHaveCount(1);
    await expect(page.getByTestId("document-fields")).toContainText(store.name);
  } finally {
    await adminApi(request).delete(`/admin/goods-receipts/${receiptId}`);
  }
});
```

`admin/e2e/warehouse-shell.spec.ts` — **удалить** тест «фокус модалки «Новая приёмка» уходит в диалог и возвращается на кнопку» (модалки больше нет; фокус-менеджмент `Modal` проверяет его использование в других местах).

`admin/e2e/mobile/warehouse.spec.ts` — **удалить** тест «модалка из шапки раздела — над нижней панелью» (его место занял тест «Подбор на телефоне…» из Task 3).

`admin/e2e/mobile/controls.spec.ts` — **заменить** тест «поля формы приёмки идут в одну колонку» на:

```ts
test("поля шапки приёмки идут в одну колонку", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const store = await createStore(request, stamp);
  const receiptId = await createReceiptDraft(request, store.id);

  try {
    await page.goto(`/warehouse/receipts/${receiptId}`);
    await page.getByTestId("document-fields").getByRole("button", { name: /Изменить/ }).click();
    const date = (await page.getByLabel("Дата приёмки").boundingBox())!;
    const number = (await page.getByLabel("Номер накладной").boundingBox())!;
    expect(Math.round(number.x)).toBe(Math.round(date.x));
    expect(number.y).toBeGreaterThan(date.y);
  } finally {
    await adminApi(request).delete(`/admin/goods-receipts/${receiptId}`);
  }
});
```

(импорты: `createReceiptDraft`, `createStore`, `uniqueStamp` из `../warehouseApi`, `adminApi` из `../adminApi`.)

- [ ] **Step 2: Запустить — падают**

```bash
cd admin
npx playwright test --project=Desktop e2e/warehouse.spec.ts -g "сразу открывает черновик"
npx playwright test --project=Desktop e2e/stock.spec.ts -g "Принять товар"
```

Expected: FAIL — по кнопке открывается модалка «Новая приёмка»; кнопки «Действия: …» нет.

- [ ] **Step 3: `createDraft`**

В `admin/src/lib/warehouse.ts`: импорт `import api from '@/lib/api';` в начало файла и в конец:

```ts
/**
 * Черновик приёмки или списания одним запросом: склад — переданный (фильтр
 * страницы) или по умолчанию на сервере; дата, поставщик, причина и автор —
 * тоже сервер. С `productId` товар сразу становится первой строкой.
 */
export async function createDraft(kind: DraftKind, { storeId = null, productId }: { storeId?: number | null; productId?: number } = {}): Promise<number> {
  const res = await api.post<{ data: { id: number } }>(documentApiPath(kind), storeId ? { store_id: storeId } : {});
  const id = res.data.data.id;

  if (productId) {
    await api.post(`${documentApiPath(kind)}/${id}/items`, { product_id: productId });
  }

  return id;
}
```

- [ ] **Step 4: `useCreateDraft`, кнопки создания**

`admin/src/components/warehouse/useCreateDraft.ts`:

```ts
'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { serverMessage } from '@/lib/errors';
import { createDraft, draftHref, type DraftKind } from '@/lib/warehouse';
import { toast } from '@/stores/toastStore';

/**
 * Создать черновик и перейти в него. `busy` держится до ухода со страницы —
 * кнопка не создаёт второй черновик двойным нажатием. Отказ сервера (нет
 * активного места хранения) — тостом; 5xx и сеть показал перехватчик api.
 */
export function useCreateDraft() {
  const router = useRouter();
  const [busy, setBusy] = useState<DraftKind | null>(null);

  const create = useCallback(
    async (kind: DraftKind, options: { storeId?: number | null; productId?: number } = {}) => {
      setBusy(kind);
      try {
        const id = await createDraft(kind, options);
        router.push(draftHref(kind, id));
      } catch (error) {
        const message = serverMessage(error);
        if (message) {
          toast.error(message);
        }
        setBusy(null);
      }
    },
    [router],
  );

  return { busy, create };
}
```

`admin/src/components/warehouse/CreateDocumentButton.tsx`:

```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import type { DraftKind } from '@/lib/warehouse';
import { buttonPrimary, buttonSecondary } from '@/components/ui/styles';
import { useCreateDraft } from './useCreateDraft';

type Props = { kind: DraftKind; storeId?: number | null; className?: string };

/** «+ Принять товар» / «Списать»: черновик без модалки, сразу его карточка. */
export default function CreateDocumentButton({ kind, storeId = null, className }: Props) {
  const { busy, create } = useCreateDraft();

  return (
    <button
      type="button"
      disabled={busy !== null}
      className={className ?? (kind === 'receipt' ? buttonPrimary : buttonSecondary)}
      onClick={() => void create(kind, { storeId })}
    >
      {busy ? 'Создаю…' : kind === 'receipt' ? '+ Принять товар' : 'Списать'}
    </button>
  );
}

/**
 * Кнопки шапки раздела. Склад — из `?store_id=` текущей вкладки (фильтр
 * «Остатков» или «Документов»), иначе сервер возьмёт склад по умолчанию.
 * Читает адрес — рендерить под `<Suspense>`.
 */
export function HeaderCreateButtons() {
  const params = useSearchParams();
  const storeId = Number(params.get('store_id')) || null;

  return (
    <>
      <CreateDocumentButton kind="receipt" storeId={storeId} />
      <CreateDocumentButton kind="write_off" storeId={storeId} />
    </>
  );
}
```

`admin/src/app/warehouse/layout.tsx`: убрать импорты `NewReceiptButton`, `NewWriteOffButton`; добавить `import { Suspense } from 'react';` и `import { HeaderCreateButtons } from '@/components/warehouse/CreateDocumentButton';`; `actions` заменить на:

```tsx
            actions={
              <Suspense fallback={null}>
                <HeaderCreateButtons />
              </Suspense>
            }
```

`admin/src/app/warehouse/page.tsx`: импорт `NewReceiptButton` заменить на `import CreateDocumentButton from '@/components/warehouse/CreateDocumentButton';`, `action={<NewReceiptButton />}` — на `action={<CreateDocumentButton kind="receipt" />}`.

- [ ] **Step 5: «⋯» в строке остатков**

`admin/src/components/warehouse/StockRowActions.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import { useIsDesktop } from '@/lib/useIsDesktop';
import ActionSheet, { type SheetAction } from '@/components/ui/ActionSheet';
import { useCreateDraft } from './useCreateDraft';

type Props = { productId: number; productName: string; stock: number; storeId: number | null };

/** Примерная высота меню — только чтобы решить, открывать вверх или вниз. */
const MENU_HEIGHT_ESTIMATE = 120;

/**
 * «⋯» в строке «Остатков»: принять или списать этот товар — черновик с ним
 * на складе из фильтра. «Списать» — только при остатке. На телефоне —
 * ActionSheet, на ПК — выпадашка `position: fixed` от кнопки (как
 * OrderRowActions: `absolute` обрезал бы `overflow-hidden` таблицы).
 */
export default function StockRowActions({ productId, productName, stock, storeId }: Props) {
  const isDesktop = useIsDesktop();
  const { busy, create } = useCreateDraft();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const actions: SheetAction[] = [
    { key: 'receive', label: 'Принять товар', onSelect: () => void create('receipt', { storeId, productId }) },
    ...(stock > 0 ? [{ key: 'write-off', label: 'Списать', onSelect: () => void create('write_off', { storeId, productId }) }] : []),
  ];

  const toggle = () => {
    if (!isDesktop) {
      setOpen(true);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const upward = window.innerHeight - rect.bottom < MENU_HEIGHT_ESTIMATE;
      setPosition({
        right: window.innerWidth - rect.right,
        ...(upward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      });
    }
    setOpen((v) => !v);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={busy !== null}
        aria-label={`Действия: ${productName}`}
        aria-expanded={open}
        onClick={toggle}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 md:min-h-0 md:min-w-0"
      >
        {busy ? '…' : '⋯'}
      </button>

      {open && isDesktop && position && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div role="menu" style={{ position: 'fixed', ...position }} className="z-20 min-w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
                className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}

      {open && !isDesktop && <ActionSheet title={productName} actions={actions} onClose={() => setOpen(false)} />}
    </div>
  );
}
```

В `ActionSheet` пункты — `<button>`; e2e на телефоне ищет их по роли `button`, на ПК — `menuitem`.

`admin/src/app/warehouse/stock/page.tsx`: импорт `import StockRowActions from '@/components/warehouse/StockRowActions';`; в колонке `actions` первым элементом внутри `<div className="flex justify-end gap-4">`:

```tsx
          <StockRowActions
            productId={row.product.id}
            productName={ru(row.product.name) || `#${row.product.id}`}
            stock={row.stock}
            storeId={storeId ? Number(storeId) : null}
          />
```

(контейнеру — `items-center`, чтобы кнопка встала в линию со ссылками).

- [ ] **Step 6: Удалить модалки**

```bash
git rm admin/src/components/warehouse/NewReceiptButton.tsx admin/src/components/warehouse/NewWriteOffButton.tsx admin/src/components/warehouse/GoodsReceiptForm.tsx admin/src/components/warehouse/WriteOffForm.tsx admin/src/components/warehouse/QuantityForm.ts
grep -rn "NewReceiptButton\|NewWriteOffButton\|GoodsReceiptForm\|WriteOffForm\|QuantityForm\|toReceiptPayload" admin/src
```

Expected: `grep` ничего не находит.

- [ ] **Step 7: Проверка**

```bash
cd admin
npx tsc --noEmit && npm run lint && npm run build
npx playwright test --project=Desktop e2e/warehouse.spec.ts e2e/stock.spec.ts e2e/warehouse-shell.spec.ts e2e/warehouse-overview.spec.ts
npx playwright test --project=Mobile e2e/mobile/warehouse.spec.ts e2e/mobile/controls.spec.ts
```

Expected: `build` проходит (без ошибки про `useSearchParams` без Suspense); e2e PASS, кроме известного красного из Task 0.

- [ ] **Step 8: Коммит**

```bash
git add -A admin/src admin/e2e
git commit -m "feat(admin): one-tap draft creation and stock row actions; drop document modals"
```

---

### Task 6: Вкладка «Документы» — фильтры в адресе, чипы, пустые состояния

**Files:**
- Modify: `admin/src/lib/crud.ts` (`params` важнее внутреннего `page`), `admin/src/lib/warehouse.ts` (`parseWriteOffReason`), `admin/src/components/ui/LinkTabs.tsx` (вариант `segmented`)
- Modify: `admin/src/app/warehouse/documents/page.tsx`, `admin/src/components/warehouse/ReceiptsList.tsx`, `admin/src/components/warehouse/WriteOffsList.tsx`
- Create: `admin/e2e/documents.spec.ts`

**Interfaces:**
- Consumes: `CreateDocumentButton` (Task 5), `useWarehouseSummary`, `FilterChips`, `StoreSelect`, `EmptyState`.
- Produces: адрес `/warehouse/documents?kind=&status=&store_id=&reason=&page=`; `ReceiptsList`/`WriteOffsList` с пропсами `{ status: '' | DocumentStatus; storeId: string; reason?: '' | WriteOffReason; page: number; onPageChange(page: number): void; hasFilters: boolean; onResetFilters(): void }`; `parseWriteOffReason(value: string | null): '' | WriteOffReason`; `<LinkTabs variant="segmented" />`.

- [ ] **Step 1: Падающий e2e**

`admin/e2e/documents.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { adminApi } from "./adminApi";
import { ADMIN_SESSION } from "./session";
import { createStore, createWriteOffDraft, uniqueStamp } from "./warehouseApi";

/** Вкладка «Документы»: фильтры живут в адресе, черновики сверху, пустое состояние с действием. */
test.use({ storageState: ADMIN_SESSION });

test("фильтры списаний — в адресе и переживают перезагрузку", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const store = await createStore(request, stamp);
  const draftId = await createWriteOffDraft(request, store.id);

  try {
    await page.goto(`/warehouse/documents?kind=write_offs&status=draft&store_id=${store.id}`);
    const kinds = page.getByRole("navigation", { name: "Вид документов" });
    await expect(kinds.getByRole("link", { name: "Списания" })).toHaveAttribute("aria-current", "page");
    const statuses = page.getByRole("radiogroup", { name: "Статус" });
    await expect(statuses.getByRole("radio", { name: /Черновики/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("link", { name: `№${draftId}` })).toBeVisible();

    await page.getByLabel("Причина").selectOption({ label: "Потеря / недостача" });
    await expect(page).toHaveURL(/reason=lost/);
    await expect(page.getByText("Ничего не найдено")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Причина")).toHaveValue("lost");
    await page.getByRole("button", { name: "Сбросить фильтры" }).click();
    await expect(page).toHaveURL(/\/warehouse\/documents\?kind=write_offs$/);
  } finally {
    await adminApi(request).delete(`/admin/write-offs/${draftId}`);
  }
});

test("фильтры приёмок: склад и статус в адресе вместе", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const store = await createStore(request, stamp);

  await page.goto(`/warehouse/documents?kind=receipts&store_id=${store.id}`);
  await expect(page.getByText("Ничего не найдено")).toBeVisible();
  await page.getByRole("radio", { name: "Проведённые" }).click();
  await expect(page).toHaveURL(/status=posted/);
  await expect(page).toHaveURL(new RegExp(`store_id=${store.id}`));
});
```

- [ ] **Step 2: Запустить — падает**

Run: `cd admin && npx playwright test --project=Desktop e2e/documents.spec.ts`
Expected: FAIL — нет `radiogroup` «Статус» (сейчас `select`), фильтры не в адресе.

- [ ] **Step 3: `useResource` — `page` из `params`**

`admin/src/lib/crud.ts`, в `reload()`: `params: { ...JSON.parse(paramsKey), page }` → `params: { page, ...JSON.parse(paramsKey) }`. PHPDoc хука дополнить: «`params.page`, если передан, важнее внутренней страницы — так список берёт страницу из адреса».

- [ ] **Step 4: `parseWriteOffReason`, `LinkTabs segmented`**

`admin/src/lib/warehouse.ts`:

```ts
/** Причина списания из адреса: неизвестная — «все». */
export const parseWriteOffReason = (value: string | null): '' | WriteOffReason =>
  value && Object.hasOwn(WRITE_OFF_REASONS, value) ? (value as WriteOffReason) : '';
```

`admin/src/components/ui/LinkTabs.tsx`: `type Props = { label: string; tabs: LinkTab[]; active: string; variant?: 'tabs' | 'segmented' };`, в сигнатуре `variant = 'tabs'`, в начале тела:

```tsx
  if (variant === 'segmented') {
    return (
      <nav aria-label={label} className="inline-flex rounded-xl bg-zinc-100 p-1">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-medium transition-colors ${
                isActive ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    );
  }
```

PHPDoc: «`segmented` — переключатель из двух-трёх вариантов внутри вкладки (приёмки / списания), чтобы не выглядел вторым рядом вкладок раздела.»

- [ ] **Step 5: Страница «Документы»**

`admin/src/app/warehouse/documents/page.tsx` — заменить целиком:

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { parseDocumentKind, parseDocumentStatus, parseWriteOffReason, warehouseHref, WRITE_OFF_REASONS } from '@/lib/warehouse';
import FilterChips from '@/components/ui/FilterChips';
import LinkTabs from '@/components/ui/LinkTabs';
import { inputClass } from '@/components/ui/styles';
import ReceiptsList from '@/components/warehouse/ReceiptsList';
import StoreSelect from '@/components/warehouse/StoreSelect';
import { useWarehouseSummary } from '@/components/warehouse/WarehouseSummary';
import WriteOffsList from '@/components/warehouse/WriteOffsList';

/** Фильтры вкладки живут в адресе: F5, «назад» и ссылка открывают тот же список. */
function DocumentsView() {
  const params = useSearchParams();
  const router = useRouter();
  const { summary } = useWarehouseSummary();
  const kind = parseDocumentKind(params.get('kind'));
  const status = parseDocumentStatus(params.get('status'));
  const storeId = params.get('store_id') ?? '';
  const reason = kind === 'write_offs' ? parseWriteOffReason(params.get('reason')) : '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const hasFilters = Boolean(status || storeId || reason);

  const setFilter = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    if (!('page' in patch)) {
      next.delete('page');
    }
    router.replace(`${warehouseHref.documents(kind).split('?')[0]}?${next.toString()}`, { scroll: false });
  };

  const resetFilters = () => router.replace(warehouseHref.documents(kind), { scroll: false });
  const drafts = summary ? summary.drafts[kind] : null;
  const listProps = { status, storeId, page, onPageChange: (p: number) => setFilter({ page: String(p) }), hasFilters, onResetFilters: resetFilters };

  return (
    <div className="space-y-4">
      <LinkTabs
        variant="segmented"
        label="Вид документов"
        active={kind}
        tabs={[
          { key: 'receipts', href: warehouseHref.documents('receipts'), label: 'Приёмки' },
          { key: 'write_offs', href: warehouseHref.documents('write_offs'), label: 'Списания' },
        ]}
      />
      <FilterChips
        label="Статус"
        value={status}
        onChange={(value) => setFilter({ status: value })}
        options={[
          { value: '', label: 'Все' },
          { value: 'draft', label: 'Черновики', count: drafts },
          { value: 'posted', label: 'Проведённые' },
        ]}
      />
      <div className="flex flex-col gap-3 md:flex-row">
        <StoreSelect aria-label="Склад" emptyLabel="Все склады" className="md:max-w-64" value={storeId} onChange={(e) => setFilter({ store_id: e.target.value })} />
        {kind === 'write_offs' && (
          <select aria-label="Причина" className={`${inputClass} md:max-w-56`} value={reason} onChange={(e) => setFilter({ reason: e.target.value })}>
            <option value="">Все причины</option>
            {Object.entries(WRITE_OFF_REASONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>
      {kind === 'receipts' ? <ReceiptsList {...listProps} /> : <WriteOffsList {...listProps} reason={reason} />}
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

- [ ] **Step 6: Списки — презентационные**

`admin/src/components/warehouse/ReceiptsList.tsx` — заменить целиком:

```tsx
'use client';

import Link from 'next/link';
import { useResource } from '@/lib/crud';
import { formatTenge } from '@/lib/money';
import { formatDateTime, warehouseHref, type DocumentStatus, type GoodsReceiptListItem } from '@/lib/warehouse';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import { buttonGhost } from '@/components/ui/styles';
import CreateDocumentButton from './CreateDocumentButton';
import DocumentStatusBadge from './DocumentStatusBadge';

type Props = {
  status: '' | DocumentStatus;
  storeId: string;
  page: number;
  onPageChange: (page: number) => void;
  hasFilters: boolean;
  onResetFilters: () => void;
};

/** Приёмки: черновики сверху (сортирует сервер), фильтры и страница — из адреса. */
export default function ReceiptsList({ status, storeId, page, onPageChange, hasFilters, onResetFilters }: Props) {
  const params: Record<string, string | number> = { page };
  if (status) params['filter[status]'] = status;
  if (storeId) params['filter[store_id]'] = storeId;

  const receipts = useResource<GoodsReceiptListItem>('/admin/goods-receipts', params);

  const columns: Column<GoodsReceiptListItem>[] = [
    {
      key: 'number',
      header: 'Приёмка',
      mobile: 'title',
      render: (r) => (
        <Link href={warehouseHref.receipt(r.id)} className="font-medium text-zinc-900 hover:text-blue-700">
          {r.number || `№${r.id}`}
        </Link>
      ),
    },
    { key: 'status', header: 'Статус', mobile: 'badge', render: (r) => <DocumentStatusBadge status={r.status} postedLabel="Проведена" /> },
    { key: 'date', header: 'Дата', mobile: 'meta', render: (r) => `${formatDateTime(r.received_at)} · ${r.store.name}` },
    { key: 'supplier', header: 'Поставщик', mobile: 'meta', render: (r) => r.supplier?.name ?? '—' },
    { key: 'items', header: 'Позиций', mobile: 'hidden', render: (r) => r.items_count },
    { key: 'total', header: 'Сумма', mobile: 'meta', render: (r) => formatTenge(r.total_cost) },
  ];

  return (
    <DataTable
      columns={columns}
      rows={receipts.items}
      loading={receipts.loading}
      meta={receipts.meta}
      onPageChange={onPageChange}
      empty={
        hasFilters ? (
          <EmptyState
            title="Ничего не найдено"
            hint="Измените или сбросьте фильтры."
            action={
              <button type="button" className={buttonGhost} onClick={onResetFilters}>
                Сбросить фильтры
              </button>
            }
          />
        ) : (
          <EmptyState title="Приёмок пока нет" hint="Нажмите «Принять товар» — черновик откроется сразу, товары добавите в нём." action={<CreateDocumentButton kind="receipt" />} />
        )
      }
    />
  );
}
```

(Колонка «Дата» на ПК теперь показывает «дата · склад», отдельной колонки «Склад» нет — на телефоне это одна строка «дата · склад», как в спеке. Если e2e `warehouse-shell.spec.ts` ищет заголовок «Склад» — поправить на «Дата».)

`admin/src/components/warehouse/WriteOffsList.tsx` — заменить целиком:

```tsx
'use client';

import Link from 'next/link';
import { useResource } from '@/lib/crud';
import { formatDateTime, warehouseHref, WRITE_OFF_REASONS, type DocumentStatus, type WriteOffListItem, type WriteOffReason } from '@/lib/warehouse';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import { buttonGhost } from '@/components/ui/styles';
import CreateDocumentButton from './CreateDocumentButton';
import DocumentStatusBadge from './DocumentStatusBadge';

type Props = {
  status: '' | DocumentStatus;
  storeId: string;
  reason: '' | WriteOffReason;
  page: number;
  onPageChange: (page: number) => void;
  hasFilters: boolean;
  onResetFilters: () => void;
};

/** Списания: черновики сверху (сортирует сервер), фильтры и страница — из адреса. */
export default function WriteOffsList({ status, storeId, reason, page, onPageChange, hasFilters, onResetFilters }: Props) {
  const params: Record<string, string | number> = { page };
  if (status) params['filter[status]'] = status;
  if (storeId) params['filter[store_id]'] = storeId;
  if (reason) params['filter[reason]'] = reason;

  const writeOffs = useResource<WriteOffListItem>('/admin/write-offs', params);

  const columns: Column<WriteOffListItem>[] = [
    {
      key: 'label',
      header: 'Списание',
      mobile: 'title',
      render: (w) => (
        <Link href={warehouseHref.writeOff(w.id)} className="font-medium text-zinc-900 hover:text-blue-700">
          №{w.id}
        </Link>
      ),
    },
    { key: 'status', header: 'Статус', mobile: 'badge', render: (w) => <DocumentStatusBadge status={w.status} postedLabel="Проведено" /> },
    { key: 'date', header: 'Дата', mobile: 'meta', render: (w) => `${formatDateTime(w.posted_at ?? w.created_at)} · ${w.store.name}` },
    { key: 'reason', header: 'Причина', mobile: 'meta', render: (w) => WRITE_OFF_REASONS[w.reason] ?? w.reason },
    { key: 'items', header: 'Позиций', mobile: 'hidden', render: (w) => w.items_count },
  ];

  return (
    <DataTable
      columns={columns}
      rows={writeOffs.items}
      loading={writeOffs.loading}
      meta={writeOffs.meta}
      onPageChange={onPageChange}
      empty={
        hasFilters ? (
          <EmptyState
            title="Ничего не найдено"
            hint="Измените или сбросьте фильтры."
            action={
              <button type="button" className={buttonGhost} onClick={onResetFilters}>
                Сбросить фильтры
              </button>
            }
          />
        ) : (
          <EmptyState title="Списаний пока нет" hint="Нажмите «Списать» — черновик откроется сразу." action={<CreateDocumentButton kind="write_off" />} />
        )
      }
    />
  );
}
```

- [ ] **Step 7: Хвост этапа 2 — экран после редиректа**

Хвост из этапа 2 — редирект `/write-offs?status=draft` проверял только адрес. В `admin/e2e/warehouse-shell.spec.ts`, тест «старые адреса документов ведут в раздел», сразу после цикла `for (const [from, to] of cases) {…}` добавить:

```ts
  // Параметр дошёл до экрана, а не только до адреса.
  await page.goto("/write-offs?status=draft");
  await expect(page.getByRole("radiogroup", { name: "Статус" }).getByRole("radio", { name: /Черновики/ })).toHaveAttribute("aria-checked", "true");
```

- [ ] **Step 8: Проверка**

```bash
cd admin
npx tsc --noEmit && npm run lint && npm run build
npx playwright test --project=Desktop e2e/documents.spec.ts e2e/warehouse-shell.spec.ts e2e/warehouse-overview.spec.ts e2e/warehouse.spec.ts
```

Expected: PASS. `warehouse-shell.spec.ts` «вкладка „Документы“ переключает приёмки и списания» ищет `columnheader` «Поставщик» — он остался.

- [ ] **Step 9: Коммит**

```bash
git add admin/src/lib/crud.ts admin/src/lib/warehouse.ts admin/src/components/ui/LinkTabs.tsx admin/src/app/warehouse/documents admin/src/components/warehouse/ReceiptsList.tsx admin/src/components/warehouse/WriteOffsList.tsx admin/e2e/documents.spec.ts admin/e2e/warehouse-shell.spec.ts
git commit -m "feat(admin): documents tab keeps filters in the URL, draft chips and empty states"
```

---

### Task 7: Финальная проверка

- [ ] **Step 1: Сборка и линтер**

```bash
cd admin
npx tsc --noEmit
npm run lint
npm run build
```

Expected: без ошибок.

- [ ] **Step 2: e2e раздела целиком**

```bash
cd admin
npx playwright test --project=Desktop e2e/warehouse.spec.ts e2e/documents.spec.ts e2e/stock.spec.ts e2e/warehouse-shell.spec.ts e2e/warehouse-overview.spec.ts e2e/empty-state.spec.ts
npx playwright test --project=Mobile e2e/mobile
```

Expected: PASS, кроме красных из журнала Task 0 (сравнить список). `e2e/mobile/no-horizontal-scroll.spec.ts` уже обходит `/warehouse/receipts/…` и `/warehouse/write-offs/…` — новый экран не должен давать горизонтальную прокрутку; если красный — чинить разметку (обычно `min-w-0` у названия товара в строке).

- [ ] **Step 3: Ручная проверка в браузере (preview :3002, viewport 390×844 и 1440×900)**

Открыть черновик приёмки: список по фокусу, добавить 5+ товаров через «Подбор», поменять цену и количество, уйти «Назад» с ошибочной строкой (вопрос), провести. Снимки экрана телефона и ПК — в итоговый отчёт.

- [ ] **Step 4: Хвосты**

`git status` чистый (кроме `admin/AGENTS.md`, если его переписал `next dev` — закоммитить отдельным коммитом `chore(admin): next dev agent rules`, как советует сам файл).
