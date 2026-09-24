# Форма товара в админке — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Страница `/products/create` и `/products/{id}` в `admin/` становится удобной формой на русском в две колонки: фото и цены при создании, сохранение без ухода со страницы, ошибки под полями, предупреждение о несохранённом, телефон от 360 px.

**Architecture:** `app/products/[id]/page.tsx` один раз читает id, грузит товар и справочники и рисует `ProductForm`. `ProductForm` держит одну форму `react-hook-form` + `zod` и раскладывает карточки разделов (`components/products/form/*`) в две колонки с `lg`, в одну — до `lg` (порядок через `display: contents` + `order`). Блоки со списками (цены по типам, цены клиентов, характеристики, варианты) — прежние компоненты `*Tab` внутри сворачиваемых блоков, сохраняются сразу. Бэкенд не меняется.

**Tech Stack:** Next.js 16.3 (App Router, клиентские компоненты), React 19, react-hook-form 7 + zod 4 + @hookform/resolvers 5, Tailwind CSS 4, zustand, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-24-admin-product-form-design.md`

## Global Constraints

- Меняется только `admin/`, плюс `.github/workflows/deploy.yml` (build-arg) и `docs/`. API, PHP, Filament не трогаем.
- Новых npm-зависимостей нет.
- Весь текст интерфейса — по-русски. Язык данных в переключателе подписан `RU` / `KZ` (ключ локали в данных — `kk`).
- Точки перелома: две колонки и `sticky`-панель с `lg` (1024 px); до `lg` — одна колонка, панель `fixed` над `BottomNav` (`h-16` + `env(safe-area-inset-bottom)`).
- Интерактивный элемент на телефоне не ниже 44 px (`min-h-11`, с `md:` можно меньше), поля ввода — `inputClass` из `components/ui/styles.ts` (16 px на телефоне).
- Пробелы внутри `calc()` в арбитражных классах Tailwind — подчёркивания: `bottom-[calc(4rem_+_env(safe-area-inset-bottom))]`. Классы пишутся целиком строкой (Tailwind не видит склеенные).
- Деньги в форме — строки в ₸ (`MoneyInput`, `TENGE_PATTERN`); тиын ↔ ₸ только через `lib/money.ts`.
- Сообщения: `REQUIRED` = «Обязательное поле»; «Сумма в ₸, до двух знаков после точки»; «Только латиница в нижнем регистре, цифры и дефис»; «Целое число от 1»; «Число, до трёх знаков после точки»; «Уйти без сохранения? Изменения пропадут.»; тосты «Сохранено», «Товар создан».
- Коммиты — Conventional Commits, **без** строк `Co-Authored-By` и `Generated with Claude Code` (личное правило пользователя в `~/.claude/CLAUDE.md`, сильнее системных подсказок).
- Каждый запуск Playwright — из `admin/` с переменной фикстур (переменные между вызовами Bash не сохраняются):
  `ACCEPTANCE_FIXTURES=/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json npx playwright test …`
  Ниже это сокращено до `PW …` — всегда разворачивать полностью.
- Перед правкой кода Next.js — смотреть `admin/node_modules/next/dist/docs/` (правило `admin/AGENTS.md`).

## Отличия от спека (осознанные)

- **Нет элемента `<form>` вокруг полей.** Блоки со списками открывают `CrudModal` со своим `<form>`, а `Modal` не в портале — вложенная форма в HTML недопустима. «Сохранить» — кнопка `type="button"` с `onClick`. Следствие: Enter в поле не сохраняет товар (и не сохранит случайно).
- **Оба языка и все скалярные поля уходят всегда.** Сейчас пустые `name[kk]`, `description[…]`, `seo_*[…]` не отправляются, и очищенный в форме перевод остаётся в базе. Пустая строка на сервере становится `null` (`ConvertEmptyStringsToNull`), Spatie Translatable хранит `null` как отсутствие перевода. Проверено: `GET /admin/products/{id}` отдаёт `name` объектом `{ru, kk}`.
- **Тосты поднимаются над панелью сохранения**: `SaveBar` ставит CSS-переменную `--save-bar-h`, `Toaster` прибавляет её к своему отступу. Иначе тост «Сохранено» 5 секунд закрывает кнопку «Сохранить».
- **Ссылки «По складам» / «Движения»** ведут на общие страницы без фильтра по товару — фильтра по товару в URL у них нет.
- **Кнопка браузера «Назад»** (popstate) не перехватывается: в App Router нет способа отменить такой переход. Перехватываются клики по ссылкам и закрытие/перезагрузка вкладки.

## Review Focus

1. **Двойное нажатие «Сохранить» на новом товаре** — должен создаться один товар, а не два. Тест — задача 1 (`dblclick`, ровно один `POST /admin/products`).
2. **Переключение RU ↔ KZ во время ввода** — набранное на другом языке не теряется. Тест — задача 1.
3. **Файл не того типа в очереди фото** (PDF, HEIC) — тост с причиной, в очередь не попадает. Тест — задача 2.
4. **Уход со страницы нового товара, где добавлены только фото** — это тоже несохранённое, спрашиваем. Тест — задача 6.
5. **Ошибка сервера 500 при сохранении** — тост, изменения в форме остаются, панель по-прежнему «Есть несохранённые изменения». Тест — задача 5.

## Карта файлов

| Файл | Что делает |
|---|---|
| `admin/src/components/products/form/productForm.ts` (новый) | Типы `ApiProduct`, `NamedOption`, `ProductFormValues`; `productSchema`, `emptyProductValues`, `toFormValues`, `toFormData`, `markup`, `categoryOptions`, `brandOptions`, `errorPaths`, `revealPlan`. Без React. |
| `admin/src/components/products/form/photos.ts` (новый) | `QueuedPhoto`, `photoProblem`, `queuePhoto`, `uploadPhoto`. |
| `admin/src/components/products/form/ProductForm.tsx` (новый) | Форма, раскладка, сохранение, очередь фото, раскрытие ошибок, SaveBar. |
| `admin/src/components/products/form/FormCard.tsx` (новый) | Карточка раздела с заголовком и якорем. |
| `admin/src/components/products/form/{Basic,Price,Seo,Photos}Section.tsx` (новые) | Разделы левой колонки. |
| `admin/src/components/products/form/{Status,Catalog,Accounting,Stock,Dimensions}Card.tsx` (новые) | Разделы правой колонки. |
| `admin/src/components/products/form/ProductFormSkeleton.tsx` (новый) | Скелетон загрузки. |
| `admin/src/components/ui/{LocaleSwitch,Switch,Collapsible,SaveBar,SearchSelect,SectionNav}.tsx` (новые) | Общие компоненты. |
| `admin/src/lib/useUnsavedGuard.ts` (новый) | Вопрос при уходе с несохранённым. |
| `admin/src/app/products/[id]/page.tsx` | Переписывается: загрузка, скелетон, «не найден», `ProductForm`. |
| `admin/src/components/products/{Prices,ClientPrices,AttributeValues,Variants}Tab.tsx` | Необязательный `onCount`. |
| `admin/src/components/products/{ProductRelations,MediaTab}.tsx` | Удаляются (задачи 2–3). |
| `admin/src/components/ui/PageHeader.tsx` | Необязательный `below` под заголовком. |
| `admin/src/components/ui/Toaster.tsx` | Отступ `--save-bar-h`. |
| `admin/src/lib/api.ts` | `STOREFRONT_URL`. |
| `admin/Dockerfile`, `.github/workflows/deploy.yml` | `NEXT_PUBLIC_STOREFRONT_URL`. |
| `admin/e2e/product-form.spec.ts` (новый) | Десктопные сценарии формы. |
| `admin/e2e/product-relations.spec.ts` | Вкладки → блоки. |
| `admin/e2e/mobile/product-form.spec.ts` (новый) | Мобильные сценарии. |

---

### Task 0: Окружение

Работа идёт в ворктри (создаёт `superpowers:using-git-worktrees`). Из ворктри e2e по умолчанию смотрят не туда.

**Files:** нет.

- [ ] **Step 1: Зависимости админки в ворктри**

```bash
cd admin && npm ci
```

Expected: `added N packages`, без `ERR!`.

- [ ] **Step 2: Порт 3002**

API пускает по CORS только `localhost:3000–3002`, и Playwright (`reuseExistingServer`) молча возьмёт любой сервер на 3002.

```bash
lsof -iTCP:3002 -sTCP:LISTEN -n -P
```

Если занят — чей процесс:

```bash
lsof -a -p <PID> -d cwd -Fn | tail -1
```

Если это основная копия (`…/paradise.kz/admin`), **не убивать**: попросить пользователя остановить свой `npm run dev` и дождаться ответа. Если процесс из ворктри или порт свободен — дальше. Дев-сервер ворктри поднимать через `preview_start` с `name: "admin-dev"` (конфиг уже есть в `.claude/launch.json`), не через Bash.

- [ ] **Step 3: API и фикстуры живы**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/b2b/home
python3 -c "import json;d=json.load(open('/Users/samenuatkhan/PhpstormProjects/paradise.kz/storage/app/private/acceptance-fixtures.json'));print(d['version'],d['run_passed'])"
```

Expected: `200` и `2 True`. Иначе — остановиться и спросить пользователя. **Не запускать** `mvp:acceptance --fresh` без его согласия: команда пересоздаёт дев-базу.

- [ ] **Step 4: Исходное состояние проверок**

```bash
cd admin && npx tsc --noEmit; echo "tsc exit $?"
cd admin && npm run lint; echo "lint exit $?"
cd admin && PW --project=Desktop --reporter=list 2>&1 | tail -30
cd admin && PW --project=Mobile --reporter=list 2>&1 | tail -30
```

Записать в scratchpad коды выхода и список упавших/пропущенных тестов. Известно на 2026-09-21: `stock.spec` «товар в наличии…» красный из-за дрейфа фикстур, оба теста `orders.spec` пропускаются. Это не наши поломки.

---

### Task 1: Новая форма — раскладка, поля, сохранение без ухода

Вся страница переписывается на новую форму. Блоки со списками пока остаются вкладками `ProductRelations` в отдельной карточке (уберутся в задачах 2–3).

**Files:**
- Create: `admin/src/components/products/form/productForm.ts`
- Create: `admin/src/components/ui/LocaleSwitch.tsx`, `admin/src/components/ui/Switch.tsx`, `admin/src/components/ui/Collapsible.tsx`, `admin/src/components/ui/SaveBar.tsx`
- Create: `admin/src/components/products/form/FormCard.tsx`, `BasicSection.tsx`, `PriceSection.tsx`, `SeoSection.tsx`, `StatusCard.tsx`, `CatalogCard.tsx`, `AccountingCard.tsx`, `StockCard.tsx`, `DimensionsCard.tsx`, `ProductFormSkeleton.tsx`, `ProductForm.tsx`
- Modify: `admin/src/app/products/[id]/page.tsx` (полностью), `admin/src/lib/api.ts`, `admin/src/components/ui/Toaster.tsx`, `admin/Dockerfile`, `.github/workflows/deploy.yml`
- Test: `admin/e2e/product-form.spec.ts`

**Interfaces:**
- Produces (для задач 2–7):
  - `productForm.ts`: `type ApiProduct`, `type NamedOption = { id: number; name?: Translatable; parent_id?: number | null }`, `type ProductFormValues`, `productSchema`, `emptyProductValues(): ProductFormValues`, `toFormValues(p: ApiProduct): ProductFormValues`, `toFormData(values: ProductFormValues, isUpdate: boolean): FormData`, `markup(price: string, purchase: string): number | null`, `categoryOptions(c: NamedOption[]): SelectOption[]`, `brandOptions(b: NamedOption[]): SelectOption[]`, `type SelectOption = { value: string; label: string }`.
  - `LocaleSwitch`: `export const LOCALES = ['ru','kk'] as const; export type Locale`; props `{ value, onChange, missing?, invalid? }`.
  - `Collapsible` props `{ id, title, summary?, note?, open, onToggle(open: boolean), disabledHint?, plain?, children }`.
  - `SaveBar` props `{ dirty, canSave, saving, status?, onSave, onReset }`.
  - `FormCard` props `{ id, title, aside?, className?, children }`.
  - `ProductForm` внутреннее состояние: `open: ReadonlySet<string>`, `toggle(id) => (open: boolean) => void`, `basicLocale`/`seoLocale`, `rootRef`.
  - `STOREFRONT_URL` из `@/lib/api`.

- [ ] **Step 1: Написать падающий e2e**

`admin/e2e/product-form.spec.ts`:

```ts
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { adminApi } from "./adminApi";
import { ADMIN_SESSION } from "./session";

/**
 * Карточка товара: создание и правка на одной странице.
 *
 * Каждый тест заводит свой выключенный товар через API (на витрину он не
 * попадает) и удаляет его в afterEach — общие товары прогона приёмки не
 * трогаются.
 */
test.use({ storageState: ADMIN_SESSION });

let created: number[] = [];

test.beforeEach(() => {
  created = [];
});

test.afterEach(async ({ request }) => {
  const api = adminApi(request);

  for (const id of created) {
    await api.delete(`/admin/products/${id}`);
  }
});

type Draft = { id: number; name: string; slug: string };

async function draftProduct(request: APIRequestContext, extra: Record<string, unknown> = {}): Promise<Draft> {
  const name = `E2E товар ${Date.now()}`;
  const body = await adminApi(request).create<{ data: { id: number; slug: string } }>("/admin/products", {
    name: { ru: name },
    retail_price: "1000",
    is_active: false,
    ...extra,
  });
  created.push(body.data.id);

  return { id: body.data.id, name, slug: body.data.slug };
}

/** id товара из адреса после создания через форму. */
function rememberCreated(page: Page): number {
  const id = Number(new URL(page.url()).pathname.split("/").pop());
  created.push(id);

  return id;
}

const saveButton = (page: Page) => page.getByRole("button", { name: "Сохранить", exact: true });

test("правка сохраняется, страница остаётся открытой", async ({ page, request }) => {
  const product = await draftProduct(request);

  await page.goto(`/products/${product.id}`);
  await expect(page.getByRole("heading", { level: 1, name: product.name })).toBeVisible();
  await expect(page.getByText("Скрыт", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Открыть на сайте ↗" })).toHaveAttribute("href", new RegExp(`/product/${product.slug}$`));
  await expect(saveButton(page)).toBeDisabled();

  await page.getByLabel("Розничная", { exact: true }).fill("1480");
  await expect(page.getByText("Есть несохранённые изменения")).toBeVisible();
  await saveButton(page).click();

  await expect(page.getByText("Сохранено", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(`/products/${product.id}`);
  await expect(saveButton(page)).toBeDisabled();

  await page.reload();
  await expect(page.getByLabel("Розничная", { exact: true })).toHaveValue("1480");
});

test("панель сохранения на виду, тост её не закрывает", async ({ page, request }) => {
  const product = await draftProduct(request);

  await page.goto(`/products/${product.id}`);
  const bar = page.getByRole("region", { name: "Сохранение" });
  await expect(bar).toBeInViewport();

  await page.getByLabel("Розничная", { exact: true }).fill("1234");
  await saveButton(page).click();

  const toast = page.getByText("Сохранено", { exact: true });
  await expect(toast).toBeVisible();
  const toastBox = (await toast.boundingBox())!;
  const saveBox = (await saveButton(page).boundingBox())!;
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(saveBox.y);
});

test("наценка к закупочной считается на лету", async ({ page, request }) => {
  const product = await draftProduct(request);

  await page.goto(`/products/${product.id}`);
  await page.getByRole("button", { name: /^Закупочная, минимальная цена/ }).click();
  await page.getByLabel("Закупочная цена").fill("1000");
  await page.getByLabel("Розничная", { exact: true }).fill("1480");
  await page.getByLabel("Оптовая (B2B)").fill("900");

  const line = page.getByTestId("markup");
  await expect(line).toContainText("розница +48 %");
  await expect(line).toContainText("опт -10 %");
});

test("пустое название — ошибка под полем, запрос не уходит", async ({ page, request }) => {
  const product = await draftProduct(request);
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes(`/admin/products/${product.id}`)) {
      posts.push(r.url());
    }
  });

  await page.goto(`/products/${product.id}`);
  await page.getByLabel("Название *").fill("");
  await saveButton(page).click();

  await expect(page.getByText("Обязательное поле")).toBeVisible();
  expect(posts).toEqual([]);
});

test("«Отменить» возвращает сохранённое", async ({ page, request }) => {
  const product = await draftProduct(request);

  await page.goto(`/products/${product.id}`);
  await page.getByLabel("Название *").fill("Совсем другое");
  await page.getByRole("button", { name: "Отменить" }).click();

  await expect(page.getByLabel("Название *")).toHaveValue(product.name);
  await expect(saveButton(page)).toBeDisabled();
});

test("RU и KZ: набранное не теряется, казахский перевод можно стереть", async ({ page, request }) => {
  const product = await draftProduct(request, { name: { ru: `E2E товар ${Date.now()}`, kk: "Қазақша атауы" } });
  const kz = page.getByRole("button", { name: /^KZ/ });
  const ruButton = page.getByRole("button", { name: /^RU/ }).first();

  await page.goto(`/products/${product.id}`);
  await page.getByLabel("Описание", { exact: true }).fill("Описание по-русски");
  await kz.first().click();
  await expect(page.getByLabel("Название на казахском")).toHaveValue("Қазақша атауы");
  await page.getByLabel("Название на казахском").fill("");
  await expect(kz.first()).toHaveAccessibleName(/не заполнено/);
  await ruButton.click();
  await expect(page.getByLabel("Описание", { exact: true })).toHaveValue("Описание по-русски");

  await saveButton(page).click();
  await expect(page.getByText("Сохранено", { exact: true })).toBeVisible();

  await page.reload();
  await kz.first().click();
  await expect(page.getByLabel("Название на казахском")).toHaveValue("");
});

test("SEO: превью адреса и предупреждение о старых ссылках", async ({ page, request }) => {
  const product = await draftProduct(request);
  const slug = `e2e-slug-${Date.now()}`;

  await page.goto(`/products/${product.id}`);
  await page.getByRole("button", { name: /^SEO — адрес и поисковики/ }).click();
  await expect(page.getByLabel("Адрес страницы")).toHaveValue(product.slug);
  await expect(page.getByText("Старые ссылки на товар перестанут работать.")).toHaveCount(0);

  await page.getByLabel("Адрес страницы").fill(slug);
  await expect(page.getByText(`/product/${slug}`)).toBeVisible();
  await expect(page.getByText("Старые ссылки на товар перестанут работать.")).toBeVisible();
  await expect(page.getByText("0 / 60").first()).toBeVisible();
});

test("несуществующий товар — «Товар не найден»", async ({ page }) => {
  await page.goto("/products/999999999");

  await expect(page.getByText("Товар не найден")).toBeVisible();
  await expect(page.getByRole("link", { name: "К списку товаров" })).toBeVisible();
});

test("новый товар: одно нажатие — один товар, после сохранения та же страница", async ({ page }) => {
  const name = `E2E новый ${Date.now()}`;
  const creates: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/admin\/products$/.test(r.url())) {
      creates.push(r.url());
    }
  });

  await page.goto("/products/create");
  await expect(page.getByRole("heading", { level: 1, name: "Новый товар" })).toBeVisible();
  await page.getByLabel("Название *").fill(name);
  await page.getByLabel("Розничная", { exact: true }).fill("2500");
  await saveButton(page).dblclick();

  await expect(page).toHaveURL(/\/products\/\d+$/);
  rememberCreated(page);
  await expect(page.getByText("Товар создан")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  expect(creates).toHaveLength(1);
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `cd admin && PW e2e/product-form.spec.ts --project=Desktop --reporter=list`
Expected: FAIL — нет заголовка с названием (старая страница пишет «Edit Product»), нет «Розничная».

- [ ] **Step 3: `STOREFRONT_URL`, Dockerfile, deploy.yml**

В `admin/src/lib/api.ts` после `ERP_ADMIN_URL`:

```ts
/** Витрина (`shop.paradise.kz`) — ссылка «Открыть на сайте» и превью адреса товара. */
export const STOREFRONT_URL = (process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000').replace(/\/$/, '');
```

В `admin/Dockerfile` заменить блок ARG/ENV:

```dockerfile
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STOREFRONT_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_STOREFRONT_URL=$NEXT_PUBLIC_STOREFRONT_URL \
    NEXT_TELEMETRY_DISABLED=1
```

В `.github/workflows/deploy.yml`, шаг «Build & push admin image», `build-args`:

```yaml
          build-args: |
            NEXT_PUBLIC_API_URL=https://api.paradise.kz/api
            NEXT_PUBLIC_STOREFRONT_URL=https://shop.paradise.kz
```

- [ ] **Step 4: `productForm.ts`**

`admin/src/components/products/form/productForm.ts`:

```ts
import { z } from 'zod';
import { LOCALES } from '@/components/ui/LocaleSwitch';
import type { SelectOption } from '@/components/ui/SearchSelect';
import { TENGE_PATTERN, tiynToTenge } from '@/lib/money';
import { ru, type Translatable } from '@/lib/text';
import { REQUIRED, SLUG_PATTERN } from '@/lib/validation';

/**
 * Форма товара без React: схема, перевод товара из API в значения формы и
 * обратно, производные величины для подсказок.
 */

/** Товар, как его отдаёт `GET /admin/products/{id}` (переводы — объектом {ru, kk}). */
export type ApiProduct = {
  id: number;
  name: Translatable;
  description: Translatable;
  seo_title: Translatable;
  seo_description: Translatable;
  slug: string | null;
  code: string | null;
  article: string | null;
  category_id: number | null;
  brand_id: number | null;
  retail_price: number | null;
  b2b_price: number | null;
  compare_at_price: number | null;
  min_price: number | null;
  purchase_price: number | null;
  b2b_min_order_qty: number | null;
  uom: string | null;
  weight: string | number | null;
  volume: string | number | null;
  country: string | null;
  supplier: string | null;
  is_active: boolean;
  is_new_arrival: boolean;
  /** Проекция складского журнала, decimal:3. Сразу после создания в ответе её нет. */
  stock?: string | number | null;
};

/** Категория или бренд из `/admin/categories`, `/admin/brands`. */
export type NamedOption = { id: number; name?: Translatable; parent_id?: number | null };

const MONEY = 'Сумма в ₸, до двух знаков после точки';
const DECIMAL_3 = /^\d+(\.\d{1,3})?$/;

const upTo = (n: number) => z.string().max(n, `Не длиннее ${n} символов`);
const money = z.string().refine((v) => v === '' || TENGE_PATTERN.test(v), MONEY);
const decimal3 = z.string().refine((v) => v === '' || DECIMAL_3.test(v), 'Число, до трёх знаков после точки');

export const productSchema = z.object({
  name: z.object({ ru: z.string().trim().min(1, REQUIRED).max(255, 'Не длиннее 255 символов'), kk: upTo(255) }),
  description: z.object({ ru: z.string(), kk: z.string() }),
  seo_title: z.object({ ru: upTo(255), kk: upTo(255) }),
  seo_description: z.object({ ru: upTo(1000), kk: upTo(1000) }),
  slug: z.string().refine((v) => v === '' || SLUG_PATTERN.test(v), 'Только латиница в нижнем регистре, цифры и дефис'),
  code: upTo(255),
  article: upTo(255),
  category_id: z.string(),
  brand_id: z.string(),
  retail_price: money,
  b2b_price: money,
  compare_at_price: money,
  min_price: money,
  purchase_price: money,
  b2b_min_order_qty: z
    .string()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 1_000_000), 'Целое число от 1'),
  uom: upTo(50),
  weight: decimal3,
  volume: decimal3,
  country: upTo(255),
  supplier: upTo(255),
  is_active: z.boolean(),
  is_new_arrival: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export type MoneyField = 'retail_price' | 'b2b_price' | 'compare_at_price' | 'min_price' | 'purchase_price';

const TRANSLATABLE = ['name', 'description', 'seo_title', 'seo_description'] as const;

const SCALARS = [
  'slug', 'code', 'article', 'category_id', 'brand_id',
  'retail_price', 'b2b_price', 'compare_at_price', 'min_price', 'purchase_price',
  'b2b_min_order_qty', 'uom', 'weight', 'volume', 'country', 'supplier',
] as const;

const pair = (value: Translatable): { ru: string; kk: string } =>
  typeof value === 'string' ? { ru: value, kk: '' } : { ru: value?.ru ?? '', kk: value?.kk ?? '' };

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

/** decimal:3 из API («54.000») — без хвостовых нулей. */
const decimalText = (value: unknown): string => (value === null || value === undefined || value === '' ? '' : String(Number(value)));

export const emptyProductValues = (): ProductFormValues => ({
  name: { ru: '', kk: '' },
  description: { ru: '', kk: '' },
  seo_title: { ru: '', kk: '' },
  seo_description: { ru: '', kk: '' },
  slug: '', code: '', article: '', category_id: '', brand_id: '',
  retail_price: '', b2b_price: '', compare_at_price: '', min_price: '', purchase_price: '',
  b2b_min_order_qty: '', uom: '', weight: '', volume: '', country: '', supplier: '',
  is_active: true,
  is_new_arrival: false,
});

export const toFormValues = (p: ApiProduct): ProductFormValues => ({
  name: pair(p.name),
  description: pair(p.description),
  seo_title: pair(p.seo_title),
  seo_description: pair(p.seo_description),
  slug: text(p.slug),
  code: text(p.code),
  article: text(p.article),
  category_id: text(p.category_id),
  brand_id: text(p.brand_id),
  retail_price: tiynToTenge(p.retail_price),
  b2b_price: tiynToTenge(p.b2b_price),
  compare_at_price: tiynToTenge(p.compare_at_price),
  min_price: tiynToTenge(p.min_price),
  purchase_price: tiynToTenge(p.purchase_price),
  b2b_min_order_qty: text(p.b2b_min_order_qty),
  uom: text(p.uom),
  weight: decimalText(p.weight),
  volume: decimalText(p.volume),
  country: text(p.country),
  supplier: text(p.supplier),
  is_active: p.is_active ?? true,
  is_new_arrival: p.is_new_arrival ?? false,
});

/**
 * Тело `POST /admin/products` (или правки с `_method=PUT`). Оба языка и все
 * скалярные поля уходят всегда: пустая строка на сервере становится null,
 * так очищенное в форме поле очищается и в базе.
 */
export function toFormData(values: ProductFormValues, isUpdate: boolean): FormData {
  const data = new FormData();

  for (const field of TRANSLATABLE) {
    for (const locale of LOCALES) {
      data.append(`${field}[${locale}]`, values[field][locale]);
    }
  }

  for (const field of SCALARS) {
    data.append(field, values[field]);
  }

  data.append('is_active', values.is_active ? '1' : '0');
  data.append('is_new_arrival', values.is_new_arrival ? '1' : '0');

  if (isUpdate) {
    // Laravel не разбирает multipart у PUT — метод подменяется полем.
    data.append('_method', 'PUT');
  }

  return data;
}

/** Наценка цены к закупочной в процентах; null — считать не из чего. */
export function markup(price: string, purchase: string): number | null {
  const sell = Number(price);
  const cost = Number(purchase);

  if (price === '' || purchase === '' || !Number.isFinite(sell) || !Number.isFinite(cost) || cost <= 0) {
    return null;
  }

  return Math.round(((sell - cost) / cost) * 100);
}

const byLabel = (a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label, 'ru');

/** Категории с полным путём «Диваны › Прямые» — путь собирается по parent_id. */
export function categoryOptions(categories: NamedOption[]): SelectOption[] {
  const byId = new Map(categories.map((c) => [c.id, c]));

  const path = (category: NamedOption): string => {
    const names: string[] = [];
    const seen = new Set<number>();
    let current: NamedOption | undefined = category;

    // seen — на случай цикла в parent_id: список не должен зависнуть.
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(ru(current.name) || `#${current.id}`);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }

    return names.join(' › ');
  };

  return categories.map((c) => ({ value: String(c.id), label: path(c) })).sort(byLabel);
}

export const brandOptions = (brands: NamedOption[]): SelectOption[] =>
  brands.map((b) => ({ value: String(b.id), label: ru(b.name) || `#${b.id}` })).sort(byLabel);
```

`SelectOption` импортируется из `SearchSelect`, который появится в задаче 4. Чтобы задача 1 собиралась, создать сейчас `admin/src/components/ui/SearchSelect.tsx` только с типом (компонент допишет задача 4):

```ts
export type SelectOption = { value: string; label: string };
```

- [ ] **Step 5: `LocaleSwitch`, `Switch`, `Collapsible`**

`admin/src/components/ui/LocaleSwitch.tsx`:

```tsx
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
```

`admin/src/components/ui/Switch.tsx`:

```tsx
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
```

`admin/src/components/ui/Collapsible.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import { cardClass } from './styles';

type Props = {
  id: string;
  title: string;
  /** Справа в заголовке: «2 цены», «нет», «заполнено». */
  summary?: ReactNode;
  /** Под заголовком мелко: «Сохраняется сразу». */
  note?: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  /** Блок заблокирован (товар ещё не сохранён): видна причина, содержимого нет. */
  disabledHint?: string;
  /** Без своей карточки — для блока внутри другой карточки. */
  plain?: boolean;
  children: ReactNode;
};

/**
 * Сворачиваемый блок. Содержимое свёрнутого остаётся в DOM (`hidden`): поля
 * в нём по-прежнему в форме, а списки внутри успевают загрузиться и отдать
 * счётчик для заголовка. `scroll-mt-*` — чтобы при переходе к блоку его не
 * закрывала липкая шапка.
 */
export default function Collapsible({ id, title, summary, note, open, onToggle, disabledHint, plain, children }: Props) {
  const panelId = `${id}-panel`;
  const locked = disabledHint !== undefined;
  const expanded = open && !locked;

  return (
    <section id={id} className={`scroll-mt-36 lg:scroll-mt-4 ${plain ? 'rounded-lg border border-dashed border-zinc-300' : cardClass}`}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        disabled={locked}
        onClick={() => onToggle(!open)}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-not-allowed md:px-5"
      >
        <span aria-hidden className={`text-zinc-400 transition-transform ${expanded ? 'rotate-90' : ''}`}>▸</span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold ${locked ? 'text-zinc-400' : 'text-zinc-900'}`}>{title}</span>
          {(locked ? disabledHint : note) && <span className="block text-xs text-zinc-500">{locked ? disabledHint : note}</span>}
        </span>
        {!locked && summary && <span className="shrink-0 text-xs text-zinc-500">{summary}</span>}
      </button>
      {!locked && (
        <div id={panelId} hidden={!open} className="border-t border-zinc-100 px-4 py-4 md:px-5">
          {children}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 6: `SaveBar` и отступ тостов**

`admin/src/components/ui/SaveBar.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { buttonPrimary, buttonSecondary } from './styles';

type Props = {
  dirty: boolean;
  canSave: boolean;
  saving: boolean;
  /** Ход долгого сохранения: «Загружаем фото 2 из 5». */
  status?: string | null;
  onSave: () => void;
  onReset: () => void;
};

/**
 * Нижняя панель «Отменить / Сохранить».
 *
 * До `lg` — `fixed` над нижней навигацией (BottomNav: h-16 + safe-area), а не
 * поверх неё; странице нужен нижний отступ под панель. С `lg` нижней
 * навигации нет — панель прилипает к низу прокручиваемого `<main>`.
 * `--save-bar-h` поднимает тосты (Toaster) над панелью.
 */
export default function SaveBar({ dirty, canSave, saving, status, onSave, onReset }: Props) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--save-bar-h', '4.5rem');

    return () => root.style.removeProperty('--save-bar-h');
  }, []);

  return (
    <div
      role="region"
      aria-label="Сохранение"
      className="fixed inset-x-0 bottom-[calc(4rem_+_env(safe-area-inset-bottom))] z-30 border-t border-zinc-200 bg-white py-2 pl-[calc(1rem_+_env(safe-area-inset-left))] pr-[calc(1rem_+_env(safe-area-inset-right))] shadow-[0_-2px_8px_rgba(0,0,0,0.06)] lg:sticky lg:bottom-0 lg:mt-6 lg:rounded-xl lg:border lg:px-5 lg:py-3"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm" aria-live="polite">
          {status ? (
            <span className="text-zinc-600">{status}</span>
          ) : dirty ? (
            <span className="text-amber-700">● Есть несохранённые изменения</span>
          ) : null}
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" className={buttonSecondary} disabled={!dirty || saving} onClick={onReset}>
            Отменить
          </button>
          <button type="button" className={buttonPrimary} disabled={!canSave || saving} onClick={onSave}>
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

В `admin/src/components/ui/Toaster.tsx` в `className` контейнера заменить `bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))]` на `bottom-[calc(4.75rem_+_var(--save-bar-h,0px)_+_env(safe-area-inset-bottom))]` и `lg:bottom-4` на `lg:bottom-[calc(1rem_+_var(--save-bar-h,0px))]`.

- [ ] **Step 7: `FormCard` и разделы**

`admin/src/components/products/form/FormCard.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cardClass } from '@/components/ui/styles';

type Props = { id: string; title: string; aside?: ReactNode; className?: string; children: ReactNode };

/** Карточка раздела формы. `id` — якорь для полосы быстрых переходов. */
export default function FormCard({ id, title, aside, className = '', children }: Props) {
  const headingId = `${id}-title`;

  return (
    <section id={id} aria-labelledby={headingId} className={`${cardClass} scroll-mt-36 space-y-4 p-4 md:p-5 lg:scroll-mt-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-base font-semibold text-zinc-900">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
```

`admin/src/components/products/form/BasicSection.tsx`:

```tsx
'use client';

import { useWatch, type UseFormReturn } from 'react-hook-form';
import Field from '@/components/ui/Field';
import LocaleSwitch, { LOCALES, type Locale } from '@/components/ui/LocaleSwitch';
import { inputClass } from '@/components/ui/styles';
import FormCard from './FormCard';
import type { ProductFormValues } from './productForm';

type Props = {
  form: UseFormReturn<ProductFormValues>;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  className?: string;
};

export default function BasicSection({ form, locale, onLocaleChange, className }: Props) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const name = useWatch({ control, name: 'name' });
  const missingKk = name.ru.trim() !== '' && name.kk.trim() === '';

  return (
    <FormCard
      id="basic"
      title="Основное"
      className={className}
      aside={
        <LocaleSwitch
          value={locale}
          onChange={onLocaleChange}
          missing={{ kk: missingKk }}
          invalid={{
            ru: Boolean(errors.name?.ru || errors.description?.ru),
            kk: Boolean(errors.name?.kk || errors.description?.kk),
          }}
        />
      }
    >
      {LOCALES.map((l) => (
        <div key={l} hidden={locale !== l} className="space-y-4">
          <Field label={l === 'ru' ? 'Название *' : 'Название на казахском'} htmlFor={`name-${l}`} error={errors.name?.[l]?.message}>
            <input id={`name-${l}`} className={inputClass} aria-invalid={errors.name?.[l] ? true : undefined} {...register(`name.${l}`)} />
          </Field>
          <Field label={l === 'ru' ? 'Описание' : 'Описание на казахском'} htmlFor={`description-${l}`} error={errors.description?.[l]?.message}>
            <textarea
              id={`description-${l}`}
              rows={5}
              className={`${inputClass} resize-y`}
              aria-invalid={errors.description?.[l] ? true : undefined}
              {...register(`description.${l}`)}
            />
          </Field>
        </div>
      ))}
      {missingKk && (
        <p className="text-xs text-zinc-500">
          <span className="text-amber-500">●</span> — казахский перевод не заполнен
        </p>
      )}
    </FormCard>
  );
}
```

`admin/src/components/products/form/PriceSection.tsx`:

```tsx
'use client';

import { useWatch, type UseFormReturn } from 'react-hook-form';
import Collapsible from '@/components/ui/Collapsible';
import Field from '@/components/ui/Field';
import MoneyInput from '@/components/ui/MoneyInput';
import { inputClass } from '@/components/ui/styles';
import FormCard from './FormCard';
import { markup, type MoneyField, type ProductFormValues } from './productForm';

type Props = {
  form: UseFormReturn<ProductFormValues>;
  extrasOpen: boolean;
  onExtrasToggle: (open: boolean) => void;
  className?: string;
};

export default function PriceSection({ form, extrasOpen, onExtrasToggle, className }: Props) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const [retail, b2b, purchase] = useWatch({ control, name: ['retail_price', 'b2b_price', 'purchase_price'] });
  const markups = (
    [
      ['розница', markup(retail, purchase)],
      ['опт', markup(b2b, purchase)],
    ] as const
  ).filter((entry): entry is readonly [string, number] => entry[1] !== null);

  const money = (name: MoneyField, label: string, hint?: string) => (
    <Field label={label} htmlFor={name} hint={hint} error={errors[name]?.message}>
      <MoneyInput id={name} aria-invalid={errors[name] ? true : undefined} {...register(name)} />
    </Field>
  );

  return (
    <FormCard id="price" title="Цены, ₸" className={className}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {money('retail_price', 'Розничная')}
        {money('b2b_price', 'Оптовая (B2B)')}
        {money('compare_at_price', 'Старая цена', 'Зачёркнутая на витрине, если выше розничной')}
      </div>

      {markups.length > 0 && (
        <p className="text-sm text-zinc-600" data-testid="markup">
          Наценка к закупочной:{' '}
          {markups.map(([label, value], index) => (
            <span key={label}>
              {index > 0 && ', '}
              {label}{' '}
              <span className={value < 0 ? 'text-red-600' : 'text-green-700'}>
                {value > 0 ? '+' : ''}
                {value} %
              </span>
            </span>
          ))}
        </p>
      )}

      <Collapsible id="price-extra" plain title="Закупочная, минимальная цена, мин. партия B2B" open={extrasOpen} onToggle={onExtrasToggle}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {money('purchase_price', 'Закупочная цена')}
          {money('min_price', 'Минимальная цена', 'Ниже неё не опустит цену персональная скидка клиента')}
          <Field
            label="Мин. партия B2B, шт"
            htmlFor="b2b_min_order_qty"
            hint="Пусто — общее значение из настроек каталога"
            error={errors.b2b_min_order_qty?.message}
          >
            <input
              id="b2b_min_order_qty"
              type="number"
              step="1"
              min="1"
              inputMode="numeric"
              className={inputClass}
              aria-invalid={errors.b2b_min_order_qty ? true : undefined}
              {...register('b2b_min_order_qty')}
            />
          </Field>
        </div>
      </Collapsible>
    </FormCard>
  );
}
```

`admin/src/components/products/form/SeoSection.tsx`:

```tsx
'use client';

import { useWatch, type UseFormReturn } from 'react-hook-form';
import Collapsible from '@/components/ui/Collapsible';
import Field from '@/components/ui/Field';
import LocaleSwitch, { LOCALES, type Locale } from '@/components/ui/LocaleSwitch';
import { inputClass } from '@/components/ui/styles';
import { STOREFRONT_URL } from '@/lib/api';
import type { ProductFormValues } from './productForm';

const STOREFRONT_HOST = STOREFRONT_URL.replace(/^https?:\/\//, '');

type Props = {
  form: UseFormReturn<ProductFormValues>;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  /** Адрес, сохранённый в базе; null у нового товара. */
  savedSlug: string | null;
  open: boolean;
  onToggle: (open: boolean) => void;
};

/** Счётчик-ориентир для поисковиков: превышение — жёлтым, но не ошибка. */
function Counter({ value, max }: { value: string; max: number }) {
  return (
    <p className={`text-right text-xs ${value.length > max ? 'text-amber-600' : 'text-zinc-400'}`}>
      {value.length} / {max}
    </p>
  );
}

export default function SeoSection({ form, locale, onLocaleChange, savedSlug, open, onToggle }: Props) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const [slug, title, description] = useWatch({ control, name: ['slug', 'seo_title', 'seo_description'] });
  const slugChanged = Boolean(savedSlug) && slug !== savedSlug;
  const filled = slug !== '' || [title, description].some((p) => p.ru !== '' || p.kk !== '');
  const missingKk = (title.ru !== '' && title.kk === '') || (description.ru !== '' && description.kk === '');

  return (
    <Collapsible
      id="seo"
      title="SEO — адрес и поисковики"
      summary={filled ? 'заполнено' : 'заполнено автоматически'}
      open={open}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        <Field
          label="Адрес страницы"
          htmlFor="slug"
          hint={slug === '' ? 'Пусто — создастся из названия' : undefined}
          error={errors.slug?.message}
        >
          <input id="slug" className={inputClass} placeholder="divan-atlanta" aria-invalid={errors.slug ? true : undefined} {...register('slug')} />
        </Field>
        <p className="break-all text-xs text-zinc-500">
          {STOREFRONT_HOST}/product/{slug || '…'}
        </p>
        {slugChanged && (
          <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Старые ссылки на товар перестанут работать.
          </p>
        )}

        <div className="flex justify-end">
          <LocaleSwitch
            value={locale}
            onChange={onLocaleChange}
            missing={{ kk: missingKk }}
            invalid={{
              ru: Boolean(errors.seo_title?.ru || errors.seo_description?.ru),
              kk: Boolean(errors.seo_title?.kk || errors.seo_description?.kk),
            }}
          />
        </div>

        {LOCALES.map((l) => (
          <div key={l} hidden={locale !== l} className="space-y-4">
            <Field
              label={l === 'ru' ? 'Заголовок для поисковиков' : 'Заголовок для поисковиков на казахском'}
              htmlFor={`seo_title-${l}`}
              error={errors.seo_title?.[l]?.message}
            >
              <input
                id={`seo_title-${l}`}
                className={inputClass}
                placeholder="Пусто — возьмём название"
                aria-invalid={errors.seo_title?.[l] ? true : undefined}
                {...register(`seo_title.${l}`)}
              />
              <Counter value={title[l]} max={60} />
            </Field>
            <Field
              label={l === 'ru' ? 'Описание для поисковиков' : 'Описание для поисковиков на казахском'}
              htmlFor={`seo_description-${l}`}
              error={errors.seo_description?.[l]?.message}
            >
              <textarea
                id={`seo_description-${l}`}
                rows={3}
                className={`${inputClass} resize-y`}
                placeholder="Пусто — возьмём название"
                aria-invalid={errors.seo_description?.[l] ? true : undefined}
                {...register(`seo_description.${l}`)}
              />
              <Counter value={description[l]} max={160} />
            </Field>
          </div>
        ))}
      </div>
    </Collapsible>
  );
}
```

Место SEO-блока в ленте на телефоне задаёт обёртка `<div className="order-13 lg:order-none">` в `ProductForm` — своего `className` у `SeoSection` нет.

`admin/src/components/products/form/StatusCard.tsx`:

```tsx
'use client';

import { Controller, type UseFormReturn } from 'react-hook-form';
import Switch from '@/components/ui/Switch';
import FormCard from './FormCard';
import type { ProductFormValues } from './productForm';

export default function StatusCard({ form, className }: { form: UseFormReturn<ProductFormValues>; className?: string }) {
  return (
    <FormCard id="status" title="Статус" className={className}>
      <div className="space-y-1">
        <Controller
          control={form.control}
          name="is_active"
          render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Показывать на витрине" />}
        />
        <Controller
          control={form.control}
          name="is_new_arrival"
          render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Новинка" />}
        />
      </div>
    </FormCard>
  );
}
```

`admin/src/components/products/form/CatalogCard.tsx` (в задаче 4 `select` заменится на поиск):

```tsx
'use client';

import { useMemo } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import Field from '@/components/ui/Field';
import { inputClass } from '@/components/ui/styles';
import FormCard from './FormCard';
import { brandOptions, categoryOptions, type NamedOption, type ProductFormValues } from './productForm';

type Props = { form: UseFormReturn<ProductFormValues>; categories: NamedOption[]; brands: NamedOption[]; className?: string };

export default function CatalogCard({ form, categories, brands, className }: Props) {
  const { register, formState: { errors } } = form;
  const categoryList = useMemo(() => categoryOptions(categories), [categories]);
  const brandList = useMemo(() => brandOptions(brands), [brands]);

  return (
    <FormCard id="catalog" title="Каталог" className={className}>
      <Field label="Категория" htmlFor="category_id" error={errors.category_id?.message}>
        <select id="category_id" className={inputClass} aria-invalid={errors.category_id ? true : undefined} {...register('category_id')}>
          <option value="">Без категории</option>
          {categoryList.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Бренд" htmlFor="brand_id" error={errors.brand_id?.message}>
        <select id="brand_id" className={inputClass} aria-invalid={errors.brand_id ? true : undefined} {...register('brand_id')}>
          <option value="">Без бренда</option>
          {brandList.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>
    </FormCard>
  );
}
```

`admin/src/components/products/form/AccountingCard.tsx`:

```tsx
'use client';

import type { UseFormReturn } from 'react-hook-form';
import Field from '@/components/ui/Field';
import { inputClass } from '@/components/ui/styles';
import FormCard from './FormCard';
import type { ProductFormValues } from './productForm';

export default function AccountingCard({ form, className }: { form: UseFormReturn<ProductFormValues>; className?: string }) {
  const { register, formState: { errors } } = form;

  return (
    <FormCard id="accounting" title="Учёт" className={className}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Код" htmlFor="code" error={errors.code?.message}>
          <input id="code" className={inputClass} placeholder="00123" aria-invalid={errors.code ? true : undefined} {...register('code')} />
        </Field>
        <Field label="Артикул" htmlFor="article" error={errors.article?.message}>
          <input id="article" className={inputClass} placeholder="ART-0042" aria-invalid={errors.article ? true : undefined} {...register('article')} />
        </Field>
      </div>
      <Field label="Единица измерения" htmlFor="uom" error={errors.uom?.message}>
        <input id="uom" className={inputClass} placeholder="шт" aria-invalid={errors.uom ? true : undefined} {...register('uom')} />
      </Field>
    </FormCard>
  );
}
```

`admin/src/components/products/form/StockCard.tsx`:

```tsx
import Link from 'next/link';
import { buttonLink } from '@/components/ui/styles';
import { formatQuantity } from '@/lib/text';
import FormCard from './FormCard';
import type { ApiProduct } from './productForm';

/** Остаток только для чтения: его двигают приёмки, заказы и списания (FifoInventoryService). */
export default function StockCard({ product, className }: { product: ApiProduct; className?: string }) {
  return (
    <FormCard id="stock" title="Остаток" className={className}>
      <p className="text-2xl font-semibold text-zinc-900" data-testid="stock-value">
        {formatQuantity(product.stock ?? 0)} {product.uom || 'шт'}
      </p>
      <p className="text-xs text-zinc-500">Меняется приёмками, заказами и списаниями</p>
      <div className="flex flex-wrap gap-x-4">
        <Link href="/stock" className={buttonLink}>По складам →</Link>
        <Link href="/stock-movements" className={buttonLink}>Движения →</Link>
      </div>
    </FormCard>
  );
}
```

`admin/src/components/products/form/DimensionsCard.tsx`:

```tsx
'use client';

import type { UseFormReturn } from 'react-hook-form';
import Field from '@/components/ui/Field';
import { inputClass } from '@/components/ui/styles';
import FormCard from './FormCard';
import type { ProductFormValues } from './productForm';

export default function DimensionsCard({ form, className }: { form: UseFormReturn<ProductFormValues>; className?: string }) {
  const { register, formState: { errors } } = form;
  const decimal = { type: 'number', step: '0.001', min: '0', inputMode: 'decimal' } as const;

  return (
    <FormCard id="dimensions" title="Габариты и происхождение" className={className}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Вес, кг" htmlFor="weight" error={errors.weight?.message}>
          <input id="weight" {...decimal} className={inputClass} aria-invalid={errors.weight ? true : undefined} {...register('weight')} />
        </Field>
        <Field label="Объём, м³" htmlFor="volume" error={errors.volume?.message}>
          <input id="volume" {...decimal} className={inputClass} aria-invalid={errors.volume ? true : undefined} {...register('volume')} />
        </Field>
      </div>
      <Field label="Страна" htmlFor="country" error={errors.country?.message}>
        <input id="country" className={inputClass} placeholder="Казахстан" aria-invalid={errors.country ? true : undefined} {...register('country')} />
      </Field>
      <Field label="Поставщик" htmlFor="supplier" error={errors.supplier?.message}>
        <input id="supplier" className={inputClass} placeholder="ТОО Поставщик" aria-invalid={errors.supplier ? true : undefined} {...register('supplier')} />
      </Field>
    </FormCard>
  );
}
```

`admin/src/components/products/form/ProductFormSkeleton.tsx`:

```tsx
/** Заглушка двух колонок, пока грузятся товар и справочники. */
export default function ProductFormSkeleton() {
  const block = 'animate-pulse rounded-xl bg-zinc-200/70';

  return (
    <div role="status" aria-busy="true" aria-label="Загрузка товара" className="space-y-4">
      <div className={`${block} h-8 w-64`} />
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2">
          <div className={`${block} h-48`} />
          <div className={`${block} h-36`} />
          <div className={`${block} h-40`} />
        </div>
        <div className="space-y-4">
          <div className={`${block} h-28`} />
          <div className={`${block} h-36`} />
          <div className={`${block} h-32`} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: `ProductForm`**

`admin/src/components/products/form/ProductForm.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ProductRelations from '@/components/products/ProductRelations';
import type { Locale } from '@/components/ui/LocaleSwitch';
import PageHeader from '@/components/ui/PageHeader';
import SaveBar from '@/components/ui/SaveBar';
import { buttonSecondary, cardClass } from '@/components/ui/styles';
import api, { STOREFRONT_URL } from '@/lib/api';
import { applyServerErrors } from '@/lib/errors';
import { ru } from '@/lib/text';
import { toast } from '@/stores/toastStore';
import AccountingCard from './AccountingCard';
import BasicSection from './BasicSection';
import CatalogCard from './CatalogCard';
import DimensionsCard from './DimensionsCard';
import PriceSection from './PriceSection';
import SeoSection from './SeoSection';
import StatusCard from './StatusCard';
import StockCard from './StockCard';
import {
  emptyProductValues,
  productSchema,
  toFormData,
  toFormValues,
  type ApiProduct,
  type NamedOption,
  type ProductFormValues,
} from './productForm';

type Props = { initialProduct: ApiProduct | null; categories: NamedOption[]; brands: NamedOption[] };

/**
 * Карточка товара: создание и правка на одной странице.
 *
 * Основные поля — одна форма react-hook-form; сохраняет её кнопка нижней
 * панели. Элемента `<form>` нет намеренно: блоки со списками открывают
 * CrudModal со своим `<form>`, а Modal рисуется на месте, не в портале, —
 * вложенная форма в HTML недопустима.
 *
 * Раскладка: с `lg` две колонки; до `lg` колонки становятся `contents`, и
 * карточки выстраиваются одной лентой по своим `order-*`.
 */
export default function ProductForm({ initialProduct, categories, brands }: Props) {
  const [product, setProduct] = useState<ApiProduct | null>(initialProduct);
  const productId = product?.id ?? null;
  const rootRef = useRef<HTMLDivElement>(null);
  const [basicLocale, setBasicLocale] = useState<Locale>('ru');
  const [seoLocale, setSeoLocale] = useState<Locale>('ru');
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  const form = useForm<ProductFormValues>({
    // Схема не приводит типы (числа остаются строками) — вход и выход совпадают.
    resolver: zodResolver(productSchema) as unknown as Resolver<ProductFormValues>,
    defaultValues: initialProduct ? toFormValues(initialProduct) : emptyProductValues(),
  });
  const { isDirty, isSubmitting } = form.formState;

  const toggle = (id: string) => (next: boolean) =>
    setOpen((prev) => {
      const copy = new Set(prev);
      if (next) {
        copy.add(id);
      } else {
        copy.delete(id);
      }

      return copy;
    });

  const save = form.handleSubmit(async (values) => {
    const isCreate = productId === null;

    try {
      const res = await api.post<{ data: ApiProduct }>(
        isCreate ? '/admin/products' : `/admin/products/${productId}`,
        toFormData(values, !isCreate),
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      const saved = res.data.data;

      form.reset(toFormValues(saved));
      setProduct(saved);

      if (isCreate) {
        // Не router.replace: смена сегмента [id] могла бы перемонтировать
        // страницу вместе с формой. history.replaceState Next.js поддерживает
        // (docs: linking-and-navigating, «Native History API») — меняется
        // только адрес.
        window.history.replaceState(null, '', `/products/${saved.id}`);
        toast.success('Товар создан');
      } else {
        toast.success('Сохранено');
      }
    } catch (error) {
      const message = applyServerErrors(error, form.setError);

      if (message) {
        toast.error(message);
      }
    }
  });

  const title = product ? ru(product.name) || `Товар #${product.id}` : 'Новый товар';

  return (
    <div ref={rootRef} className="pb-24 lg:pb-0">
      <PageHeader
        title={title}
        back="/products"
        actions={
          product && (
            <>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  product.is_active ? 'bg-green-100 text-green-800' : 'bg-zinc-200 text-zinc-700'
                }`}
              >
                {product.is_active ? 'На витрине' : 'Скрыт'}
              </span>
              {product.slug && (
                <a href={`${STOREFRONT_URL}/product/${product.slug}`} target="_blank" rel="noopener noreferrer" className={buttonSecondary}>
                  Открыть на сайте ↗
                </a>
              )}
            </>
          )
        }
      />

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
        <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-4">
          <BasicSection form={form} locale={basicLocale} onLocaleChange={setBasicLocale} className="order-1 lg:order-none" />
          <PriceSection
            form={form}
            extrasOpen={open.has('price-extra')}
            onExtrasToggle={toggle('price-extra')}
            className="order-3 lg:order-none"
          />
          {productId !== null && (
            <section className={`${cardClass} order-9 p-4 md:p-5 lg:order-none`}>
              <ProductRelations productId={productId} />
            </section>
          )}
          <div className="order-13 lg:order-none">
            <SeoSection
              form={form}
              locale={seoLocale}
              onLocaleChange={setSeoLocale}
              savedSlug={product?.slug ?? null}
              open={open.has('seo')}
              onToggle={toggle('seo')}
            />
          </div>
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <StatusCard form={form} className="order-4 lg:order-none" />
          <CatalogCard form={form} categories={categories} brands={brands} className="order-5 lg:order-none" />
          <AccountingCard form={form} className="order-6 lg:order-none" />
          {product && <StockCard product={product} className="order-7 lg:order-none" />}
          <DimensionsCard form={form} className="order-8 lg:order-none" />
        </div>
      </div>

      <SaveBar
        dirty={isDirty}
        canSave={productId === null || isDirty}
        saving={isSubmitting}
        onSave={() => void save()}
        onReset={() => form.reset()}
      />
    </div>
  );
}
```

- [ ] **Step 9: Страница**

`admin/src/app/products/[id]/page.tsx` — заменить целиком:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { isAxiosError } from 'axios';
import ProductForm from '@/components/products/form/ProductForm';
import ProductFormSkeleton from '@/components/products/form/ProductFormSkeleton';
import type { ApiProduct, NamedOption } from '@/components/products/form/productForm';
import { buttonLink, buttonSecondary } from '@/components/ui/styles';
import api from '@/lib/api';

type Loaded = { product: ApiProduct | null; categories: NamedOption[]; brands: NamedOption[] };

type State = { status: 'loading' } | { status: 'ready'; data: Loaded } | { status: 'missing' } | { status: 'failed' };

const list = (body: unknown): NamedOption[] =>
  Array.isArray(body) ? body : ((body as { data?: NamedOption[] } | null)?.data ?? []);

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  // Читается один раз: после первого сохранения форма сама меняет адрес на
  // /products/{id} (history.replaceState), и страница не должна под ней
  // перезагружать товар.
  const [id] = useState(params.id);
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });

    try {
      const [categories, brands, product] = await Promise.all([
        api.get('/admin/categories').then((r) => list(r.data)).catch((): NamedOption[] => []),
        api.get('/admin/brands').then((r) => list(r.data)).catch((): NamedOption[] => []),
        id === 'create' ? Promise.resolve(null) : api.get<{ data: ApiProduct }>(`/admin/products/${id}`).then((r) => r.data.data),
      ]);
      setState({ status: 'ready', data: { product, categories, brands } });
    } catch (error) {
      setState({ status: isAxiosError(error) && error.response?.status === 404 ? 'missing' : 'failed' });
    }
  }, [id]);

  useEffect(() => {
    // Загрузка при открытии — синхронизация с API, ради этого эффект и нужен.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return <ProductFormSkeleton />;
  }

  if (state.status === 'missing' || state.status === 'failed') {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-lg font-semibold text-zinc-900">
          {state.status === 'missing' ? 'Товар не найден' : 'Не удалось загрузить товар'}
        </p>
        <div className="flex justify-center gap-4">
          {state.status === 'failed' && (
            <button type="button" className={buttonSecondary} onClick={() => void load()}>
              Повторить
            </button>
          )}
          <Link href="/products" className={buttonLink}>
            К списку товаров
          </Link>
        </div>
      </div>
    );
  }

  return <ProductForm initialProduct={state.data.product} categories={state.data.categories} brands={state.data.brands} />;
}
```

- [ ] **Step 10: Тесты зелёные, типы и линтер**

```bash
cd admin && npx tsc --noEmit && npm run lint
cd admin && PW e2e/product-form.spec.ts e2e/product-relations.spec.ts --project=Desktop --reporter=list
```

Expected: `tsc` и `lint` без ошибок; все тесты `product-form.spec.ts` PASS; `product-relations.spec.ts` PASS (вкладки пока на месте).

Если «панель сохранения на виду» падает на десктопе — посмотреть снимок в отчёте (`npx playwright show-report`): `sticky` внутри `<main lg:overflow-y-auto>` должен держать панель у нижнего края `<main>`.

- [ ] **Step 11: Глазами**

`preview_start` с `name: "admin-dev"`, открыть `/products/<id товара в наличии из фикстур>` и `/products/create`. Скриншот на 1280 px и через `resize_window` preset `mobile`. Проверить: две колонки на десктопе, одна лента в порядке Основное → Цены → Статус → Каталог → Учёт → Остаток → Габариты → вкладки → SEO на телефоне; панель над нижней навигацией; нет английских слов. Вернуть `resize_window` preset `desktop`.

- [ ] **Step 12: Commit**

```bash
git add admin/src admin/e2e/product-form.spec.ts admin/Dockerfile .github/workflows/deploy.yml
git commit -m "feat(admin): product form in Russian, two columns, save without leaving the page"
```

---

### Task 2: Фото — в форме, до сохранения и с повтором

**Files:**
- Create: `admin/src/components/products/form/photos.ts`, `admin/src/components/products/form/PhotosSection.tsx`
- Modify: `admin/src/components/products/form/ProductForm.tsx`, `admin/src/components/products/ProductRelations.tsx`
- Delete: `admin/src/components/products/MediaTab.tsx`
- Test: `admin/e2e/product-form.spec.ts`, `admin/e2e/product-relations.spec.ts`

**Interfaces:**
- Consumes: `FormCard`, `SaveBar.status`, `ProductForm.save` (задача 1).
- Produces: `type QueuedPhoto = { key: string; file: File; preview: string; status: 'waiting' | 'uploading' | 'failed'; error?: string }`; `photoProblem(file): string | null`; `queuePhoto(file): QueuedPhoto`; `uploadPhoto(productId, file): Promise<void>` (бросает `Error` с текстом для показа); `PhotosSection` props `{ productId: number | null; queue: QueuedPhoto[]; onQueueChange: Dispatch<SetStateAction<QueuedPhoto[]>>; busy: boolean; className?: string }`. В `ProductForm` — `queue` для задачи 6 (`useUnsavedGuard`).

- [ ] **Step 1: Падающие тесты**

В `admin/e2e/product-form.spec.ts` добавить в начало `import path from "node:path";` и тесты:

```ts
const PIXEL = path.join(__dirname, "assets/pixel.png");

test("новый товар: фото до сохранения загружаются после него", async ({ page }) => {
  await page.goto("/products/create");
  await page.getByLabel("Название *").fill(`E2E с фото ${Date.now()}`);
  await page.getByLabel("Загрузить фото").setInputFiles(PIXEL);
  await expect(page.getByTestId("queued-photo")).toHaveCount(1);
  await expect(page.getByText("Загрузятся после сохранения.")).toBeVisible();

  await saveButton(page).click();

  await expect(page).toHaveURL(/\/products\/\d+$/);
  rememberCreated(page);
  await expect(page.getByText("Товар создан")).toBeVisible();
  await expect(page.getByTestId("product-image")).toHaveCount(1);
  await expect(page.getByTestId("queued-photo")).toHaveCount(0);
});

test("фото, которое не загрузилось при создании, загружается повторно", async ({ page }) => {
  let failOnce = true;
  await page.route("**/admin/products/*/media", async (route) => {
    if (route.request().method() === "POST" && failOnce) {
      failOnce = false;
      await route.fulfill({ status: 422, json: { message: "Файл повреждён" } });
    } else {
      await route.continue();
    }
  });

  await page.goto("/products/create");
  await page.getByLabel("Название *").fill(`E2E повтор ${Date.now()}`);
  await page.getByLabel("Загрузить фото").setInputFiles(PIXEL);
  await saveButton(page).click();

  await expect(page).toHaveURL(/\/products\/\d+$/);
  rememberCreated(page);
  const failed = page.getByTestId("queued-photo");
  await expect(failed).toContainText("Не загрузилось");
  await expect(page.getByText("pixel.png: Файл повреждён")).toBeVisible();

  await failed.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByTestId("product-image")).toHaveCount(1);
  await expect(failed).toHaveCount(0);
});

test("файл не того типа в очередь не попадает", async ({ page }) => {
  await page.goto("/products/create");
  await page.getByLabel("Загрузить фото").setInputFiles({ name: "doc.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });

  await expect(page.getByText("doc.pdf: только JPEG, PNG или WebP")).toBeVisible();
  await expect(page.getByTestId("queued-photo")).toHaveCount(0);
});
```

В `admin/e2e/product-relations.spec.ts`, тест «фото загружается в товар и удаляется», удалить строку:

```ts
  await page.getByRole("tab", { name: "Фото" }).click();
```

- [ ] **Step 2: Убедиться, что падают**

Run: `cd admin && PW e2e/product-form.spec.ts -g "фото|файл" --project=Desktop --reporter=list`
Expected: FAIL — нет «Загрузить фото» на странице создания.

- [ ] **Step 3: `photos.ts`**

`admin/src/components/products/form/photos.ts`:

```ts
import api from '@/lib/api';
import { serverMessage } from '@/lib/errors';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const PHOTO_ACCEPT = PHOTO_TYPES.join(',');

const MAX_BYTES = 10 * 1024 * 1024;

/** Фото, выбранное до сохранения товара или не загрузившееся после. */
export type QueuedPhoto = {
  key: string;
  file: File;
  /** object URL для превью — освобождать через URL.revokeObjectURL. */
  preview: string;
  status: 'waiting' | 'uploading' | 'failed';
  error?: string;
};

/** Те же ограничения, что на сервере: фото на 30 МБ отказывает сразу, а не после загрузки. */
export function photoProblem(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) {
    return `${file.name}: только JPEG, PNG или WebP`;
  }
  if (file.size > MAX_BYTES) {
    return `${file.name}: больше 10 МБ`;
  }

  return null;
}

let nextKey = 1;

export const queuePhoto = (file: File): QueuedPhoto => ({
  key: `photo-${nextKey++}`,
  file,
  preview: URL.createObjectURL(file),
  status: 'waiting',
});

/** Загружает одно фото в товар. Ошибка — Error с текстом для человека. */
export async function uploadPhoto(productId: number, file: File): Promise<void> {
  const body = new FormData();
  body.append('file', file);

  try {
    await api.post(`/admin/products/${productId}/media`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
  } catch (error) {
    throw new Error(serverMessage(error) ?? 'не загрузилось');
  }
}
```

- [ ] **Step 4: `PhotosSection`**

`admin/src/components/products/form/PhotosSection.tsx`:

```tsx
'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import ConfirmButton from '@/components/ui/ConfirmButton';
import { buttonDanger, buttonLink } from '@/components/ui/styles';
import api from '@/lib/api';
import { useResource } from '@/lib/crud';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/stores/toastStore';
import FormCard from './FormCard';
import { PHOTO_ACCEPT, photoProblem, queuePhoto, uploadPhoto, type QueuedPhoto } from './photos';

type Image = { id: number; file_name: string; url: string; thumb_url: string; order: number | null };

type Props = {
  productId: number | null;
  queue: QueuedPhoto[];
  onQueueChange: Dispatch<SetStateAction<QueuedPhoto[]>>;
  /** Идёт сохранение товара — новые файлы не принимаем. */
  busy: boolean;
  className?: string;
};

const MainBadge = () => (
  <span className="absolute top-1 left-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">Главное</span>
);

/**
 * Фото товара. У сохранённого товара файлы загружаются сразу. У нового —
 * копятся в очереди с превью и уходят после первого сохранения (это делает
 * ProductForm); не загрузившиеся остаются здесь с кнопкой «Повторить».
 */
export default function PhotosSection({ productId, queue, onQueueChange, busy, className }: Props) {
  const path = productId ? `/admin/products/${productId}/media` : null;
  const images = useResource<Image>(path);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const saved = productId !== null ? images.items : [];

  const addFiles = async (files: FileList | null) => {
    const accepted: File[] = [];

    for (const file of Array.from(files ?? [])) {
      const problem = photoProblem(file);
      if (problem) {
        toast.error(problem);
      } else {
        accepted.push(file);
      }
    }

    if (accepted.length === 0) {
      return;
    }

    if (productId === null) {
      onQueueChange((q) => [...q, ...accepted.map(queuePhoto)]);

      return;
    }

    setUploading(true);
    for (const file of accepted) {
      try {
        await uploadPhoto(productId, file);
      } catch (error) {
        toast.error(`${file.name}: ${(error as Error).message}`);
      }
    }
    setUploading(false);
    await images.reload();
  };

  const retry = async (photo: QueuedPhoto) => {
    if (productId === null) {
      return;
    }

    onQueueChange((q) => q.map((p) => (p.key === photo.key ? { ...p, status: 'uploading', error: undefined } : p)));

    try {
      await uploadPhoto(productId, photo.file);
      URL.revokeObjectURL(photo.preview);
      onQueueChange((q) => q.filter((p) => p.key !== photo.key));
      await images.reload();
    } catch (error) {
      onQueueChange((q) => q.map((p) => (p.key === photo.key ? { ...p, status: 'failed', error: (error as Error).message } : p)));
      toast.error(`${photo.file.name}: ${(error as Error).message}`);
    }
  };

  const removeQueued = (photo: QueuedPhoto) => {
    URL.revokeObjectURL(photo.preview);
    onQueueChange((q) => q.filter((p) => p.key !== photo.key));
  };

  const moveQueued = (index: number, delta: -1 | 1) =>
    onQueueChange((q) => {
      const next = [...q];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];

      return next;
    });

  const moveSaved = async (index: number, delta: -1 | 1) => {
    const ids = saved.map((i) => i.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];

    try {
      await api.put(`${path}/order`, { ids });
    } catch (error) {
      toast.error(serverMessage(error) ?? 'Не удалось изменить порядок');
    }

    await images.reload();
  };

  const arrows = (index: number, count: number, move: (index: number, delta: -1 | 1) => unknown) => (
    <div className="flex">
      <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Раньше" className="min-h-11 px-2 disabled:opacity-30 md:min-h-0">←</button>
      <button type="button" disabled={index === count - 1} onClick={() => move(index, 1)} aria-label="Позже" className="min-h-11 px-2 disabled:opacity-30 md:min-h-0">→</button>
    </div>
  );

  const disabled = busy || uploading;

  return (
    <FormCard id="photos" title="Фото" aside={<span className="text-xs text-zinc-500">JPEG, PNG, WebP до 10 МБ</span>} className={className}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {saved.map((image, index) => (
          <li key={image.id} data-testid="product-image" className="relative overflow-hidden rounded-lg border border-zinc-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.thumb_url} alt={image.file_name} className="aspect-square w-full object-cover" />
            {index === 0 && <MainBadge />}
            <div className="flex items-center justify-between gap-1 p-1 text-xs">
              {arrows(index, saved.length, moveSaved)}
              <ConfirmButton question="Удалить фото?" onConfirm={() => images.remove(image.id)}>Удалить</ConfirmButton>
            </div>
          </li>
        ))}

        {queue.map((photo, index) => (
          <li key={photo.key} data-testid="queued-photo" className="relative overflow-hidden rounded-lg border border-dashed border-zinc-300">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.preview} alt={photo.file.name} className="aspect-square w-full object-cover opacity-80" />
            {productId === null && index === 0 && <MainBadge />}
            {photo.status === 'failed' && (
              <span className="absolute inset-x-0 top-0 bg-red-600/90 px-2 py-1 text-[11px] font-medium text-white">Не загрузилось</span>
            )}
            {photo.status === 'uploading' && (
              <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-zinc-700">Загружаем…</span>
            )}
            <div className="flex items-center justify-between gap-1 p-1 text-xs">
              {productId !== null && photo.status === 'failed' ? (
                <button type="button" className={buttonLink} onClick={() => void retry(photo)}>Повторить</button>
              ) : productId === null ? (
                arrows(index, queue.length, moveQueued)
              ) : (
                <span />
              )}
              <button type="button" className={buttonDanger} disabled={photo.status === 'uploading'} onClick={() => removeQueued(photo)}>
                Убрать
              </button>
            </div>
          </li>
        ))}

        <li>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!disabled) {
                void addFiles(e.dataTransfer.files);
              }
            }}
            className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-2 text-center text-xs ${
              dragging ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-zinc-300 text-zinc-500 hover:bg-zinc-50'
            } ${disabled ? 'cursor-wait opacity-60' : ''}`}
          >
            <span aria-hidden className="text-2xl leading-none">＋</span>
            <span>{uploading ? 'Загрузка…' : 'Перетащите фото или нажмите'}</span>
            <input
              type="file"
              multiple
              accept={PHOTO_ACCEPT}
              className="sr-only"
              disabled={disabled}
              aria-label="Загрузить фото"
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </li>
      </ul>

      <p className="text-xs text-zinc-500">
        {saved.length === 0 && queue.length === 0 && 'Фото нет. '}
        Первое фото — главное на витрине.
        {productId === null && queue.length > 0 && ' Загрузятся после сохранения.'}
      </p>
    </FormCard>
  );
}
```

`addFiles` читает `files` синхронно до первого `await` — поэтому `e.target.value = ''` сразу после вызова безопасен (как было в `MediaTab`).

- [ ] **Step 5: Очередь и загрузка после создания в `ProductForm`**

В `ProductForm.tsx`:

1. Импорты: `useEffect` в список из `react`; `import PhotosSection from './PhotosSection';` и `import { uploadPhoto, type QueuedPhoto } from './photos';`.
2. После `const [open, setOpen] = …` добавить:

```tsx
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const queueRef = useRef(queue);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // Превью очереди — object URL; при уходе со страницы их надо освободить.
  useEffect(() => () => queueRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  /** Грузит очередь по одному, в выбранном порядке; не загрузившиеся остаются в очереди с пометкой. */
  const uploadQueue = async (id: number, photos: QueuedPhoto[]): Promise<void> => {
    for (const [index, photo] of photos.entries()) {
      setStatus(`Загружаем фото ${index + 1} из ${photos.length}`);
      setQueue((q) => q.map((p) => (p.key === photo.key ? { ...p, status: 'uploading' } : p)));

      try {
        await uploadPhoto(id, photo.file);
        URL.revokeObjectURL(photo.preview);
        setQueue((q) => q.filter((p) => p.key !== photo.key));
      } catch (error) {
        const message = (error as Error).message;
        setQueue((q) => q.map((p) => (p.key === photo.key ? { ...p, status: 'failed', error: message } : p)));
        toast.error(`${photo.file.name}: ${message}`);
      }
    }

    setStatus(null);
  };
```

3. В `save`, ветку успеха заменить на:

```tsx
      const saved = res.data.data;

      form.reset(toFormValues(saved));

      if (isCreate) {
        // Не router.replace: смена сегмента [id] могла бы перемонтировать
        // страницу вместе с формой и очередью фото. history.replaceState
        // Next.js поддерживает (docs: linking-and-navigating, «Native History
        // API») — меняется только адрес.
        window.history.replaceState(null, '', `/products/${saved.id}`);
        // Товар «становится сохранённым» только после загрузки фото: пока
        // productId пуст, раздел фото показывает очередь с ходом загрузки.
        await uploadQueue(saved.id, queue);
        setProduct(saved);
        toast.success('Товар создан');
      } else {
        setProduct(saved);
        toast.success('Сохранено');
      }
```

(прежние строки `form.reset(…)`, `setProduct(saved)` и ветки `if (isCreate)` удаляются).

4. В разметке левой колонки между `BasicSection` и `PriceSection`:

```tsx
          <PhotosSection productId={productId} queue={queue} onQueueChange={setQueue} busy={isSubmitting} className="order-2 lg:order-none" />
```

5. У `SaveBar`: `dirty={isDirty || (productId === null && queue.length > 0)}` и `status={status}`.

- [ ] **Step 6: Вкладку «Фото» убрать**

`admin/src/components/products/ProductRelations.tsx`: удалить импорт `MediaTab` и элемент `{ key: 'media', … }` из массива вкладок. Удалить файл:

```bash
git rm admin/src/components/products/MediaTab.tsx
```

- [ ] **Step 7: Тесты зелёные**

```bash
cd admin && npx tsc --noEmit && npm run lint
cd admin && PW e2e/product-form.spec.ts e2e/product-relations.spec.ts --project=Desktop --reporter=list
```

Expected: всё PASS, включая «фото загружается в товар и удаляется» без клика по вкладке. Тест повтора — главный: если после создания исчезла миниатюра «Не загрузилось», значит страница перемонтировалась; искать, кто меняет `id` (`page.tsx` должен читать его один раз через `useState`).

- [ ] **Step 8: Commit**

```bash
git add admin/src admin/e2e
git commit -m "feat(admin): product photos in the form, queued before the first save, with retry"
```

---

### Task 3: Блоки со списками вместо вкладок

**Files:**
- Modify: `admin/src/components/products/{Prices,ClientPrices,AttributeValues,Variants}Tab.tsx`, `admin/src/components/products/form/ProductForm.tsx`
- Delete: `admin/src/components/products/ProductRelations.tsx`
- Test: `admin/e2e/product-form.spec.ts`, `admin/e2e/product-relations.spec.ts`

**Interfaces:**
- Consumes: `Collapsible`, `open`/`toggle` в `ProductForm` (задача 1); `plural` из `@/lib/text`.
- Produces: у каждого `*Tab` проп `onCount?: (count: number) => void`; `id` блоков: `prices`, `client-prices`, `attributes`, `variants` (для `SectionNav` в задаче 7).

- [ ] **Step 1: Падающие тесты**

В `admin/e2e/product-form.spec.ts`, тест «новый товар: одно нажатие — один товар…», перед `await saveButton(page).dblclick();` добавить:

```ts
  const attributes = page.getByRole("button", { name: /^Характеристики/ });
  await expect(attributes).toBeDisabled();
  await expect(attributes).toContainText("Доступно после сохранения товара");
```

и в конец теста:

```ts
  await expect(attributes).toBeEnabled();
  await expect(page.getByRole("button", { name: /^Варианты/ })).toContainText("нет");
```

В `admin/e2e/product-relations.spec.ts`, тест «цена по своему типу…», заменить

```ts
  await page.getByRole("tab", { name: "Цены", exact: true }).click();
  await page.getByRole("button", { name: "Добавить цену" }).click();
```

на

```ts
  const block = page.locator("#prices");
  await page.getByRole("button", { name: /^Цены по типам цен/ }).click();
  await block.getByRole("button", { name: "Добавить цену" }).click();
```

и строку `const row = page.getByRole("tabpanel").locator("tbody tr").filter({ hasText: typeName });` на

```ts
  const row = block.locator("tbody tr").filter({ hasText: typeName });
  await expect(page.getByRole("button", { name: /^Цены по типам цен/ })).toContainText(/\d+ цен/);
```

- [ ] **Step 2: Убедиться, что падают**

Run: `cd admin && PW e2e/product-form.spec.ts e2e/product-relations.spec.ts --project=Desktop --reporter=list`
Expected: FAIL — нет кнопки «Характеристики…», нет `#prices`.

- [ ] **Step 3: `onCount` во вкладках**

В каждом из четырёх файлов — одинаковая правка; ниже для `PricesTab.tsx`, в остальных меняется имя переменной списка (`prices` в `ClientPricesTab`, `values` в `AttributeValuesTab`, `variants` в `VariantsTab`).

Импорт: `import { useEffect, useState } from 'react';` (вместо `import { useState } from 'react';`).

Подпись компонента:

```tsx
export default function PricesTab({ productId, onCount }: { productId: number; onCount?: (count: number) => void }) {
```

Сразу после строки с `useResource` своего списка:

```tsx
  // Счётчик для заголовка блока — только когда список уже загружен.
  useEffect(() => {
    if (!prices.loading) {
      onCount?.(prices.items.length);
    }
  }, [prices.loading, prices.items.length, onCount]);
```

`ClientPricesTab`: переменная `prices`. `AttributeValuesTab`: `values`. `VariantsTab`: `variants`.

- [ ] **Step 4: Блоки в `ProductForm`**

1. Импорты: удалить `ProductRelations`; добавить

```tsx
import AttributeValuesTab from '@/components/products/AttributeValuesTab';
import ClientPricesTab from '@/components/products/ClientPricesTab';
import PricesTab from '@/components/products/PricesTab';
import VariantsTab from '@/components/products/VariantsTab';
import Collapsible from '@/components/ui/Collapsible';
import { plural, ru } from '@/lib/text';
```

(`ru` уже импортирован — объединить в одну строку), и `useMemo` в импорт из `react`, и `type ComponentType` из `react`.

2. Над компонентом:

```tsx
type RelationTab = ComponentType<{ productId: number; onCount?: (count: number) => void }>;

/** Блоки со списками: сохраняются сразу, каждый в своём окне. `order` — место в ленте на телефоне. */
const RELATIONS: { id: string; title: string; forms: [string, string, string]; Tab: RelationTab; order: string }[] = [
  { id: 'prices', title: 'Цены по типам цен', forms: ['цена', 'цены', 'цен'], Tab: PricesTab, order: 'order-9 lg:order-none' },
  { id: 'client-prices', title: 'Цены для клиентов B2B', forms: ['цена', 'цены', 'цен'], Tab: ClientPricesTab, order: 'order-10 lg:order-none' },
  { id: 'attributes', title: 'Характеристики', forms: ['значение', 'значения', 'значений'], Tab: AttributeValuesTab, order: 'order-11 lg:order-none' },
  { id: 'variants', title: 'Варианты', forms: ['вариант', 'варианта', 'вариантов'], Tab: VariantsTab, order: 'order-12 lg:order-none' },
];
```

3. В компоненте после `useState` открытых блоков:

```tsx
  const [counts, setCounts] = useState<Record<string, number>>({});
  // Сеттеры стабильны: вкладки держат onCount в зависимостях эффекта, и новый
  // колбэк на каждом рендере зациклил бы его.
  const countSetters = useMemo(
    () =>
      Object.fromEntries(
        RELATIONS.map((r) => [r.id, (n: number) => setCounts((c) => (c[r.id] === n ? c : { ...c, [r.id]: n }))]),
      ) as Record<string, (n: number) => void>,
    [],
  );
```

4. В разметке заменить блок `{productId !== null && (<section …><ProductRelations … /></section>)}` на:

```tsx
          {RELATIONS.map(({ id, title, forms, Tab, order }) => {
            const count = counts[id];

            return (
              <div key={id} className={order}>
                <Collapsible
                  id={id}
                  title={title}
                  note="Сохраняется сразу"
                  summary={count === undefined ? null : count === 0 ? 'нет' : `${count} ${plural(count, forms)}`}
                  open={open.has(id)}
                  onToggle={toggle(id)}
                  disabledHint={productId === null ? 'Доступно после сохранения товара' : undefined}
                >
                  {productId !== null && <Tab productId={productId} onCount={countSetters[id]} />}
                </Collapsible>
              </div>
            );
          })}
```

и убрать неиспользуемый импорт `cardClass`, если он больше не нужен.

5. Удалить `ProductRelations`:

```bash
git rm admin/src/components/products/ProductRelations.tsx
```

`Tabs` (`components/ui/Tabs.tsx`) не удалять — он используется в других местах (проверить: `grep -rn "ui/Tabs" admin/src`; если потребителей нет — оставить всё равно, это общий компонент).

- [ ] **Step 5: Тесты зелёные**

```bash
cd admin && npx tsc --noEmit && npm run lint
cd admin && PW e2e/product-form.spec.ts e2e/product-relations.spec.ts --project=Desktop --reporter=list
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add admin/src admin/e2e
git commit -m "feat(admin): product lists as collapsible blocks with counts instead of tabs"
```

---

### Task 4: Категория и бренд — выбор с поиском

**Files:**
- Modify: `admin/src/components/ui/SearchSelect.tsx` (сейчас только тип), `admin/src/components/products/form/CatalogCard.tsx`
- Test: `admin/e2e/product-form.spec.ts`

**Interfaces:**
- Consumes: `SelectOption`, `categoryOptions`, `brandOptions` (задача 1).
- Produces: `SearchSelect` props `{ id: string; options: SelectOption[]; value: string; onChange: (value: string) => void; emptyLabel: string; invalid?: boolean }`; роль `combobox`, имя — из `<label htmlFor={id}>`.

- [ ] **Step 1: Падающий тест**

В `admin/e2e/product-form.spec.ts`:

```ts
test("категория выбирается поиском и показывается путём", async ({ page, request }) => {
  const api = adminApi(request);
  const stamp = Date.now();
  const parent = await api.create<{ id: number }>("/admin/categories", { name: { ru: `E2E Родитель ${stamp}` }, slug: `e2e-parent-${stamp}` });
  const child = await api.create<{ id: number }>("/admin/categories", {
    name: { ru: `E2E Ребёнок ${stamp}` },
    slug: `e2e-child-${stamp}`,
    parent_id: parent.id,
  });
  const product = await draftProduct(request);

  try {
    await page.goto(`/products/${product.id}`);
    const category = page.getByRole("combobox", { name: "Категория" });
    await expect(category).toHaveValue("Без категории");

    await category.click();
    await category.fill(`Ребёнок ${stamp}`);
    await page.getByRole("option", { name: `E2E Родитель ${stamp} › E2E Ребёнок ${stamp}` }).click();
    await expect(category).toHaveValue(`E2E Родитель ${stamp} › E2E Ребёнок ${stamp}`);

    await saveButton(page).click();
    await expect(page.getByText("Сохранено", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Категория" })).toHaveValue(`E2E Родитель ${stamp} › E2E Ребёнок ${stamp}`);
  } finally {
    // Товар держит category_id — сначала он (afterEach удалит ещё раз, это безопасно).
    await api.delete(`/admin/products/${product.id}`);
    await api.delete(`/admin/categories/${child.id}`);
    await api.delete(`/admin/categories/${parent.id}`);
  }
});

test("выбор с клавиатуры: стрелки, Enter, Escape", async ({ page, request }) => {
  const product = await draftProduct(request);

  await page.goto(`/products/${product.id}`);
  const brand = page.getByRole("combobox", { name: "Бренд" });
  await brand.focus();
  await expect(page.getByRole("listbox")).toBeVisible();
  await brand.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(brand).toHaveValue("Без бренда");
});
```

`POST /admin/categories` отвечает моделью без обёртки `data` (`CategoryController::store`), поэтому `create<{ id: number }>`.

- [ ] **Step 2: Убедиться, что падает**

Run: `cd admin && PW e2e/product-form.spec.ts -g "категория|клавиатуры" --project=Desktop --reporter=list`
Expected: FAIL — нет `combobox`.

- [ ] **Step 3: `SearchSelect`**

`admin/src/components/ui/SearchSelect.tsx` — заменить целиком:

```tsx
'use client';

import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { inputClass } from './styles';

export type SelectOption = { value: string; label: string };

type Props = {
  id: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Подпись пустого значения: «Без категории». */
  emptyLabel: string;
  invalid?: boolean;
};

/**
 * Выбор одного значения из списка с поиском по подстроке (combobox).
 *
 * Закрытый показывает выбранное. При фокусе открывается весь список, ввод
 * фильтрует; стрелки, Enter и Escape работают с клавиатуры. Пункт выбирается
 * на mousedown с preventDefault — иначе blur поля закрыл бы список раньше
 * клика.
 */
export default function SearchSelect({ id, options, value, onChange, emptyLabel, invalid }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const all = useMemo(() => [{ value: '', label: emptyLabel }, ...options], [options, emptyLabel]);
  const selected = all.find((o) => o.value === value) ?? all[0];
  const needle = query.trim().toLocaleLowerCase('ru');
  const visible = needle ? all.filter((o) => o.value !== '' && o.label.toLocaleLowerCase('ru').includes(needle)) : all;

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = (option: SelectOption) => {
    onChange(option.value);
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, visible.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && visible[active]) {
      e.preventDefault();
      pick(visible[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && visible[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        className={`${inputClass} pr-8`}
        value={open ? query : selected.label}
        placeholder={open ? selected.label : undefined}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onClick={() => setOpen(true)}
        onBlur={close}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400">⌄</span>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {visible.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500">Ничего не найдено</li>
          ) : (
            visible.map((option, index) => (
              <li
                key={option.value || 'empty'}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(option);
                }}
                onMouseEnter={() => setActive(index)}
                className={`flex min-h-11 cursor-pointer items-center px-3 text-sm md:min-h-9 ${index === active ? 'bg-zinc-100' : ''} ${
                  option.value === value ? 'font-medium text-blue-700' : 'text-zinc-800'
                }`}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: `CatalogCard` на `SearchSelect`**

`admin/src/components/products/form/CatalogCard.tsx` — заменить целиком:

```tsx
'use client';

import { useMemo } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import Field from '@/components/ui/Field';
import SearchSelect from '@/components/ui/SearchSelect';
import FormCard from './FormCard';
import { brandOptions, categoryOptions, type NamedOption, type ProductFormValues } from './productForm';

type Props = { form: UseFormReturn<ProductFormValues>; categories: NamedOption[]; brands: NamedOption[]; className?: string };

export default function CatalogCard({ form, categories, brands, className }: Props) {
  const { control, formState: { errors } } = form;
  const categoryList = useMemo(() => categoryOptions(categories), [categories]);
  const brandList = useMemo(() => brandOptions(brands), [brands]);

  return (
    <FormCard id="catalog" title="Каталог" className={className}>
      <Field label="Категория" htmlFor="category_id" error={errors.category_id?.message}>
        <Controller
          control={control}
          name="category_id"
          render={({ field }) => (
            <SearchSelect id="category_id" options={categoryList} value={field.value} onChange={field.onChange} emptyLabel="Без категории" invalid={Boolean(errors.category_id)} />
          )}
        />
      </Field>
      <Field label="Бренд" htmlFor="brand_id" error={errors.brand_id?.message}>
        <Controller
          control={control}
          name="brand_id"
          render={({ field }) => (
            <SearchSelect id="brand_id" options={brandList} value={field.value} onChange={field.onChange} emptyLabel="Без бренда" invalid={Boolean(errors.brand_id)} />
          )}
        />
      </Field>
    </FormCard>
  );
}
```

- [ ] **Step 5: Тесты зелёные**

```bash
cd admin && npx tsc --noEmit && npm run lint
cd admin && PW e2e/product-form.spec.ts --project=Desktop --reporter=list
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add admin/src admin/e2e/product-form.spec.ts
git commit -m "feat(admin): search-as-you-type category and brand pickers with category paths"
```

---

### Task 5: Ошибки — к первому полю, в свёрнутом блоке, на нужном языке

**Files:**
- Modify: `admin/src/components/products/form/productForm.ts`, `admin/src/components/products/form/ProductForm.tsx`
- Test: `admin/e2e/product-form.spec.ts`

**Interfaces:**
- Consumes: `open`/`setOpen`, `setBasicLocale`, `setSeoLocale`, `rootRef`, `aria-invalid` на полях (задача 1).
- Produces: `errorPaths(errors: FieldErrors): string[]`, `revealPlan(paths: string[]): { folds: string[]; basicLocale?: Locale; seoLocale?: Locale }`.

- [ ] **Step 1: Падающие тесты**

В `admin/e2e/product-form.spec.ts`. В тест «пустое название…» в конец добавить:

```ts
  await expect(page.getByLabel("Название *")).toBeFocused();
```

Новые тесты:

```ts
test("ошибка сервера в казахском названии переключает на KZ", async ({ page, request }) => {
  const product = await draftProduct(request);
  await page.route(`**/admin/products/${product.id}`, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 422,
        json: { message: "Проверьте поля", errors: { "name.kk": ["Название на казахском слишком длинное"] } },
      });
    } else {
      await route.continue();
    }
  });

  await page.goto(`/products/${product.id}`);
  await page.getByLabel("Розничная", { exact: true }).fill("1500");
  await saveButton(page).click();

  const kz = page.getByRole("button", { name: /^KZ/ }).first();
  await expect(kz).toHaveAttribute("aria-pressed", "true");
  await expect(kz).toHaveAccessibleName(/есть ошибка/);
  await expect(page.getByText("Название на казахском слишком длинное")).toBeVisible();
  await expect(page.getByLabel("Название на казахском")).toBeFocused();
});

test("ошибка в свёрнутом блоке раскрывает его", async ({ page, request }) => {
  const product = await draftProduct(request);

  await page.goto(`/products/${product.id}`);
  const fold = page.getByRole("button", { name: /^Закупочная, минимальная цена/ });
  await fold.click();
  await page.getByLabel("Закупочная цена").fill("1.234");
  await fold.click();
  await expect(fold).toHaveAttribute("aria-expanded", "false");

  await saveButton(page).click();

  await expect(fold).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Сумма в ₸, до двух знаков после точки")).toBeVisible();
  await expect(page.getByLabel("Закупочная цена")).toBeFocused();
});

test("ошибка сервера 500 — изменения остаются", async ({ page, request }) => {
  const product = await draftProduct(request);
  await page.route(`**/admin/products/${product.id}`, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 500, json: { message: "Server Error" } });
    } else {
      await route.continue();
    }
  });

  await page.goto(`/products/${product.id}`);
  await page.getByLabel("Розничная", { exact: true }).fill("1999");
  await saveButton(page).click();

  await expect(page.getByText("Ошибка сервера или сети — попробуйте ещё раз")).toBeVisible();
  await expect(page.getByLabel("Розничная", { exact: true })).toHaveValue("1999");
  await expect(page.getByText("Есть несохранённые изменения")).toBeVisible();
  await expect(saveButton(page)).toBeEnabled();
});
```

- [ ] **Step 2: Убедиться, что падают**

Run: `cd admin && PW e2e/product-form.spec.ts -g "ошибка|пустое" --project=Desktop --reporter=list`
Expected: FAIL — фокус не на поле, блок не раскрыт, KZ не выбран. («500» может пройти уже сейчас — это страховка от регрессии.)

- [ ] **Step 3: `errorPaths` и `revealPlan`**

В `productForm.ts`: импорт `import type { FieldErrors } from 'react-hook-form';`, импорт `LOCALES` дополнить типом: `import { LOCALES, type Locale } from '@/components/ui/LocaleSwitch';`. В конец файла:

```ts
/**
 * Пути полей с ошибкой: «name.kk», «purchase_price». Лист — объект с
 * `type` (FieldError); у вложенного {ru, kk} его нет, туда спускаемся.
 */
export function errorPaths(errors: FieldErrors, prefix = ''): string[] {
  return Object.entries(errors).flatMap(([key, value]) => {
    if (!value || typeof value !== 'object') {
      return [];
    }

    const path = prefix ? `${prefix}.${key}` : key;

    return typeof (value as { type?: unknown }).type === 'string' ? [path] : errorPaths(value as FieldErrors, path);
  });
}

/** В каком свёрнутом блоке живёт поле (по первому сегменту пути). */
const FOLD_OF: Record<string, string> = {
  purchase_price: 'price-extra',
  min_price: 'price-extra',
  b2b_min_order_qty: 'price-extra',
  slug: 'seo',
  seo_title: 'seo',
  seo_description: 'seo',
};

/**
 * Что открыть, чтобы ошибки стали видны: свёрнутые блоки и язык карточек.
 * Русский важнее: если ошибки на обоих языках, показываем RU.
 */
export function revealPlan(paths: string[]): { folds: string[]; basicLocale?: Locale; seoLocale?: Locale } {
  const folds = [...new Set(paths.map((p) => FOLD_OF[p.split('.')[0]]).filter((f): f is string => Boolean(f)))];

  const localeOf = (fields: string[]): Locale | undefined =>
    LOCALES.find((locale) => paths.some((p) => fields.some((f) => p === `${f}.${locale}`)));

  return {
    folds,
    basicLocale: localeOf(['name', 'description']),
    seoLocale: localeOf(['seo_title', 'seo_description']),
  };
}
```

(`LOCALES` — `['ru', 'kk']`, `find` вернёт `ru` раньше `kk`.)

- [ ] **Step 4: Раскрытие в `ProductForm`**

1. Импорты: `import { isAxiosError } from 'axios';` и `errorPaths`, `revealPlan` в импорт из `./productForm`.
2. В компоненте, перед `const save = …`:

```tsx
  /** Открывает блоки и язык с ошибками, потом прокручивает и ставит фокус на первое видимое поле. */
  const reveal = (paths: string[]) => {
    const plan = revealPlan(paths);

    if (plan.folds.length > 0) {
      setOpen((prev) => new Set([...prev, ...plan.folds]));
    }
    if (plan.basicLocale) {
      setBasicLocale(plan.basicLocale);
    }
    if (plan.seoLocale) {
      setSeoLocale(plan.seoLocale);
    }

    // Два кадра: React успевает раскрыть блоки и сменить язык, браузер — разложить их.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const fields = rootRef.current?.querySelectorAll<HTMLElement>('[aria-invalid="true"]') ?? [];
        const first = Array.from(fields).find((el) => el.offsetParent !== null);
        first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        first?.focus({ preventScroll: true });
      }),
    );
  };
```

3. `const save = form.handleSubmit(async (values) => { … })` — вторым аргументом `handleSubmit` передать обработчик невалидной формы:

```tsx
  const save = form.handleSubmit(
    async (values) => {
      /* тело без изменений */
    },
    (errors) => reveal(errorPaths(errors)),
  );
```

4. В `catch` внутри `save`, после `toast.error(message)`-блока:

```tsx
      const serverPaths = isAxiosError<{ errors?: Record<string, string[]> }>(error)
        ? Object.keys(error.response?.data?.errors ?? {})
        : [];

      if (serverPaths.length > 0) {
        reveal(serverPaths);
      }
```

- [ ] **Step 5: Тесты зелёные**

```bash
cd admin && npx tsc --noEmit && npm run lint
cd admin && PW e2e/product-form.spec.ts --project=Desktop --reporter=list
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add admin/src admin/e2e/product-form.spec.ts
git commit -m "feat(admin): product form reveals the first error: opens its block, switches its language, focuses it"
```

---

### Task 6: Предупреждение о несохранённых изменениях

**Files:**
- Create: `admin/src/lib/useUnsavedGuard.ts`
- Modify: `admin/src/components/products/form/ProductForm.tsx`
- Test: `admin/e2e/product-form.spec.ts`

**Interfaces:**
- Consumes: `isDirty`, `queue` (задачи 1–2).
- Produces: `useUnsavedGuard(active: boolean, message?: string): void`; `UNSAVED_QUESTION = 'Уйти без сохранения? Изменения пропадут.'`.

- [ ] **Step 1: Падающие тесты**

```ts
const QUESTION = "Уйти без сохранения? Изменения пропадут.";

test("уход с несохранёнными изменениями спрашивает подтверждение", async ({ page, request }) => {
  const product = await draftProduct(request);
  const back = page.getByRole("link", { name: "Назад" });
  const asked: string[] = [];

  await page.goto(`/products/${product.id}`);
  await page.getByLabel("Розничная", { exact: true }).fill("777");

  page.once("dialog", (d) => {
    asked.push(d.message());
    void d.dismiss();
  });
  await back.click();
  await expect.poll(() => asked).toEqual([QUESTION]);
  await expect(page).toHaveURL(`/products/${product.id}`);

  page.once("dialog", (d) => void d.accept());
  await back.click();
  await expect(page).toHaveURL("/products");
});

test("после сохранения уход без вопроса", async ({ page, request }) => {
  const product = await draftProduct(request);

  await page.goto(`/products/${product.id}`);
  await page.getByLabel("Розничная", { exact: true }).fill("888");
  await saveButton(page).click();
  await expect(page.getByText("Сохранено", { exact: true })).toBeVisible();

  // Без обработчика Playwright отклонил бы диалог — и адрес бы не сменился.
  await page.getByRole("link", { name: "Назад" }).click();
  await expect(page).toHaveURL("/products");
});

test("новый товар с одними фото — тоже несохранённое", async ({ page }) => {
  const asked: string[] = [];

  await page.goto("/products/create");
  await page.getByLabel("Загрузить фото").setInputFiles(PIXEL);
  page.once("dialog", (d) => {
    asked.push(d.message());
    void d.dismiss();
  });
  await page.getByRole("link", { name: "Назад" }).click();

  await expect.poll(() => asked).toEqual([QUESTION]);
  await expect(page).toHaveURL("/products/create");
});
```

- [ ] **Step 2: Убедиться, что падают**

Run: `cd admin && PW e2e/product-form.spec.ts -g "уход|одними фото" --project=Desktop --reporter=list`
Expected: FAIL — диалога нет, адрес меняется сразу.

- [ ] **Step 3: `useUnsavedGuard`**

`admin/src/lib/useUnsavedGuard.ts`:

```ts
'use client';

import { useEffect } from 'react';

export const UNSAVED_QUESTION = 'Уйти без сохранения? Изменения пропадут.';

/**
 * Пока `active`, спрашивает перед уходом со страницы.
 *
 * Закрытие и перезагрузку вкладки ловит `beforeunload`. Переходы внутри
 * приложения — клик по `<a>` того же origin: в App Router нет события
 * «перед переходом», поэтому клик перехватывается в фазе захвата на
 * document, раньше обработчика next/link. Кнопку браузера «Назад» так не
 * остановить — это известное ограничение.
 */
export function useUnsavedGuard(active: boolean, message: string = UNSAVED_QUESTION): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Старые браузеры показывают вопрос, только если returnValue задан.
      e.returnValue = '';
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;

      if (!link || link.target === '_blank' || link.hasAttribute('download')) {
        return;
      }

      const url = new URL(link.href, window.location.href);

      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) {
        return;
      }

      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [active, message]);
}
```

- [ ] **Step 4: Подключить в `ProductForm`**

Импорт `import { useUnsavedGuard } from '@/lib/useUnsavedGuard';`. После объявления `queue`/`isDirty`:

```tsx
  // Во время сохранения не спрашиваем: форма сама меняет адрес после создания.
  useUnsavedGuard((isDirty || queue.length > 0) && !isSubmitting);
```

- [ ] **Step 5: Тесты зелёные**

```bash
cd admin && npx tsc --noEmit && npm run lint
cd admin && PW e2e/product-form.spec.ts e2e/product-relations.spec.ts --project=Desktop --reporter=list
```

Expected: PASS. В `product-relations.spec.ts` диалоги принимаются `page.on("dialog", accept)` — вопрос о несохранённом там не возникает (форму не меняют).

- [ ] **Step 6: Commit**

```bash
git add admin/src admin/e2e/product-form.spec.ts
git commit -m "feat(admin): ask before leaving a product with unsaved changes"
```

---

### Task 7: Телефон — быстрые переходы и панель над навигацией

**Files:**
- Create: `admin/src/components/ui/SectionNav.tsx`
- Modify: `admin/src/components/ui/PageHeader.tsx`, `admin/src/components/products/form/ProductForm.tsx`
- Test: `admin/e2e/mobile/product-form.spec.ts`

**Interfaces:**
- Consumes: `id` разделов (`basic`, `photos`, `price`, `status`, `catalog`, `attributes`, `variants`, `seo`), `open`/`setOpen` (задачи 1–3).
- Produces: `SectionNav` props `{ sections: { id: string; label: string }[]; onJump: (id: string) => void }`; `PageHeader` проп `below?: ReactNode`.

- [ ] **Step 1: Падающий мобильный тест**

`admin/e2e/mobile/product-form.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { requireInStockProduct } from "../fixtures";
import { ADMIN_SESSION } from "../session";

/**
 * Карточка товара на телефоне: панель сохранения не прячется под нижнюю
 * навигацию, до нижних разделов добираются полосой переходов. Товар «в
 * наличии» только открывается — ничего не сохраняется.
 */
test.use({ storageState: ADMIN_SESSION });

test("панель сохранения над нижней навигацией", async ({ page }) => {
  await page.goto(`/products/${requireInStockProduct().id}`);

  const bar = page.getByRole("region", { name: "Сохранение" });
  const nav = page.getByRole("navigation", { name: "Основное меню" });
  await expect(bar).toBeInViewport();
  await expect(bar.getByRole("button", { name: "Сохранить", exact: true })).toBeVisible();

  const barBox = (await bar.boundingBox())!;
  const navBox = (await nav.boundingBox())!;
  expect(barBox.y + barBox.height).toBeLessThanOrEqual(navBox.y + 1);
});

test("«SEO» в полосе переходов раскрывает блок и прокручивает к нему", async ({ page }) => {
  await page.goto(`/products/${requireInStockProduct().id}`);

  await page.getByRole("navigation", { name: "Разделы" }).getByRole("button", { name: "SEO" }).click();

  await expect(page.getByRole("button", { name: /^SEO — адрес и поисковики/ })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("Адрес страницы")).toBeInViewport();
});

test("разделы идут одной лентой: основное, фото, цены, статус", async ({ page }) => {
  await page.goto(`/products/${requireInStockProduct().id}`);

  const top = async (id: string) => (await page.locator(`#${id}`).boundingBox())!.y;
  const order = [await top("basic"), await top("photos"), await top("price"), await top("status"), await top("catalog")];
  expect([...order].sort((a, b) => a - b)).toEqual(order);
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `cd admin && PW e2e/mobile/product-form.spec.ts --project=Mobile --reporter=list`
Expected: FAIL — нет навигации «Разделы». Первый и третий тесты могут пройти уже сейчас (панель и порядок сделаны в задаче 1).

- [ ] **Step 3: `SectionNav` и `PageHeader.below`**

`admin/src/components/ui/SectionNav.tsx`:

```tsx
'use client';

type Props = { sections: { id: string; label: string }[]; onJump: (id: string) => void };

/**
 * Полоса быстрых переходов по разделам длинной формы. Только до `lg`: на
 * широком экране разделы и так видны в две колонки. Одна строка, листается
 * вбок, как вкладки.
 */
export default function SectionNav({ sections, onJump }: Props) {
  return (
    <nav aria-label="Разделы" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pt-1 lg:hidden">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onJump(section.id)}
          className="min-h-11 shrink-0 whitespace-nowrap rounded-full border border-zinc-300 bg-white px-4 text-sm text-zinc-700 active:bg-zinc-100"
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}
```

`admin/src/components/ui/PageHeader.tsx`: в `Props` добавить `below?: ReactNode`, в подпись — `below`, и последним ребёнком корневого `div` после блока `actions`:

```tsx
      {below && <div className="w-full min-w-0">{below}</div>}
```

В комментарий компонента добавить строку: «`below` — строка под заголовком во всю ширину (полоса быстрых переходов); прилипает вместе с шапкой».

- [ ] **Step 4: Подключить в `ProductForm`**

1. Импорт `import SectionNav from '@/components/ui/SectionNav';`.
2. Над компонентом:

```tsx
/** Полоса переходов на телефоне. Свёрнутые блоки (FOLDABLE) при переходе раскрываются. */
const SECTIONS = [
  { id: 'basic', label: 'Основное' },
  { id: 'photos', label: 'Фото' },
  { id: 'price', label: 'Цены' },
  { id: 'status', label: 'Статус' },
  { id: 'catalog', label: 'Каталог' },
  { id: 'attributes', label: 'Характеристики' },
  { id: 'variants', label: 'Варианты' },
  { id: 'seo', label: 'SEO' },
];

const FOLDABLE = new Set(['prices', 'client-prices', 'attributes', 'variants', 'seo']);
```

3. В компоненте:

```tsx
  const jump = (id: string) => {
    if (FOLDABLE.has(id)) {
      setOpen((prev) => new Set(prev).add(id));
    }

    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
```

4. У `PageHeader` проп `below={<SectionNav sections={SECTIONS} onJump={jump} />}`.

- [ ] **Step 5: Тесты зелёные**

```bash
cd admin && npx tsc --noEmit && npm run lint
cd admin && PW e2e/mobile --project=Mobile --reporter=list
```

Expected: PASS весь мобильный набор, включая `no-horizontal-scroll.spec.ts` («документы не прокручиваются вбок» открывает товар) и `controls.spec.ts`.

- [ ] **Step 6: Глазами на телефоне**

`preview_start` `admin-dev`, `resize_window` preset `mobile`, открыть товар из фикстур. Скриншоты: верх страницы (шапка + чипсы), середина, открытая клавиатура не проверяется (headless) — это ручная проверка пользователя. Вернуть preset `desktop`.

- [ ] **Step 7: Commit**

```bash
git add admin/src admin/e2e/mobile/product-form.spec.ts
git commit -m "feat(admin): section jump bar on the product form for phones"
```

---

### Task 8: Финальная проверка

**Files:**
- Modify: `docs/superpowers/specs/2026-09-21-admin-mobile-first-design.md` (одна строка)

- [ ] **Step 1: Английских строк не осталось**

```bash
cd admin && grep -rnE "\b(Add New|Edit Product|Save Product|Basic Information|Pricing|Specifications|Cancel|Validation failed|Select a)\b" src/app/products src/components/products || echo "clean"
```

Expected: `clean`.

- [ ] **Step 2: Полный прогон**

```bash
cd admin && npx tsc --noEmit && npm run lint && npm run build
cd admin && PW --project=Desktop --reporter=list 2>&1 | tail -40
cd admin && PW --project=Mobile --reporter=list 2>&1 | tail -40
```

Expected: сборка без ошибок; падения — только из исходного состояния (задача 0, шаг 4). Любое новое падение — чинить до коммита.

- [ ] **Step 3: Отметка в спеке mobile-first**

В `docs/superpowers/specs/2026-09-21-admin-mobile-first-design.md`, раздел «Этап 3. Товары», пункт про `products/[id]` заменить на:

```markdown
- `products/[id]` — сделано отдельно: `2026-09-24-admin-product-form-design.md`.
```

и удалить пункт про английские подписи экрана товара.

- [ ] **Step 4: Скриншоты для пользователя**

`preview_start` `admin-dev`: `/products/create` и `/products/<id из фикстур>` на 1280 px и preset `mobile`. Отправить через `SendUserFile`. Вернуть preset `desktop`.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-21-admin-mobile-first-design.md
git commit -m "docs: point mobile-first stage 3 at the product form spec"
```
