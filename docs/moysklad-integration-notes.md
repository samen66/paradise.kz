# MoySklad Integration Notes (remap 1.2)

Distilled, implementation-ready reference for the Paradise.kz B2B integration.
Source of truth is the full docs in `docs/moysklad-api/` — this file is the
short version so tasks don't have to re-read everything. When in doubt about a
field, verify against the real docs (AGENTS.md rule #6).

- **Base URL:** `https://api.moysklad.ru/api/remap/1.2`
- **Every request** must send `Accept-Encoding: gzip` (server returns 415 without it).
- **Auth header:** `Authorization: Bearer <token>`.
- **Date format:** `YYYY-MM-DD HH:MM:SS`.
- **Prices are in KOPECKS** (minor units): `100.00 ₸/₽` → `10000`. Always store/send `price * 100` as integer.

## 1. Auth

```
POST /security/token
Authorization: Basic base64(login:password)
Accept-Encoding: gzip
→ 200 { "access_token": "..." }
```
Generating a new token revokes previous ones. For a single integration account,
generate once and store the token in env (`MOYSKLAD_TOKEN`). Basic Auth also works
directly, but token is preferred.

## 2. Paging / filtering

- `?limit=1000&offset=0` — max limit is **1000**.
- Response `meta`: `{ size, limit, offset, nextHref, previousHref }` — follow `nextHref` to page.
- Filter: `?filter=field=value;field2>value2`. Operators: `=`, `!=`, `<`, `>`, `<=`, `>=`, `~` (contains), `=~` (starts), `~=` (ends).
- Incremental sync: `?filter=updated>=2026-06-26 12:00:00`.
- `?expand=field,field2` to inline linked objects (assortment expand limited to `product,images,components`).
- `?search=term` — prefix search over name/code/article/description/barcode.
- Rate limit headers: `X-RateLimit-Remaining`, `X-Lognex-Retry-After` (ms). On 429, back off by `X-Lognex-Retry-After`. 1073 = too many concurrent requests.

## 3. Catalog

**Categories:** `GET /entity/productfolder` → folders (`id`, `name`, `pathName`, `productFolder` parent meta).

**Products (fast, no stock):**
```
GET /entity/assortment?filter=type=product&limit=1000&offset=0
Header: X-Lognex-Remap-Beta-Feature: assortmentWithoutStock
```
Key fields per row: `id`, `meta`, `name`, `code`, `article`, `description`,
`productFolder.meta`, `uom.meta`, `images.meta`, `barcodes[]`, `buyPrice.value`,
`salePrices[]` (see pricing below).

**Images:** `GET /entity/product/{id}/images` → each image has
`meta.downloadHref` (temp, 1 min), `miniature.downloadHref`, and `tiny.href`
(public thumbnail, no auth — good for web display). For a permanent link add
`?fields=downloadPermanentHref`.

## 4. Pricing (B2B price type)

Each product's `salePrices` is an array; each entry:
```json
{
  "value": 150000,
  "priceType": {
    "id": "672559f1-cbf3-11e1-9eb9-889ffa6f49fd",
    "name": "Оптовая цена",
    "meta": { "href": ".../context/companysettings/pricetype/672559f1-...", "type": "pricetype" }
  }
}
```
- List all price types: `GET /context/companysettings/pricetype`.
- **B2B base price = the `salePrices` entry whose `priceType.id` == `MOYSKLAD_B2B_PRICE_TYPE_ID`** (set in config). Store its `value` (already in kopecks) into `products.b2b_price`.
- Per-client final price is computed locally (override table / discount %), MoySklad only supplies the base.

## 5. Stock

Fast current stock (preferred for sync):
```
GET /report/stock/all/current?stockType=stock          → [{ assortmentId, stock }]
GET /report/stock/all/current?changedSince=2026-06-26 12:00:00   (delta, ≤24h back)
GET /report/stock/bystore/current                       → [{ assortmentId, storeId, stock }]
```
- `stockType`: `stock` (physical), `reserve`, `inTransit`, `quantity`, `freeStock` (= stock − reserve). For "what can I sell" use `freeStock` or `quantity`.
- `assortmentId` matches `products.moysklad_id`.
- Default omits zero lines; add `?include=zeroLines` to get zeros (needed to zero-out our mirror).

## 6. Counterparty (the B2B client in MoySklad)

```
POST /entity/counterparty
{ "name": "ТОО Покупатель", "companyType": "legalKZ", "inn": "<БИН>", "email": "...", "phone": "..." }
```
- `companyType` (KZ): `legalKZ`, `entrepreneurKZ`, `individualKZ` (also RU `legal`/`entrepreneur`/`individual`).
- `inn` holds БИН for KZ legal entities.
- Reference an existing one by its `meta` link.
- Created/linked at client **approval**; store `id` in `users.moysklad_counterparty_id`.

## 7. Organization & Store (config, fetched once)

```
GET /entity/organization   → pick our legal entity, store its meta.href in config
GET /entity/store          → pick warehouse(s), store meta.href in config
```

## 8. Create customer order (the order we push)

```
POST /entity/customerorder
```
Required: `organization` (meta) + `agent` (meta = counterparty). Everything else
optional/auto. Minimal one-line example:
```json
{
  "organization": { "meta": { "href": ".../entity/organization/<id>", "type": "organization", "mediaType": "application/json" } },
  "agent":        { "meta": { "href": ".../entity/counterparty/<id>", "type": "counterparty", "mediaType": "application/json" } },
  "store":        { "meta": { "href": ".../entity/store/<id>", "type": "store", "mediaType": "application/json" } },
  "description": "Order #123 from paradise.kz",
  "positions": [
    {
      "assortment": { "meta": { "href": ".../entity/product/<productId>", "type": "product", "mediaType": "application/json" } },
      "quantity": 5,
      "price": 150000,        // KOPECKS (per-client resolved price * 100)
      "discount": 0,
      "vat": 12
    }
  ]
}
```
Response: `{ id, meta, name (auto order number), sum }`. Store `id` →
`orders.moysklad_order_id` and `name` → `orders.moysklad_number`.

Positions can also be added via `POST /entity/customerorder/{id}/positions`.

## 9. Webhooks

```
POST /entity/webhook
{ "url": "https://paradise.kz/api/moysklad/webhook", "action": "UPDATE", "entityType": "product" }
```
- `action`: `CREATE` | `UPDATE` | `DELETE`. `entityType`: `product`, `customerorder`, `counterparty`, …
- Entity payload: `{ auditContext, events: [{ meta:{type,href}, action, updatedFields[] }] }`.
- **Stock is a separate webhook** (`POST /entity/webhookstock`, keyword `webhookstock`) with a different payload: `{ stockType, reportType, reportUrl }` where `reportUrl` already carries `?changedSince=…` — fetch it for the delta.
- Must respond **200/204 within 1500 ms** (just enqueue a job and return). 3 retries on failure. The `requestId` query param is stable across retries — use it for idempotency.

### How this repo implements it

- **Receiver:** [`MoySkladWebhookController`](../app/Http/Controllers/Api/MoySkladWebhookController.php) verifies the shared secret (embedded in the registered URL as `?secret=`), dedupes on `requestId` (cache, 10 min), then dispatches:
  - `product` CREATE/UPDATE → `SyncSingleProductJob(id)` — targeted single-product fetch (`GET /entity/product/{id}`), **not** a full re-sync. `id` is parsed from `events[].meta.href`.
  - `product` DELETE → `DeactivateProductJob(id)` — flips `is_active=false`, keeps the row.
  - stock webhook → `SyncStockJob(changedSince)`, coalesced via `WithoutOverlapping` so bursts collapse.
  - `store` CREATE/UPDATE → `SyncStoresJob` — re-mirrors all warehouses (few rows, idempotent upsert), so a new/renamed warehouse appears for clients instantly.
  - `customerorder` UPDATE → `SyncOrderStatusJob(id)` — fetches `GET /entity/customerorder/{id}?expand=state` and writes the state name to `orders.moysklad_state` (matched by `moysklad_order_id`; orders created directly in MoySklad are ignored).
- **Echo-loop guard:** `MoySkladService::createCustomerOrder()` sends the `X-Lognex-WebHook-DisableByPrefix` header so MoySklad does NOT fire our own `customerorder` webhook back at us for our writes. We also only subscribe to `customerorder` UPDATE (not CREATE).
- **Registration:** `php artisan moysklad:webhooks` reconciles the subscriptions in `config('moysklad.webhooks')` against the account (idempotent; `--prune` removes stale ones). Run once after deploy / when the callback URL changes.
- **Fallback:** the 15-min `moysklad:sync` cron still runs and covers any missed event.
- **Deferred (2nd pass):** `counterparty` webhooks (sync client edits made in MoySklad back to our users).
