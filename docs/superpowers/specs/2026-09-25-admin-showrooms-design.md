# Шоурумы: управление в админке и настоящие данные на витрине

## Контекст

На витрине (`storefront/`) есть страницы `/showrooms` и `/showrooms/[slug]`,
но все данные в них — заглушка `storefront/src/lib/showroom-data.ts`: шесть
выдуманных шоурумов в трёх городах, часы, телефоны, координаты, рейтинг,
фото с picsum и выдуманная «выкладка» товаров со статусами «Мало / Под заказ /
Выставочный образец».

В API шоурума как сущности нет. Есть склады (`stores`) с типом
`retail_point` («Точка выдачи / шоурум»): название, код, адрес, активность.
Их ведут в `admin/` на «Склад → Места хранения».

Блок «Где посмотреть вживую» в карточке товара уже строится из реальных
остатков по складам (`ProductResource::showrooms`), но ссылки ведут на
`/showrooms/{store.id}` — страница ищет шоурум по slug в заглушке и отдаёт 404.

Попутно: `GET /api/public/stores` выбирает колонки `city`, `working_hours`,
`phone`, которых в `stores` нет, — эндпоинт падает с 500. Витрины его не
вызывают (самовывоз берёт склады из `/api/public/settings`), но он публичный.

## Решения, принятые при обсуждении

1. **Шоурум = склад типа `retail_point` со своими остатками.** Приёмки и
   продажи идут по нему; наличие «в шоуруме» — FIFO-остатки этого склада.
   Отдельной таблицы нет: поля шоурума — колонки `stores`.
2. **Менеджер ведёт только карточку шоурума.** Ручной выкладки (выставочных
   образцов) нет — наличие только из остатков.
3. **Сквозная задача:** админка + публичный API + витрина читает API,
   заглушка удаляется.
4. Рейтинг/число отзывов и координаты нарисованной карты (`mx`, `my`)
   убираются — у них нет реального источника. Площадь и этажность — свободный
   текст, необязательный.
5. Раздел в админке — «Контент → Шоурумы», отдельная страница-карточка.
   «Склад → Места хранения» не меняется.

## Цели

1. Менеджер с телефона создаёт шоурум, заполняет контакты, часы, услуги,
   координаты, фото и публикует его на сайте.
2. `/showrooms` и `/showrooms/[slug]` показывают только опубликованные
   шоурумы и реальные товары в остатке.
3. Ссылки из карточки товара ведут на существующую страницу шоурума или не
   ставятся вовсе.

## Не входит

Выставочные образцы, отзывы о шоурумах, встроенная интерактивная карта,
казахские `name` и `address`, удаление шоурума с этого экрана (удаление и
выключение склада остаются на «Места хранения» со всеми проверками).

## Модель данных

Одна миграция добавляет в `stores`:

| Колонка | Тип | Назначение |
|---|---|---|
| `slug` | string(100), nullable, unique | адрес `/showrooms/{slug}` |
| `show_on_site` | boolean, default false | опубликован на странице шоурумов |
| `city` | string(100), nullable | фильтр по городу |
| `landmark` | json, nullable, translatable | ориентир: «ТРЦ Mega, 2 этаж» |
| `parking` | json, nullable, translatable | «Бесплатная парковка на 120 мест» |
| `description` | json, nullable, translatable | текст о шоуруме |
| `phone` | string(32), nullable | телефон для показа, как ввёл менеджер |
| `whatsapp` | string(20), nullable | только цифры, с 7: `77001112233` |
| `lat`, `lng` | decimal(9,6), nullable | координаты |
| `weekly_hours` | json, nullable | 7 элементов Пн→Вс, см. ниже |
| `services` | json, nullable | список ключей услуг |
| `area` | string(50), nullable | «780 м²» |
| `floors` | string(50), nullable | «2 этажа» |
| `is_flagship` | boolean, default false | бейдж «Флагман» |
| `sort_order` | unsigned int, default 0 | порядок в списке |

`name` и `address` остаются строками: они используются в складских
документах, на витрине выводятся как есть на обоих языках.

**`weekly_hours`** — массив ровно из 7 элементов, индекс 0 = понедельник:
`{"open": "10:00", "close": "21:00"}` или `null` (выходной).

**`services`** — подмножество фиксированного списка
`pickup, consult, card, kids, cafe, assembly` (константа
`Store::SHOWROOM_SERVICES`). Подписи — на клиентах.

**Модель `Store`:** `HasTranslations` (`landmark`, `parking`,
`description`), `HasMedia` + `InteractsWithMedia`. Коллекция
`Store::PHOTOS_COLLECTION = 'showroom_photos'` (много файлов, порядок —
`order_column`), конвертации `wide` (1920×1080) и `card` (800×600), webp,
качество 82 — как у `ProductCollection`. Касты для новых полей. Скоуп
`publishedShowrooms()`:

```
type = 'retail_point' AND is_active AND show_on_site AND slug IS NOT NULL
ORDER BY sort_order, name
```

Фабрика `StoreFactory` получает состояние `showroom()` — заполненный
опубликованный шоурум.

## API админки

`App\Http\Controllers\Api\Admin\ShowroomController`, маршруты внутри группы
`/api/admin` (`auth:sanctum` + `role:admin|manager`). Работает с `Store`,
но только с `type = retail_point`; иначе 404.

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/admin/showrooms` | список `retail_point` (все, включая черновики и выключенные) с обложкой |
| POST | `/admin/showrooms` | создаёт склад: `name`, `address`, `slug`; `type = retail_point`, `is_active = true`, `show_on_site = false`; пустой `slug` → `Str::slug(name)` с суффиксом `-2`, `-3`… |
| GET | `/admin/showrooms/{store}` | все поля + фото + `products_in_stock` (число товаров с остатком > 0 на этом складе) |
| PUT | `/admin/showrooms/{store}` | обновляет поля карточки |
| GET | `/admin/showrooms/{store}/photos` | фото по порядку |
| POST | `/admin/showrooms/{store}/photos` | загрузка одного файла (`file`: jpeg/png/webp, ≤ 10 МБ); не больше 20 фото |
| PUT | `/admin/showrooms/{store}/photos/order` | `ids: int[]` — новый порядок |
| DELETE | `/admin/showrooms/{store}/photos/{media}` | удаление; чужое фото — 404 (`scopeBindings`) |

Фото-эндпоинты повторяют `ProductMediaController`.

**Правка (`ShowroomRequest`)** принимает: `name` (required), `address`,
`slug`, `show_on_site`, `city`, `landmark`, `parking`, `description`
(`{ru, kk}`), `phone`, `whatsapp`, `lat`, `lng`, `weekly_hours`, `services`,
`area`, `floors`, `is_flagship`, `sort_order`. Поля `type`, `code`,
`is_active`, `is_default` здесь **не принимаются** — ими управляет
«Места хранения».

Проверки:

- `slug`: `nullable`, `regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, max 100, unique в
  `stores` (кроме себя).
- `show_on_site = true` требует непустой `slug` (`required_if`).
- `whatsapp`: `nullable`, `regex:/^7\d{10}$/`.
- `lat`: `nullable`, `numeric`, `between:-90,90`; `lng`: `between:-180,180`;
  заданы оба или ни одного.
- `weekly_hours`: `nullable`, `array`, `size:7`; элемент — `null` или объект с
  `open`/`close` формата `HH:MM` (`date_format:H:i`) и `open < close`.
- `services`: `nullable`, `array`, элементы `in:` `Store::SHOWROOM_SERVICES`,
  `distinct`.
- `landmark.*`, `parking.*` — max 255; `description.*` — max 5000.

Ответ — `ShowroomAdminResource`: поля выше, `landmark`/`parking`/`description`
как `{ru, kk}`, `is_active`
(фото — через `/photos`),
`cover_url`, `products_in_stock`, `public_url` (ссылка на витрину, если
опубликован; из `config('services.storefront.url')`).

После успешных `POST`/`PUT` и любой операции с фото — сброс кеша витрины
(см. «Свежесть данных»).

## Публичный API

`App\Http\Controllers\Api\Public\ShowroomController`, без авторизации.

**`GET /api/public/showrooms`** — опубликованные шоурумы
(`publishedShowrooms()`), без пагинации. Элемент (`PublicShowroomResource`):

```json
{
  "id": 4, "slug": "esentai", "name": "Paradise Есентай",
  "city": "Алматы", "address": "пр. Аль-Фараби, 77/8",
  "landmark": "ТРЦ Esentai Mall, 3 этаж", "parking": "…", "description": "…",
  "phone": "+7 (727) 355-11-05", "whatsapp": "77273551105",
  "lat": 43.2205, "lng": 76.928,
  "weekly_hours": [{"open": "10:00", "close": "22:00"}, …, null],
  "services": ["consult", "card", "cafe"],
  "area": "540 м²", "floors": "1 этаж", "is_flagship": false,
  "photos": [{"wide": "…", "card": "…"}],
  "products_count": 37,
  "products_preview": [{"id": 12, "slug": "…", "name": "…", "image": "…"}]
}
```

Переводимые поля — в локали запроса (как у остального публичного API).

`products_count` и `products_preview` (до 5 товаров, по убыванию остатка) —
товары с `product_store_stock.stock > 0` на этом складе, прошедшие публичную
видимость (`VisibilityService::publicProductQuery()`, как в `Public\ProductController::index`).
Счётчики — одним запросом с группировкой по складу, превью — не больше
одного запроса на шоурум (шоурумов единицы).

**`GET /api/public/showrooms/{slug}`** — то же для одного; неопубликованный
или несуществующий — 404.

Товары на странице шоурума витрина берёт существующим
`GET /api/public/products?store_id={id}&filter[in_stock]=1` (пагинация,
цены, остаток по выбранному складу уже есть).

**`ProductResource::showrooms`** — в `store` добавляется `slug`: slug
склада, если он проходит `publishedShowrooms()`, иначе `null`. Состав
списка не меняется.

**`GET /api/public/stores`** — отдаёт активные склады через существующий
`StoreResource` (`id`, `name`) вместо несуществующих колонок.

## Админка (`admin/`)

### Навигация

`navConfig.ts`: группа «Контент» → `{ href: '/showrooms', label: 'Шоурумы' }`.
В нижнюю панель не добавляется (доступ через «Ещё»).

### Список `/showrooms`

- `PageHeader` «Шоурумы» + кнопка «Добавить шоурум».
- `DataTable` (на телефоне — карточки через `DataTableCards`): миниатюра
  обложки, название, «город · адрес», статус-чип. Строка ведёт в карточку.
- Статус: «На сайте» — опубликован; «Склад выключен» — `is_active = false`
  (подсказка: включается в «Склад → Места хранения»); иначе «Черновик».
- «Добавить шоурум» — `CrudModal`: название *, адрес, slug. Slug можно
  оставить пустым — сервер составит его из названия (транслит, суффикс при совпадении).
  После создания — переход в `/showrooms/{id}`.
- Пустое состояние: «Шоурумов нет. Шоурум — это место хранения с типом
  „Точка выдачи / шоурум“ — его остатки показываются на сайте».

### Карточка `/showrooms/[id]`

Та же конструкция, что форма товара (`2026-09-24-admin-product-form-design.md`):
`FormCard`-разделы, `SectionNav` до `lg`, две колонки с `lg`, `SaveBar`
(один `PUT` на все поля), серверные 422 — у своих полей, guard ухода с
несохранёнными правками.

Разделы:

1. **Основное** — название *, slug, город, адрес, площадь, этажность,
   «Флагман», порядок, переключатель «Показывать на сайте» (выключен и с
   подсказкой, пока пуст slug).
2. **Описание** — `TranslatableField` для ориентира, парковки, описания
   (`multiline`); kk необязателен.
3. **Контакты** — телефон; WhatsApp (подсказка «номер с 7, без плюса»,
   ссылка «Проверить» → `https://wa.me/{номер}`).
4. **Часы работы** — 7 строк Пн→Вс: `Switch` «работает» + два
   `<input type="time">`. Кнопка «Как в понедельник — на все дни».
5. **Услуги** — 6 чекбоксов с подписями (`SHOWROOM_SERVICES` в
   `admin/src/lib/showrooms.ts`).
6. **Карта** — широта, долгота; поле «Ссылка из 2ГИС», из которой
   координаты извлекаются на клиенте (форматы `…/geo/{lng},{lat}` и
   `…?m={lng},{lat}`; иначе — подсказка «не нашли координаты в ссылке»).
   Ссылка «Открыть в 2ГИС» по текущим координатам.
7. **Фото** — загрузка нескольких файлов, перетаскивание порядка, удаление;
   первое — обложка. Фото загружаются сразу, мимо `SaveBar` — как
   `PhotosSection` у товара (переиспользуется, если параметризуется путём
   API; иначе — общий код выносится из `photos.ts`).

Боковая карточка «Наличие» (только чтение): «В остатке N товаров», ссылка на
«Склад → Остатки» с фильтром по этому складу, ссылка «Открыть на сайте»
(`public_url`), если опубликован.

Типы и вызовы API — `admin/src/lib/showrooms.ts`.

## Витрина (`storefront/`)

- **Удаляется** `lib/showroom-data.ts`. Нужное из него — `openStatus`,
  `scheduleRows`, `routeUrl`, `mapUrl`, `whatsappUrl`, `DAY_LABELS` —
  переносится в `lib/showrooms.ts` и переписывается под новые поля
  (`weekly_hours[i].open/close`). Ссылки 2ГИС — без сегмента города:
  карта — `https://2gis.kz/?m={lng}%2C{lat}%2F17`, маршрут —
  `https://2gis.kz/directions/points/%7C{lng}%2C{lat}%3B`.
- `lib/types.ts`: тип `Showroom` по публичному API; `ProductShowroom.store`
  получает `slug: string | null`.
- **`/showrooms`** — серверная страница делает
  `apiGet('/public/showrooms', { tags: ['showrooms'] })` и передаёт в
  `ShowroomsClient`. Чипы городов — из данных (скрыты, если город один).
  Полоска превью — `products_preview` со ссылками на `/product/{slug}`,
  «ещё N» из `products_count`. Нарисованная карта с точками удаляется;
  вместо неё у карточки ссылка «На карте 2ГИС». Без шоурумов — пустое
  состояние с контактами из `/public/settings`. Фильтр по району удаляется.
- **`/showrooms/[slug]`** — `apiGet('/public/showrooms/{slug}',
  { tags: ['showrooms', 'showroom:{slug}'] })`; 404 → `notFound()`.
  Галерея из `photos`, без рейтинга. Блок «Товары в шоуруме» — сетка
  обычных `ProductCard` из
  `/public/products?store_id={id}&filter[in_stock]=1` с нумерованной `Pagination`, как в каталоге.
  Выдуманные статусы «Мало / Под заказ / Образец» удаляются.
- **`ShowroomAvailability.tsx`** — ссылка на `/showrooms/{store.slug}`,
  только если `slug` не `null`; иначе название без ссылки.
- Строки интерфейса (подписи услуг, «Открыто до …», «Выходной», дни
  недели) — в `messages/ru.json` / `messages/kk.json` под ключом `showrooms`.

## Свежесть данных

Страницы шоурумов кешируются на 300 с (`apiGet` по умолчанию) с тегами
`showrooms` и `showroom:{slug}`. `ShowroomController` (админский) после
сохранения и после операций с фото ставит
`RevalidateStorefrontCacheJob(['showrooms', "showroom:{$slug}"])->afterCommit()`;
при смене slug — и для старого тоже. Изменения остатков страницу не
сбрасывают — достаточно 300 с.

## Тесты

PHPUnit, Feature:

- `Admin/ShowroomControllerTest` — список только `retail_point`; создание
  задаёт `type`, `is_active`, `show_on_site = false`; правка всех полей;
  `is_active`/`is_default`/`type` через этот API не меняются; склад типа
  `warehouse` → 404; проверки (`slug` формат и уникальность,
  `show_on_site` без slug, часы — размер 7, формат, `open < close`,
  неизвестная услуга, `lat` без `lng`, `whatsapp`); менеджер — 200,
  B2B-клиент — 403, гость — 401; ставится `RevalidateStorefrontCacheJob`
  (`Queue::fake()`).
- `Admin/ShowroomPhotoTest` — загрузка, лимит 20, порядок, удаление, фото
  другого склада → 404, недопустимый тип файла → 422.
- `Public/ShowroomControllerTest` — список содержит только опубликованные
  (по каждому из четырёх условий — отдельный случай), порядок
  `sort_order, name`; `/{slug}` черновика → 404; `products_count` и
  `products_preview` учитывают остаток > 0 и видимость каталога (товар в
  группе каталога не считается); переводимые поля в локали `kk`.
- `ProductResource` — `store.slug` у опубликованного шоурума, `null` у
  обычного склада.
- `GET /api/public/stores` — 200 и только активные склады.

Front-ends: `npx tsc --noEmit && npm run build` в `admin/` и `storefront/`.
Проверка в браузере: админка на ширине телефона (список, карточка,
сохранение, фото), витрина — обе страницы и ссылка из карточки товара.
