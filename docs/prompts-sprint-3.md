# Промпты для Claude Code — спринт 3 и хвосты

> Ветка: **`mvp/local-inventory`** (8 коммитов поверх `main`). Рабочее дерево чистое,
> тесты: **309 / 303 зелёных / 6 skipped / 0 красных**.
> Контекст задач — в `docs/mvp-plan-2026-09.md`.
>
> Каждый промпт самодостаточен: копируй блок целиком в Claude Code, по одному за раз.
> Запускай в корне проекта.

---

## Общий контекст (Claude Code прочитает его сам из CLAUDE.md, но полезно знать)

Проект работает **без внешней учётной системы**. `config('erp.provider')` = `local`,
это no-op провайдер в `app/Services/Local/`. Каталог ведётся в админке, остатки —
в локальном FIFO-журнале (`app/Services/Inventory/FifoInventoryService.php`).

Три правила, которые нельзя нарушать:

1. **Никто не пишет в `products.stock` и `product_store_stock` напрямую** — только через
   `FifoInventoryService`. Это единственный источник правды по остаткам.
2. **МойСклад не возвращаем.** Код в `app/Services/MoySklad/` доживает до задачи D4 и не должен
   получать новых вызовов.
3. **Набор тестов остаётся зелёным.** Проверка: `php artisan test --compact`.

---

## Промпт 1 — B3: форма товара теряет половину полей

```
Задача B3 из docs/mvp-plan-2026-09.md.

Форма товара в админке сохраняет только name, description, category_id, brand_id,
retail_price, b2b_price, is_active, is_new_arrival, images. Всё остальное, что есть
у товара, отредактировать негде — а раньше эти поля приезжали из ERP, которого больше нет.
Значит, теперь их вообще некому заполнить.

Что сделать:

1. app/Http/Requests/Admin/ProductSaveRequest.php — добавить правила валидации для:
   code, article, slug, compare_at_price, uom, country, supplier, weight, volume,
   min_price, purchase_price, b2b_min_order_qty.
   - slug: nullable, unique:products,slug (при обновлении — игнорировать текущий id).
     Если slug пустой, его проставит Product::booted() при создании — не ломай это.
   - Цены (retail_price, b2b_price, compare_at_price, min_price, purchase_price)
     хранятся в КОПЕЙКАХ, целыми. Проверь, в каких единицах их шлёт фронт сейчас,
     и приведи к одному виду явно — сейчас это неочевидно.
   - НЕ добавляй stock: остаток меняется только приёмкой или корректировкой
     через FifoInventoryService.

2. admin/src/app/products/[id]/page.tsx — добавить в форму инпуты для новых полей.
   Сгруппируй по смыслу (Основное / Цены / Характеристики / SEO), не сваливай в один столбец.
   Отдельно: в форме есть brand_id в состоянии и в отправке, но НЕТ селекта брендов —
   добавь его, данные бери из GET /api/admin/brands.

3. Тесты: tests/Feature/Admin/ProductCrudTest.php (новый).
   Минимум: создание товара со всеми полями сохраняет их; обновление не затирает
   поля, которых нет в запросе; попытка передать stock его не меняет; дублирующий
   slug → 422.

Проверка перед сдачей:
  php artisan test --compact          — 0 красных
  vendor/bin/pint --dirty
  cd admin && npx tsc --noEmit && npm run build
```

---

## Промпт 2 — B4: товар молча пропадает с витрины

```
Задача B4 из docs/mvp-plan-2026-09.md.

Товар не попадает в публичный каталог, если у него нет цены (PricingService вернёт null),
нет slug, он неактивен или привязан к каталожной группе (VisibilityService прячет такие
из публичного каталога — это by design, группы существуют для B2B). Менеджер этого не видит:
товар просто «не появился на сайте», и почему — непонятно.

Что сделать:

1. app/Http/Controllers/Api/Admin/ProductController.php — в index() отдавать для каждого
   товара поле issues: string[] с кодами проблем. Коды: no_price, no_slug, no_category,
   inactive, hidden_by_group, out_of_stock.
   Считай их одним-двумя запросами на всю страницу, не по товару — сейчас там уже
   есть with([...]), добавь нужное туда. N+1 недопустим.

2. Добавить AllowedFilter::callback('issues') — фильтр «только проблемные».

3. admin/src/app/products/page.tsx — показывать бейджи с человеческими подписями
   («Нет цены», «Скрыт группой», ...) и чекбокс «Только проблемные».

4. Тест: расширить или создать tests/Feature/Admin/ProductCrudTest.php —
   товар без цены помечен no_price; товар в каталожной группе помечен hidden_by_group;
   фильтр issues=1 возвращает только проблемные.

Важно: не меняй логику VisibilityService и PricingService — задача только показать
менеджеру то, что они уже решают.

Проверка:
  php artisan test --compact && vendor/bin/pint --dirty
  cd admin && npx tsc --noEmit && npm run build
```

---

## Промпт 3 — A3b: без склада всё тихо ломается

```
Задача A3b из docs/mvp-plan-2026-09.md.

Если в базе нет ни одного активного склада (stores.is_active = true), приложение ломается
неочевидно: StoreResolver::resolve() возвращает null, каталог показывает нули по остаткам,
а checkout падает на Store::findOrFail() с 404. На свежей базе склад создаёт
DefaultStoreSeeder, но его можно деактивировать руками.

Что сделать:

1. GET /api/admin/stock (app/Http/Controllers/Api/Admin/StockController.php) — добавить
   в ответ meta-флаг has_active_store.
2. admin/src/app/stock/page.tsx и admin/src/app/page.tsx (дашборд) — если активных складов
   нет, показать заметное предупреждение со ссылкой на раздел складов в Filament
   (URL строится так же, как ссылка на приёмки на странице «Склад»).
3. Тест в tests/Feature/Admin/StockApiTest.php: без активных складов has_active_store = false.

Проверка:
  php artisan test --compact && vendor/bin/pint --dirty
  cd admin && npx tsc --noEmit
```

---

## Промпт 4 — E2: админка не деплоится

```
Задача E2 из docs/mvp-plan-2026-09.md.

В docker-compose.prod.yml есть storefront и b2b-portal, а сервиса admin нет.
Dockerfile у admin/ тоже нет, и nginx-конфига для него нет. То есть админ-панель
сейчас существует только локально.

Что сделать:

1. admin/Dockerfile — по образцу b2b-portal/Dockerfile (Next.js standalone).
   Проверь, что в admin/next.config.ts стоит output: "standalone"; если нет — добавь.
2. docker-compose.prod.yml — сервис admin по образцу b2b-portal.
3. docker-compose.dev.yml — сервис admin на порту 3002.
4. deploy/nginx/admin.paradise.kz.conf — по образцу deploy/nginx/shop.paradise.kz.conf
   (HTTP → HTTPS, acme-challenge, proxy_pass на admin:3000).
5. .github/workflows/deploy.yml — собирать и пушить образ paradise-admin в GHCR
   рядом с остальными.
6. Не забудь про доступ к API из нового origin: SANCTUM_STATEFUL_DOMAINS и config/cors.php
   должны знать про admin.paradise.kz. Проверь, что там уже есть, и допиши недостающее.
7. .env.production.example — добавить переменные, которые понадобятся админке.

Ничего не деплой и не пушь — только подготовь конфигурацию.

Проверка:
  docker compose -f docker-compose.prod.yml config >/dev/null && echo OK
  cd admin && npm run build
```

---

## Промпт 5 — E3 + E4: CI и документация

```
Задачи E3 и E4 из docs/mvp-plan-2026-09.md.

E3. .github/workflows/ci.yml сейчас делает typecheck только для storefront.
Переведи job frontend-typecheck на матрицу [storefront, b2b-portal, admin] и добавь
в каждый прогон npm run build помимо tsc --noEmit.

E4. Документация отстала от кода и активно вводит в заблуждение:

- CLAUDE.md описывает проект как «Laravel 13.8 + Filament» и ничего не знает о трёх
  Next.js приложениях (storefront, b2b-portal, admin), о локальном FIFO-складе и о том,
  что ERP отключён. Перепиши раздел архитектуры по факту.
- AGENTS.md, пункт №1, утверждает «ERP — источник правды». Это ровно наоборот.
  Замени на: источник правды по остаткам — локальный FIFO-журнал (stock_movements);
  никакой код не пишет в products.stock и product_store_stock напрямую, только через
  FifoInventoryService.
- .env.production.example — убрать все MOYSKLAD_*, оставить ERP_PROVIDER=local.
- deploy/README.md — упомянуть админку, если её деплой уже настроен (задача E2).

Ничего в app/ не меняй — это чисто документация и CI.
```

---

## Промпт 6 — D4: удалить МойСклад (делать последним)

```
Задача D4 из docs/mvp-plan-2026-09.md. Делать только когда всё остальное зелёное.

Интеграция с МойСклад больше не вызывается в рантайме: провайдер по умолчанию — local,
вебхук-роут отвечает 401. Осталось убрать код и его тесты одним коммитом.

Удалить:
  app/Services/MoySklad/
  app/Console/Commands/SyncMoySkladCommand.php
  app/Console/Commands/RegisterMoySkladWebhooksCommand.php
  app/Http/Controllers/Api/MoySkladWebhookController.php
  app/Jobs/Erp/PushOrderJob.php и app/Jobs/Erp/SyncOrderStatusJob.php
  config/moysklad.php
  docs/moysklad-integration-notes.md
  tests/Feature/MoySklad/ (6 файлов)
  tests/Unit/MoySklad/ (3 файла)
  tests/Feature/Orders/PushOrderJobTest.php
  роут POST /api/moysklad/webhook из routes/api.php
  ключ 'moysklad' из карты провайдеров в config/erp.php
  строку config(['erp.provider' => 'moysklad']) из setUp() в tests/Feature/Admin/ApproveClientTest.php
    (три ERP-кейса в нём тоже уходят — остаётся approval_works_with_no_erp_connected)
  MOYSKLAD_* из .env, .env.example, .env.production.example
  docs/moysklad-api/ — он в .gitignore, удали локально

НЕ удалять:
  app/Contracts/Erp/ и app/Contracts/Catalog/ — контракты, на них написан LocalErpProvider
  app/Jobs/Catalog/* — джобы написаны на контракт, пригодятся для импорта из любого источника
  таблицу и модель product_external_mappings, колонки stores.source / external_id —
    там лежат исторические связи, и они не мешают
  колонку order_items.external_product_id — исторический снимок

После удаления проверь, что нигде не осталось ссылок:
  grep -ri moysklad app/ config/ routes/ tests/ database/

Проверка:
  php artisan test --compact   — 0 красных, тестов станет примерно на 30 меньше
  vendor/bin/pint --dirty
```

---

## После всех промптов

```bash
php artisan test --compact
php artisan migrate:fresh --seed   # склад по умолчанию, роли, типы цен
php artisan stock:recompute
```

Затем — приёмочные сценарии 1–5 из `docs/mvp-plan-2026-09.md`, раздел 9. Их надо пройти руками:
автотесты покрывают код, а не то, что менеджер реально может провести приёмку и увидеть товар на сайте.
