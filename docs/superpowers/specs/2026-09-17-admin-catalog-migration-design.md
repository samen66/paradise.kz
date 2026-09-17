# Перенос back-office из Filament в `admin/` — этап 1: каталог

Дата: 2026-09-17
Статус: дизайн согласован, ждёт ревью спека

## Цель

Весь back-office живёт в Next.js-приложении `admin/`; Filament (`/admin` на
API-хосте) удаляется из Laravel-проекта. Переносим по частям, Filament работает
до последнего этапа, прод не теряет функций ни на одном шаге.

## Дорожная карта

| Этап | Содержимое | Спек |
|---|---|---|
| 1. Каталог | товар целиком (цены, цены клиентов, атрибуты, варианты, медиа), атрибуты, типы цен, группы каталога, подборки; общие UI-компоненты | этот документ |
| 2. Склад | склады (Stores), поставщики, приёмки с проведением через `GoodsReceiptService::post` | после мержа этапа 1 |
| 3. Контент | CMS-страницы (TipTap), баннеры, отзывы, шортсы, настройки каталога (`CatalogSetting`) | после этапа 2 |
| 4. Пользователи | создание/редактирование, роли, адреса | после этапа 3 |
| 5. Удаление Filament | `app/Filament`, `AdminPanelProvider`, `FilamentUser` в `User`, пакеты `filament/*` и `filament:upgrade` в `composer.json`, Blade-вью, тесты `tests/Feature/Admin/*` на Filament, `ERP_ADMIN_URL` в `admin/`, упоминания в nginx/CLAUDE.md/docblock'ах | последним |

Каждый этап — своя ветка, спек, план и PR.

## Принятые решения

- **Перенос с чисткой**, а не один в один: остаток только для чтения (меняется
  лишь через `FifoInventoryService`), ERP-поля (`source`, `external_id`,
  `external_folder_id`, `synced_at`) не показываются и не редактируются; из
  связей групп каталога нельзя создавать товары/пользователей — только
  привязывать.
- **API — REST-контроллер на ресурс** (`Api/Admin/*Controller` + `FormRequest`
  в `Requests/Admin` + Spatie QueryBuilder), как существующий `ProductController`.
  Отвергнуты: агрегатное сохранение карточки товара одним запросом (сложный
  diff/валидация, затирание при конкурентных правках) и общий CRUD-контроллер
  (правила размазываются по конфигу).
- **UI — свои компоненты на Tailwind** + зависимости `react-hook-form`, `zod`,
  `@hookform/resolvers`; `@tiptap/*` добавляется на этапе 3.

## 1. API (`/api/admin/*`, `auth:sanctum` + `role:admin|manager`)

| Ресурс | Эндпоинты | Поля / правила |
|---|---|---|
| Атрибуты (`Attribute`) | `apiResource attributes` | `name` (строка), `slug` (уникальный), `is_filterable`. Удаление атрибута со значениями → 422 |
| Типы цен (`PriceType`) | `apiResource price-types` | `code` (уникальный), `name`, `sort_order`. Удаление используемого типа → 422 |
| Группы каталога (`CatalogGroup`) | `apiResource catalog-groups`; `POST/DELETE catalog-groups/{group}/products/{product}`; `POST/DELETE catalog-groups/{group}/users/{user}` | `name`. Пользователь — только с ролью `b2b_customer`. Привязка идемпотентна |
| Подборки (`ProductCollection`) | `apiResource product-collections`; `PUT product-collections/{collection}/products/{product}` (body: `sort_order`, attach-or-update); `DELETE …/products/{product}` | `title`, `slug`, `sort_order`, `is_active` |
| Цены товара (`ProductPrice`) | `products/{product}/prices` — index/store/update/destroy (scoped) | `price_type_id` (уникален в пределах товара), `price` |
| Цены клиентов (`ClientProductPrice`) | `products/{product}/client-prices` — index/store/update/destroy | `user_id` (роль `b2b_customer`, уникален в пределах товара), `price` |
| Атрибуты товара (`AttributeValue`) | `products/{product}/attribute-values` — index/store/update/destroy | `attribute_id`, `value` |
| Варианты (`ProductVariant`) | `products/{product}/variants` — index/store/update/destroy | `name`, `code`, `retail_price`, `b2b_price`, `barcodes[]`, `characteristics{}`. Без `stock`, `external_id`, `synced_at`; колонки `source`/`external_id` NOT NULL — новый вариант получает `source = 'local'` и UUID |
| Медиа товара | `POST products/{product}/media` (multipart `file`), `DELETE products/{product}/media/{media}`, `PUT products/{product}/media/order` (body: `ids[]`) | Коллекция `Product::IMAGE_COLLECTION`; jpeg/png/webp, до 10 МБ; порядок — `order_column` |

Правила, общие для всех:

- Деньги пересекают границу в ₸, хранятся в тиынах — та же конвенция, что в
  `ProductSaveRequest` (`prepareForValidation` / `validated`).
- Вложенные ресурсы — scoped bindings: `products/1/prices/{price}` чужого
  товара → 404.
- Ответ: `{data: …}` для одной записи; справочники и связи товара — `{data: [...]}`
  без пагинации (их десятки, не тысячи); 204 на удаление.
- Бизнес-запреты — 422 с `message`, 404 на отсутствующую запись. Свой конверт
  ошибок не вводим.

Изменения в существующем `ProductController`:

- `store`/`update` больше не принимают `images` и не делают
  `clearMediaCollection`; медиа — только через эндпоинты выше. `images`
  убирается из `ProductSaveRequest`.
- `destroy`: товар с записями в `stock_movements` → 422 (ledger не должен
  ссылаться на удалённый товар).
- `show` отдаёт `images: [{id, file_name, url, thumb_url, order}]` в порядке `order_column`.

## 2. `admin/` — экраны и компоненты

### Общие компоненты (`src/components/ui/`)

| Компонент | Назначение |
|---|---|
| `DataTable` | колонки, пагинация Laravel-пагинатора, пустое состояние, загрузка |
| `CrudModal` | модальная форма: react-hook-form + zod; 422 от сервера → ошибки полей через `setError` |
| `Field`, `TranslatableField` | инпут с label/ошибкой; пара ru/kk |
| `MoneyInput` | ввод в ₸ |
| `EntityPicker` | поиск по API + выбор товара/клиента для привязки |
| `ConfirmButton` | подтверждение удаления |
| `Tabs` | вкладки |
| `Toaster` | уведомления, стор на zustand (`toast.success/error` доступен и вне React) |

`src/lib/crud.ts` — хук `useResource(path)` (list/create/update/remove +
перезагрузка списка). `src/lib/money.ts` — единственное место с множителем 100
на клиенте (переносит хелперы из `products/[id]/page.tsx`).

Стиль — текущий (zinc/blue, `inputClass` из карточки товара), новой дизайн-системы
не вводим.

### Экраны

- `/attributes`, `/price-types` — `DataTable` + `CrudModal`.
- `/catalog-groups`, `/catalog-groups/[id]` — поля группы; вкладки «Товары» и
  «Клиенты» (список + `EntityPicker` для привязки, кнопка отвязки).
- `/product-collections`, `/product-collections/[id]` — поля; товары с
  редактируемым `sort_order`.
- `/products/[id]` — текущая форма на общих компонентах + вкладки «Медиа»
  (загрузка, удаление, порядок), «Цены», «Цены клиентов», «Атрибуты»,
  «Варианты». Вкладки доступны только у сохранённого товара. Остаток — только
  чтение со ссылкой на `/stock`.
- `/brands`, `/categories` переводятся на общие компоненты; `BrandModal.tsx` и
  `CategoryModal.tsx` удаляются.
- `Sidebar` — группы «Каталог», «Продажи», «Склад»; ссылка на Filament
  (`ERP_ADMIN_URL`) остаётся до этапа 5.

### Ошибки на клиенте

Интерсептор ответов в `src/lib/api.ts`:

- 401 → `logout()` + редирект на `/login`;
- 403 → toast «Нет доступа»;
- 422 → пробрасывается в форму (подсветка полей);
- 5xx / сеть → toast с общей ошибкой.

Тип и размер медиа проверяются на клиенте до отправки и в `FormRequest`.

## 3. Права

Как в Filament (`User::canAccessPanel`): доступ у `admin` и `manager`, без
разделения прав между ними. Все новые маршруты — в существующей группе
`role:admin|manager`.

## 4. Тестирование

- **PHPUnit Feature** — по тесту на контроллер в `tests/Feature/Admin/`:
  доступ (гость 401, `b2b_customer` 403, `manager` 200), валидация, счастливый
  путь, ₸→тиыны, scoped 404, бизнес-422 (удаление используемого типа цены,
  атрибута со значениями, товара с движениями), медиа через `UploadedFile::fake()`
  + `Storage::fake()`.
- **admin/** — `npx tsc --noEmit && npm run build`.
- **Playwright** (`admin/e2e`, acceptance-фикстуры): `attributes.spec.ts`,
  `catalog-groups.spec.ts`, `product-relations.spec.ts` (фото, цены по типам).
  Существующие `orders`, `products`, `stock` остаются зелёными.

Прогон тестов — через `phpunit.xml`/`.env.testing`, `.env` не трогаем.

## 5. Выкатка

- Ветка `feat/admin-catalog`, один PR. Миграций нет — все таблицы существуют.
- `deploy.yml`, nginx, `NEXT_PUBLIC_*` не меняются.
- Контракт API меняется только в `images` у `store`/`update` товара; `admin/` —
  единственный потребитель, обновляется в том же PR.

## Критерий готовности

Менеджер выполняет все каталожные операции (из списка в разделе 1) в `admin/`
без захода в Filament; PHPUnit, `tsc`/`build` и e2e этапа 1 зелёные.

## Вне этапа 1

Склад, контент, пользователи, удаление Filament — этапы 2–5. Разделение прав
admin/manager, массовые операции (bulk delete), импорт — не делаем.
