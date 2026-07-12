# Paradise.kz — B2B MVP Plan

First MVP, scoped to the **B2B reseller** segment. Companion docs:
[AGENTS.md](../AGENTS.md) (rules) and
[moysklad-integration-notes.md](./moysklad-integration-notes.md) (API reference).

## Progress (as of 2026-06-26)

**Backend complete & tested — 73 passing tests.**

- ✅ T0 Foundation · T1 MoySkladClient · T2 MoySkladService+DTOs
- ✅ T3 Catalog schema/models · T8a PricingService
- ✅ API scaffold (`install:api`, Sanctum migration, routing)
- ✅ T5 Visibility (catalog groups + per-client overrides)
- ✅ T6 Auth API (register/login/me/logout + `approved` gate)
- ✅ T7 Catalog API (categories, products w/ visibility + per-client price)
- ✅ T4 Sync (jobs, 15-min schedule, secured webhook)
- ✅ T8 Order API + T9 Push-to-MoySklad job
- ✅ F1–F4 Vue 3 SPA in `/frontend` (auth, catalog, cart/checkout, order history) — `npm run build` + `vue-tsc` green
- ✅ T10–T12 Filament admin (panel access = admin/manager; client approval → MoySklad counterparty via `ApproveClient`; catalog/visibility resources; orders view + retry-push) — 79 backend tests green
- ⬜ **Remaining:** T13 hardening polish (some admin forms could be made fully read-only on MoySklad-sourced fields)

## Running it locally

```bash
# Backend (Laravel API + Filament admin)
composer install
cp .env.example .env && php artisan key:generate
# set DB + MOYSKLAD_* in .env (token, organization/store href, b2b price-type id)
php artisan migrate
php artisan db:seed                          # roles + admin@paradise.kz
php artisan db:seed --class=DemoSeeder       # demo catalog + reseller@paradise.kz (approved)
php artisan serve                            # http://localhost:8000  (admin at /admin)
php artisan queue:work                       # processes order-push + sync jobs
php artisan moysklad:sync                    # pull real catalog/stock (needs MOYSKLAD_TOKEN)

# Frontend (Vue 3 SPA) — proxies /api to localhost:8000
cd frontend && npm install && npm run dev    # http://localhost:5173
```

Demo logins after `DemoSeeder`: admin `admin@paradise.kz`, B2B client
`reseller@paradise.kz` (both password `password`). Run `php artisan test` (backend)
and `cd frontend && npm run build` (SPA typecheck) to verify.

## Goal

A reseller can: **register → get approved → browse only the catalog they're
allowed to see (live stock + their B2B price) → place an order → the order lands
in MoySklad as a `customerorder`.** Admins (Filament) approve clients, link each
to a MoySklad counterparty, and control per-client product visibility + pricing.

## Locked decisions

- **Frontend:** Vue 3 + TS SPA (separate, in `/frontend`), consuming the Sanctum
  API. Laravel stays at repo root (not `/backend`) for now to avoid restructuring
  the existing install. Filament admin lives in the Laravel app.
- **B2B price:** base price = a dedicated **MoySklad price type**
  (`MOYSKLAD_B2B_PRICE_TYPE_ID`), synced into `products.b2b_price`; **per-client
  override** on top: `users.discount_percent` (default 0) + optional
  `client_product_prices` (user_id, product_id, price) for specific overrides.
- **MoySklad = source of truth.** Catalog + stock are read-only mirrors synced by
  cron (15 min) + webhooks. Only local fields: visibility, per-client pricing.
- Each approved B2B client ↔ one MoySklad `counterparty` (the order `agent`).
- Order push is async (queued job); checkout never blocks on MoySklad.

## Pricing resolution (single rule, used by API + order push)

```
base   = products.b2b_price                         # from MoySklad price type
price  = client_product_prices[user,product] ?? base * (1 - user.discount_percent/100)
# sent to MoySklad as round(price) in kopecks
```
Implement once in `App\Services\Pricing\PricingService::priceFor(User, Product)`.

## Data model (new)

- `users` += `company_name`, `company_bin`, `is_approved` (bool), `discount_percent` (decimal, default 0), `moysklad_counterparty_id` (nullable).
- `product_folders` (moysklad_id, name, path_name, parent_id).
- `products` (moysklad_id, folder_id, name, code, article, description, retail_price, b2b_price, uom, image_url, is_active).
- `product_stock` (product_id, store_id nullable, stock) — or a `free_stock` column on products for MVP simplicity (decide in T3).
- `catalog_groups` (name) + `catalog_group_user` pivot + `catalog_group_product` pivot — group-based visibility.
- `product_visibility_overrides` (user_id, product_id, mode: allow|hide) — per-client exceptions.
- `client_product_prices` (user_id, product_id, price).
- `orders` (user_id, status, total, moysklad_order_id, moysklad_number, pushed_at, error) + `order_items` (order_id, product_id, moysklad_id snapshot, name snapshot, qty, price).

Visibility rule: a product is visible to a client if `is_active` AND
(no group restriction OR client shares a group with it) AND not hidden by an
override; an `allow` override forces-visible. Default for MVP: **visible to all
approved clients** unless an admin hides it (globally via `is_active` or
per-client via override/group). Keep the schema above so group logic can grow.

## API contract (fix early — both backend & frontend tasks depend on it)

All under `/api`, JSON, Sanctum bearer token. Prices in API responses are in
**major units** (₸), already resolved per-client; only MoySklad payloads use kopecks.

```
POST   /auth/register      {company_name, company_bin, email, phone, password} → 201 pending
POST   /auth/login         {email, password} → {token, user}
GET    /auth/me            → {user, is_approved}
POST   /auth/logout
GET    /categories         → [{id, name, parent_id}]
GET    /products           ?category=&search=&sort=&page=  → paginated {id,name,code,article,image,stock,price,in_stock}
GET    /products/{id}      → product detail
POST   /orders             {items:[{product_id, quantity}], comment} → {id, status}
GET    /orders             → paginated order history
GET    /orders/{id}        → order detail + moysklad status
POST   /moysklad/webhook   → 204 (enqueue + return fast)
```
Unapproved clients: `register`/`login`/`me` work; catalog/order endpoints return
403 until `is_approved`.

---

## Backend tasks

Each task is self-contained. Spawn a subagent with: *"Read AGENTS.md,
docs/mvp-b2b-plan.md (this section), and docs/moysklad-integration-notes.md, then
implement T#."* Follow AGENTS.md code style (PSR-12, `declare(strict_types=1)`,
early return, Conventional Commits, RU UI text / EN code).

### T0 — Foundation
- **Depends:** —
- **Do:** `config/moysklad.php` (base_url, token, organization_href, store_href, b2b_price_type_id, webhook_secret) reading env. Add env keys to `.env.example`. Roles/permissions seeder (`admin`, `manager`, `b2b_customer`). Migration extending `users` (company_name, company_bin, is_approved, discount_percent, moysklad_counterparty_id). Add `HasRoles` to User; cast new fields.
- **Done when:** `php artisan migrate` + seeder run clean; `config('moysklad.base_url')` resolves.

### T1 — MoySkladClient (low-level HTTP)
- **Depends:** T0
- **Do:** `App\Services\MoySklad\MoySkladClient` using Guzzle (already installed). Injects token + `Accept-Encoding: gzip`; methods `get($path,$query)`, `post($path,$body)`, `paginate($path,$query): iterable`; 429 backoff via `X-Lognex-Retry-After`; throws typed `MoySkladApiException`.
- **Done when:** unit test with mocked Guzzle handler covers paging + 429 retry.

### T2 — MoySkladService (domain methods)
- **Depends:** T1
- **Do:** `App\Services\MoySklad\MoySkladService`: `productFolders()`, `assortmentProducts()` (type=product, beta header), `stockCurrent($changedSince=null)`, `priceTypes()`, `createCounterparty(array)`, `createCustomerOrder(array)`. Map JSON → simple DTOs/arrays. Extract b2b price via `b2b_price_type_id`.
- **Done when:** methods return typed data; pricing extraction unit-tested against a sample `salePrices` fixture.

### T3 — Catalog DB schema + models
- **Depends:** T0
- **Do:** migrations + Eloquent for `product_folders`, `products`, `product_stock` (decide single `free_stock` column vs table — prefer column for MVP), `client_product_prices`. Models with relations + `$casts`. Factories for tests.
- **Done when:** migrations run; models tested with factories.

### T4 — Sync (jobs + scheduler + webhook)
- **Depends:** T2, T3
- **Do:** `SyncFoldersJob`, `SyncProductsJob` (upsert by moysklad_id, set b2b_price), `SyncStockJob` (stock/all/current incl. zeroLines). `php artisan moysklad:sync` command. Scheduler every 15 min (full) + `changedSince` delta. `MoySkladWebhookController` (verify, enqueue, return 204) + route. Registration command to create webhooks.
- **Done when:** `moysklad:sync` populates products+stock from a real/sandbox account or recorded fixtures; webhook returns 204 within budget.

### T5 — Visibility (our domain logic)
- **Depends:** T0, T3
- **Do:** migrations for `catalog_groups`, `catalog_group_user`, `catalog_group_product`, `product_visibility_overrides`. `App\Services\Catalog\VisibilityService` with `visibleProductQuery(User): Builder` and `canSee(User,Product): bool`. Default visible-to-approved; honor groups + overrides per the rule above.
- **Done when:** feature test: product hidden via override/group is excluded for that client but visible to others.

### T6 — Auth API (Sanctum)
- **Depends:** T0
- **Do:** routes + controllers for register (creates pending b2b_customer), login (token), me, logout. `EnsureApproved` middleware. Form requests with validation (bin format, unique email). RU validation messages.
- **Done when:** feature tests: register→pending; login returns token; protected route 403 until approved.

### T7 — Catalog API
- **Depends:** T3, T5, T6, (uses PricingService from T8a)
- **Do:** `GET /categories`, `GET /products` (spatie query-builder: filter category/search, sort, paginate), `GET /products/{id}`. Each product serialized with resolved per-client price (PricingService) + stock + `in_stock` flag, filtered through `VisibilityService::visibleProductQuery`.
- **Done when:** feature tests cover visibility filtering + per-client price in payload.

### T8a — PricingService
- **Depends:** T0, T3
- **Do:** `App\Services\Pricing\PricingService::priceFor(User,Product)` per the resolution rule; bulk variant for list endpoints. (Small; can be folded into T3 or done first.)
- **Done when:** unit tests cover base, discount %, and explicit override precedence.

### T8 — Order API
- **Depends:** T6, T7, T8a
- **Do:** `POST /orders` — validate items against visibility + stock, snapshot per-client prices into `order_items`, create `orders` (status `pending`), dispatch `PushOrderToMoySkladJob`. `GET /orders`, `GET /orders/{id}`.
- **Done when:** feature test: order persists with correct snapshot prices; push job dispatched (faked).

### T9 — PushOrderToMoySkladJob
- **Depends:** T2, T8
- **Do:** queued job: build `customerorder` payload (organization+store from config, agent = client's counterparty, positions with `price` in **kopecks**, vat=12), call `createCustomerOrder`, store `moysklad_order_id`/`moysklad_number`, set status `synced`; on failure store `error`, status `failed`, retry with backoff. Guard: client must have `moysklad_counterparty_id`.
- **Done when:** test with mocked MoySkladService asserts payload shape (kopecks!) and status transitions.

---

## Filament admin tasks

### T10 — Client management
- **Depends:** T2, T5
- **Do:** `UserResource`: list/filter b2b clients, approve action (sets `is_approved`, creates/links MoySklad counterparty via MoySkladService, stores id), edit company_name/company_bin/discount_percent, assign catalog groups. Block approval if counterparty link fails (show error).
- **Done when:** approving a client in admin creates the counterparty and flips the gate.

### T11 — Catalog admin
- **Depends:** T3, T5
- **Do:** `ProductResource` (read-mostly mirror: toggle `is_active`, view synced prices/stock, set per-client override prices), `CatalogGroupResource` (manage groups + product/client membership), visibility-override UI. Never edit stock/price-from-MoySklad fields (AGENTS.md rule #1).
- **Done when:** admin can hide a product per-client and set an override price; reflected in API.

### T12 — Orders admin
- **Depends:** T8, T9
- **Do:** `OrderResource`: list orders, status (pending/synced/failed), view items, link to MoySklad order, retry-push action.
- **Done when:** failed order can be retried from admin.

---

## Frontend tasks (Vue 3 SPA, `/frontend`)

Build against the API contract above. Stack per AGENTS.md: Vue 3 + TS +
`<script setup>`, Pinia, Vue Router, Tailwind, Vite. RU UI text.

### F1 — SPA scaffold + auth
- **Depends:** API contract (T6 stable)
- **Do:** scaffold `/frontend` (Vite + Vue 3 + TS + Pinia + Router + Tailwind). Axios instance with bearer token + 401 handling. Auth store (login/register/me/logout). Pages: Login, Register, "approval pending" screen. Route guards.
- **Done when:** can register, login, and see a gated state until approved.

### F2 — Catalog
- **Depends:** F1, T7
- **Do:** category nav, product grid (image, name, code, stock badge, B2B price), product detail page, search + filter + pagination wired to `/products`.
- **Done when:** approved client browses their visible catalog with correct prices/stock.

### F3 — Cart + checkout
- **Depends:** F2, T8
- **Do:** Pinia cart store (add/remove/qty, stock-aware), checkout view, submit `POST /orders`, confirmation. Optional comment field.
- **Done when:** client places an order end-to-end; appears in admin + MoySklad.

### F4 — Order history
- **Depends:** F3, T8
- **Do:** order list + detail with status (pending/synced/failed) and items.
- **Done when:** client sees their past orders and statuses.

---

## T13 — Hardening (last)
- Factories/seeders for demo data; feature tests for the three risk areas
  (approval gate, visibility filtering, order push payload/kopecks with mocked
  MoySklad); update README + this doc; verify `composer test` + `php artisan
  pint` green.

## Suggested execution order

```
T0 → T1 → T2                      (foundation + MoySklad layer, sequential)
T3, T8a, T5      (parallel)       (DB + pricing + visibility)
T4               (sync)
T6 → T7 → T8 → T9                 (API: auth → catalog → orders → push)
T10, T11, T12    (parallel)       (Filament)
F1 → F2 → F3 → F4                 (SPA; starts once API contract is stable)
T13                               (hardening)
```
Spawn one subagent per task with the prompt template noted under "Backend tasks".
Fix the API contract before frontend tasks start so SPA and backend don't diverge.
