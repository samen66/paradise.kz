# B2B-портал: вход по SMS, просмотр каталога до одобрения, главная страница

Дата: 2026-09-18
Статус: дизайн согласован, ждёт ревью спека

## Цель

Снизить порог входа в B2B-портал (`b2b.paradise.kz`):

1. Регистрация — только имя, телефон и SMS-код; организация необязательна.
   Вход — по паролю или по SMS-коду.
2. Неодобренный клиент не упирается в экран «ждите», а видит каталог —
   без цен и остатков, без корзины и заказов.
3. Корень `/` — открытая главная: кто мы, стили и товары в интерьере,
   условия сотрудничества. Контент редактируется в `admin/` (не в Filament).

Три этапа независимы и выкатываются по порядку: 1 → 2 → 3.

## Принятые решения

- **Отдельные B2B-маршруты OTP**, а не переиспользование
  `/api/public/auth/otp/*`: витринный `OtpService::verify()` переводит любой
  аккаунт с этим номером в `retail` — B2B-клиент потерял бы доступ к порталу.
- **Регистрация и вход по SMS — разные маршруты**, чтобы вход не создавал
  заявку случайно.
- **Старый `POST /api/auth/register` (пароль + БИН) удаляется** вместе с
  `RegisterRequest`: других клиентов у него нет.
- **Скрытие цен — на сервере, в тех же эндпоинтах** (A1). Отвергнуты:
  отдельные `/api/preview/*` (дублирование фильтров/фасетов/пагинации) и
  скрытие на фронтенде (цены видны в DevTools).
- **Контент главной — переиспользование существующих моделей** (Б1):
  `Banner` с новым `placement`, `ProductCollection` как «стиль» с обложкой,
  новая синглтон-таблица для «Кто мы». Отвергнуты: новая модель «Образ» с
  товарами-точками на фото (отдельная подсистема, ×2–3 работы) и статика в
  коде (контент должен меняться без деплоя).
- **Каталог без цен — только зарегистрированным.** Аноним видит главную;
  чтобы листать каталог, регистрируется — это и есть заявка.

## Что найдено в текущем коде

- `routes/api.php`: `/auth/register`, `/auth/login` публичные;
  каталог, корзина, заказы, адреса — под `['auth:sanctum', 'approved', 'b2b']`.
- `AuthController::register()` создаёт B2B-аккаунт `is_approved=false` с
  обязательными `company_name`, `company_bin`, паролем.
- `OtpService` (`app/Services/Auth/OtpService.php`): лимиты 1 SMS/мин,
  5/час, TTL 5 мин, 5 попыток; код `1111` в `local`/`testing`.
  `verify()` → `findOrCreateRetailUser()` безусловно ставит `type=retail`.
- `ProductResource` общий для B2B-каталога и витрины
  (`PublicProductPresenter`); цена и остаток приходят временными атрибутами
  `resolved_price` / `resolved_stock`.
- b2b-portal: `(portal)/layout.tsx` отправляет неодобренных на `/pending`;
  `/` редиректит на `/catalog`; тексты auth-страниц захардкожены на русском,
  остальное — next-intl (`src/messages/ru.json`, `kk.json`).
- `Banner` имеет `placement` (сейчас только `home_hero`), медиа `image`
  с конверсиями `wide`/`mobile`; управляется только в Filament.
- `ProductCollection` (переводимый `title`, `slug`, `sort_order`,
  `is_active`) управляется в `admin/`; витринный `HomeController` показывает
  все активные подборки.

---

## Этап 1. Вход и регистрация по SMS

### API

Все маршруты — в группе `/api/auth`, публичные; троттлинг как на витрине
(`throttle:5,1` на отправку, `throttle:10,1` на проверку).

| Маршрут | Тело | Поведение |
|---|---|---|
| `POST /auth/otp/request` | `phone`, `intent` (`register`\|`login`), при `register` — `name`, `company_name?` | Проверяет предусловия **до** отправки SMS: `register` — номер свободен, `name` задано; `login` — номер принадлежит B2B-аккаунту. Затем `OtpService::request()`. |
| `POST /auth/otp/register` | `phone`, `code`, `name` (обяз., ≤255), `company_name` (необяз., ≤255) | `consume()` кода → создаёт `User{type=b2b, is_approved=false, name, company_name, phone, password=Hash(random 40)}`, роль `b2b_customer` → `201 {token, user}`. |
| `POST /auth/otp/login` | `phone`, `code` | `consume()` кода → B2B-аккаунт → `200 {token, user}`. |
| `POST /auth/login` | без изменений | Вход по паролю. |
| `POST /auth/register` | **удаляется** | |

Ошибки (422, поле `phone`, если не указано иное):

- `register`, номер у B2B-аккаунта — «Этот номер уже зарегистрирован. Войдите.»
- `login`, номера нет — «Номер не найден. Зарегистрируйтесь.»
- `register` или `login`, номер у розничного покупателя, гостя или сотрудника
  (`type !== b2b`) — «Этот номер используется в розничном магазине.»
  Аккаунт не меняется.
- Неверный / истёкший код — существующие сообщения `OtpService` (поле `code`).

Предусловия проверяются повторно в `otp/register` / `otp/login` (между
отправкой и вводом кода номер мог быть занят). Токен именуется `api`, как в
`AuthController::login()`.

### Сервисы

- `OtpService`:
  - `request(string $phone): void` — без изменений.
  - **новый** `consume(string $phone, string $code): string` — нынешняя
    проверка из `verify()` (поиск кода, лимит попыток, `Hash::check`,
    `consumed_at`), возвращает нормализованный номер.
  - `verify()` = `consume()` + розничная логика. **Изменение:** если по номеру
    найден аккаунт `type=b2b` — 422 «Этот номер зарегистрирован как оптовый
    клиент — войдите на b2b.paradise.kz», аккаунт не трогается.
    Код в этом случае уже погашен — это допустимо.
- **новый** `App\Services\Auth\B2bPhoneAuthService`:
  - `assertCanRequest(string $phone, string $intent): void` — предусловия.
  - `register(string $phone, string $code, string $name, ?string $companyName): User`
  - `login(string $phone, string $code): User`
  - Нормализация — `App\Support\Phone`, как в `OtpService`.
- Контроллер `App\Http\Controllers\Api\Auth\PhoneAuthController`
  (`request`, `register`, `login`) + `FormRequest`-ы в `app/Http/Requests/Auth/`.

### b2b-portal

- **`PhoneCodeForm`** (`src/components/auth/PhoneCodeForm.tsx`) — общий
  двухшаговый компонент: шаг «телефон» (+ дополнительные поля от родителя) →
  «Получить код» → шаг «код» (4 цифры, `inputMode="numeric"`,
  `autoComplete="one-time-code"`, автофокус), «Отправить ещё раз» с отсчётом
  60 с, «Изменить номер». Ошибки валидации показываются у полей.
- **`/register`**: имя*, организация (необяз.), телефон* → код →
  `setSession(token, user)` → `/catalog`.
- **`/login`**: переключатель «Пароль / SMS-код». «Пароль» — текущая форма.
  «SMS-код» — `PhoneCodeForm` с `intent=login` → `/catalog`.
- Тексты auth-страниц переводятся на next-intl (`auth.*` в `ru.json`/`kk.json`).

### Тесты (`tests/Feature/Auth/PhoneAuthTest.php`)

- register: успех (b2b, не одобрен, роль, без БИН, организация необязательна);
  `name` обязателен; номер занят → 422 до отправки SMS; неверный код; истёкший код.
- login: успех для B2B; номера нет → 422; розничный номер → 422 и `type`
  не изменился; неверный код.
- request: лимит повторной отправки сохраняется.
- `OtpAuthTest` витрины: + B2B-номер → 422, аккаунт остался `b2b`.
- `AuthTest`: тесты старого `register` удаляются вместе с маршрутом
  (удаление маршрута согласовано пользователем 2026-09-18); их покрытие
  переходит в `PhoneAuthTest`.

---

## Этап 2. Режим «ещё не одобрен»

### Доступ

| Раздел | Неодобренный | Одобренный |
|---|---|---|
| Главная `/` | ✅ | ✅ |
| Каталог, фильтры, поиск | ✅ без цен и остатков | как сейчас |
| Карточка товара | ✅ фото, описание, характеристики; без цен, остатков, шоурумов | как сейчас |
| Корзина, быстрый заказ, оформление, мои заказы | ❌ редирект на `/catalog` | как сейчас |
| Профиль, выход | ✅ | ✅ |

Видимость товаров — прежний `VisibilityService`: у нового клиента нет групп,
он видит публичный каталог.

### API

- `routes/api.php`: `GET /categories`, `/products`, `/products/{product}`
  переносятся в группу `['auth:sanctum', 'b2b']` (без `approved`).
  `POST /cart/validate`, заказы, адреса — остаются под `approved` (403).
- `ProductController` (B2B) для `! $user->is_approved`:
  - не вызывает `PricingService` и расчёт остатков;
  - ставит на каждую модель временный атрибут `hide_commercial = true`;
  - игнорирует `filter[in_stock]` и сортировку по цене (иначе по выдаче
    можно вычислить остатки и порядок цен).
- `ProductResource` при `hide_commercial`: **не включает** ключи `price`,
  `old_price`, `stock`, `in_stock`, `showrooms`; у элементов `variants` —
  `stock`, `in_stock`. Витрина флаг не ставит — её ответы не меняются.

### b2b-portal

- `(portal)/layout.tsx`: неодобренный больше не уходит на `/pending`;
  при монтировании — `GET /auth/me` и `setUser()` (одобрение подхватывается
  без перелогина). Над контентом — плашка «Заявка на рассмотрении. Менеджер
  свяжется с вами — после одобрения откроются оптовые цены и заказ».
- Маршруты `cart`, `checkout`, `quick-order`, `orders` для неодобренного —
  `router.replace('/catalog')`.
- `B2BHeader`: неодобренному не показываются корзина, «Мои заказы»,
  «Быстрый заказ».
- `ProductCard` / страница товара: при отсутствии `price` — «Цена после
  одобрения» вместо цены и кнопки «В корзину». Тип `Product.price`
  становится необязательным.
- Страница `/pending` удаляется.

### Тесты (`tests/Feature/B2b/UnapprovedCatalogTest.php`)

- Неодобренный: `/products`, `/products/{id}`, `/categories` → 200;
  в товарах нет ключей `price`, `old_price`, `stock`, `in_stock`, `showrooms`.
- `filter[in_stock]` и `sort=price` не влияют на выдачу неодобренного.
- Неодобренный: `/cart/validate`, `/orders` (GET/POST), `/addresses` → 403.
- Одобренный: цены и остатки на месте.
- Розничный токен → 403 на `/products`.
- Витринный `/public/products` — цены на месте.

---

## Этап 3. Главная `/` и её контент в `admin/`

### Страница `/` (b2b-portal)

Серверный компонент, `revalidate: 300`, данные — `GET /api/b2b/home`.
Состояние входа определяется на клиенте (токен в zustand) только для
переключения кнопок.

1. **Шапка** — логотип; гость: «Войти», «Стать партнёром»; вошедший: «Каталог».
2. **Hero** — карусель баннеров `b2b_home` (интерьерное фото во всю ширину,
   заголовок, подзаголовок); кнопка: гость — «Стать партнёром» (`/register`),
   вошедший — «Перейти в каталог». Если баннеров нет — hero выводится на фоне
   `panel` с заголовком из `messages`.
3. **Кто мы** — фото + заголовок + текст из `b2b_home_contents`.
4. **Стили / в интерьере** — подборки с `show_on_b2b_home`: крупная обложка,
   название, описание, 4–8 карточек (фото, название, без цен). Клик по товару:
   гость → `/register`, вошедший → `/product/{id}`.
5. **Условия сотрудничества** — 4 пункта (оптовые цены, склад в Алматы,
   доставка по Казахстану, персональный менеджер), статика в `messages`.
6. **CTA регистрации + подвал** — контакты из `/public/settings`.

Стиль — токены и шрифты витрины (surface/panel/ink/mint, Golos Text / Manrope),
уже подключённые в портале; ru/kk через next-intl. Прежний редирект `/` →
`/catalog` удаляется; после входа по-прежнему открывается `/catalog`.

### API

- `GET /api/b2b/home` (публичный, без авторизации):

  ```json
  {
    "data": {
      "banners": [{"id", "title", "subtitle", "url", "image", "image_mobile"}],
      "about": {"title", "text", "image"} | null,
      "collections": [{"id", "title", "slug", "description", "cover", "products": [ProductResource без цен]}]
    }
  }
  ```

  Товары — только из публичного каталога (`VisibilityService`), до 8 на
  подборку, `hide_commercial = true`. Ответ локализуется по `SetApiLocale`.

- `/api/admin/*` (`auth:sanctum` + `role:admin|manager`):
  - `banners` — `apiResource` + `POST banners/{banner}/image`,
    `DELETE banners/{banner}/image`; фильтр `filter[placement]`.
  - `product-collections` — в `store`/`update` добавляются `description`
    (ru/kk), `show_on_storefront`, `show_on_b2b_home`;
    + `POST product-collections/{id}/cover`, `DELETE …/cover`.
  - `b2b-home` — `GET` / `PUT` (`about_title`, `about_text` ru/kk) +
    `POST b2b-home/image`, `DELETE b2b-home/image`.

### Данные (миграции)

- `product_collections`: `description` json null, `show_on_storefront`
  bool default true, `show_on_b2b_home` bool default false.
  Медиа-коллекция `cover` (singleFile, конверсии `wide` 1920×1080 и
  `card` 800×600, webp).
- `b2b_home_contents` (синглтон, одна строка): `id`, `about_title` json,
  `about_text` json, timestamps; медиа-коллекция `about_image`.
  Доступ через `B2bHomeContent::current()` (по образцу `CatalogSetting`).
- `Banner`: константа `PLACEMENT_B2B_HOME = 'b2b_home'`; схема не меняется.
- Витринный `HomeController::collections()` фильтрует
  `where('show_on_storefront', true)`.

### admin/

- Раздел **«Баннеры»** (`admin/src/app/banners`): таблица с фильтром по месту
  («Главная магазина» / «B2B-главная»), модалка создания/редактирования
  (заголовок и подзаголовок — `TranslatableField`, ссылка, место, порядок,
  активен), загрузка/замена/удаление фото. Пункт в навигации.
- **«Подборки»** (`admin/src/app/product-collections/[id]`): обложка,
  описание ru/kk, флажки «На главной магазина» / «На B2B-главной».
- Экран **«B2B-главная»** (`admin/src/app/b2b-home`): заголовок, текст ru/kk,
  фото блока «Кто мы».
- Всё — на общих компонентах `admin/src/components/ui` и `lib/crud.ts`.

### Тесты

- `tests/Feature/B2b/B2bHomeTest.php`: только активные баннеры `b2b_home`;
  только активные подборки с `show_on_b2b_home`; в товарах нет ключей цен и
  остатков; товары из закрытых групп не попадают; `about` = null при пустом
  синглтоне; доступ без токена.
- Витрина: подборка с `show_on_storefront=false` не попадает в `/public/home`.
- Admin: CRUD баннеров, загрузка фото, поля подборок, `b2b-home` GET/PUT,
  403 для `b2b_customer`.
- Фронтенды: `npx tsc --noEmit && npm run build` в `b2b-portal/` и `admin/`,
  ручная проверка в браузере (:3001, :3002).

---

## Вне объёма

- Товары-точки на интерьерных фото, отдельная модель «Образ».
- Сбор БИН после регистрации самим клиентом (менеджер дозаполняет в `admin/`).
- Установка пароля для аккаунтов, созданных по SMS (входят по SMS;
  при необходимости пароль задаёт менеджер).
- Уведомление менеджера о новой заявке.
- Регистрация в портале номера, уже известного витрине (в т.ч. гостевой
  заказ) — отказ «используется в розничном магазине»; перевод таких
  аккаунтов в B2B делает менеджер.
