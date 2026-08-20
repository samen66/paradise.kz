# Admin Panel Migration & Products DB Refactor

## Summary

Migrate the admin panel from Filament (PHP) to a standalone Next.js application (`/admin`) that will serve `admin.paradise.kz` in production. As the first feature, implement product creation — which requires refactoring the `products` table to decouple ERP sync fields into a separate `product_external_mappings` table, making `products` self-sufficient for locally-created items.

## Motivation

1. **Filament limitations** — need full control over admin UI/UX, consistent React stack across all frontends (shop, B2B, admin)
2. **Products table coupling** — `source` and `external_id` are NOT NULL, making it impossible to create products without МойСклад. The table mixes catalog data with ERP sync metadata.
3. **Three-subdomain architecture** — production will serve `shop.paradise.kz`, `b2b.paradise.kz`, `admin.paradise.kz` as three separate Next.js apps backed by one Laravel API.

## Scope

This spec covers:
- Database migration: products table refactoring
- Laravel Admin API: product CRUD endpoints
- `/admin` Next.js project: scaffolding + product creation page

This spec does NOT cover:
- Migrating all Filament resources to admin-panel (future work)
- Monorepo/Turborepo setup (future work, will be done when b2b is also extracted)
- B2B portal extraction from storefront (future work)

---

## 1. Database Refactoring

### 1.1 New table: `product_external_mappings`

Stores the relationship between a local product and its external ERP representation. One product can have zero or one mapping (1:0..1).

```sql
CREATE TABLE product_external_mappings (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id      BIGINT UNSIGNED NOT NULL,
    source          VARCHAR(255) NOT NULL,         -- e.g. 'moysklad'
    external_id     VARCHAR(255) NOT NULL,         -- UUID from МойСклад
    external_folder_id VARCHAR(255) NULL,          -- folder UUID
    synced_at       TIMESTAMP NULL,
    barcodes        JSON NULL,                     -- ERP barcodes
    erp_attributes  JSON NULL,                     -- ERP characteristics blob
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,

    UNIQUE KEY uniq_source_external (source, external_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product_id (product_id)
);
```

### 1.2 Columns removed from `products`

These columns move to `product_external_mappings`:
- `source` (was NOT NULL)
- `external_id` (was NOT NULL)
- `external_folder_id`
- `synced_at`
- `barcodes` (JSON — ERP-specific)
- `attributes` (JSON — ERP-specific; local structured attributes already exist in `attribute_values` table)

### 1.3 Columns remaining in `products`

Core catalog fields that apply to ALL products (both ERP-synced and locally-created):

| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| category_id | FK nullable | local category |
| brand_id | FK nullable | local brand |
| name | json (translatable) | ru/kk |
| slug | string unique | SEO URL |
| code | string nullable | SKU/article |
| article | string nullable | manufacturer article |
| description | json (translatable) nullable | ru/kk |
| retail_price | bigint unsigned nullable | in kopecks/tiyn |
| b2b_price | bigint unsigned nullable | in kopecks/tiyn |
| purchase_price | bigint unsigned nullable | in kopecks/tiyn |
| min_price | bigint unsigned nullable | in kopecks/tiyn |
| compare_at_price | bigint unsigned nullable | "was" price for strikethrough |
| stock | decimal(12,3) default 0 | aggregated free stock |
| uom | string nullable | unit of measure |
| weight | decimal(12,3) nullable | kg |
| volume | decimal(12,3) nullable | m³ |
| country | string nullable | country of origin |
| supplier | string nullable | supplier name |
| is_active | bool default true | visibility toggle |
| is_new_arrival | bool default false | "new" badge |
| is_composite | bool default false | bundle product |
| b2b_min_order_qty | int nullable | per-product B2B MOQ override |
| created_at | timestamp | |
| updated_at | timestamp | |

### 1.4 Migration strategy

A single Laravel migration that:
1. Creates `product_external_mappings`
2. Copies `source`, `external_id`, `external_folder_id`, `synced_at`, `barcodes`, `attributes` from existing `products` rows into `product_external_mappings` (data preservation)
3. Drops the migrated columns from `products`
4. Drops the `unique(source, external_id)` constraint from `products`

The `down()` method reverses this (copies data back, re-adds columns).

### 1.5 Model changes

**Product model:**
- Remove `source`, `external_id`, `external_folder_id`, `synced_at`, `barcodes`, `attributes` from `$fillable` and `$casts`
- Add `hasOne(ProductExternalMapping::class)` relationship as `externalMapping()`
- Remove `folder()` relationship (used `external_folder_id`; replace with `externalMapping->folder()` if needed)
- Helper: `$product->isErpSynced()` → `return $this->externalMapping !== null`

**New model: ProductExternalMapping:**
- `belongsTo(Product::class)`
- `$fillable`: `product_id`, `source`, `external_id`, `external_folder_id`, `synced_at`, `barcodes`, `erp_attributes`
- `$casts`: `barcodes` → array, `erp_attributes` → array, `synced_at` → datetime

### 1.6 ERP sync impact

`SyncProductsJob` and `MoySkladService` must be updated:
- When syncing, use `Product::whereHas('externalMapping', fn($q) => $q->where('source', 'moysklad')->where('external_id', $erpId))` to find existing products
- Or use `ProductExternalMapping::where('source', 'moysklad')->where('external_id', $erpId)->first()?->product`
- When creating from ERP: create `Product` first, then `ProductExternalMapping`

---

## 2. Laravel Admin API

### 2.1 Route group

```php
// routes/api.php
Route::prefix('admin')
    ->middleware(['auth:sanctum', 'role:admin|manager'])
    ->group(function () {
        Route::apiResource('products', Admin\ProductController::class);
    });
```

### 2.2 Admin\ProductController

Located at `app/Http/Controllers/Api/Admin/ProductController.php`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| index | GET /admin/products | Paginated list, filterable by category, brand, is_active, search |
| store | POST /admin/products | Create product with images via multipart/form-data |
| show | GET /admin/products/{id} | Product with relations: category, brand, media, externalMapping |
| update | PUT /admin/products/{id} | Update product fields + replace images |
| destroy | DELETE /admin/products/{id} | Soft-delete or hard-delete |

### 2.3 ProductStoreRequest (Form Request)

Validates:
- `name` → required, string, max:255
- `description` → nullable, string
- `category_id` → nullable, exists:categories,id
- `brand_id` → nullable, exists:brands,id
- `retail_price` → nullable, integer, min:0 (in tiyn)
- `b2b_price` → nullable, integer, min:0
- `is_active` → boolean
- `is_new_arrival` → boolean
- `images` → nullable, array
- `images.*` → image, max:5120 (5MB)

### 2.4 Response format

Standard JSON API response:
```json
{
  "data": {
    "id": 1,
    "name": "Кресло Палермо",
    "slug": "kreslo-palermo-1",
    "category": { "id": 5, "name": "Кресла" },
    "brand": { "id": 2, "name": "Paradise" },
    "retail_price": 15000000,
    "retail_price_formatted": "150 000 ₸",
    "images": [
      { "id": 1, "url": "https://...", "thumb": "https://..." }
    ],
    "is_erp_synced": false,
    "is_active": true,
    "created_at": "2026-08-20T14:00:00Z"
  }
}
```

---

## 3. Admin Panel (Next.js)

### 3.1 Project setup

```
/admin/
├── package.json          (next, react, tailwindcss, zustand)
├── next.config.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx    (admin shell: sidebar + topbar)
│   │   ├── page.tsx      (dashboard — placeholder)
│   │   ├── login/
│   │   │   └── page.tsx  (admin login)
│   │   └── products/
│   │       ├── page.tsx        (product list)
│   │       ├── create/
│   │       │   └── page.tsx    (product creation form)
│   │       └── [id]/
│   │           └── page.tsx    (product edit)
│   ├── components/
│   │   ├── layout/       (Sidebar, Topbar, Shell)
│   │   ├── ui/           (Button, Input, Select, FileUpload, Table)
│   │   └── products/     (ProductForm, ProductTable)
│   ├── lib/
│   │   ├── api.ts        (axios/fetch wrapper for Laravel API)
│   │   └── auth.ts       (Sanctum token management)
│   └── stores/
│       └── authStore.ts  (zustand store for admin auth state)
```

### 3.2 Product creation page

A rich form with sections:
1. **Основная информация** — name (ru/kk tabs), slug (auto-generated), description (rich text or textarea)
2. **Медиа** — drag & drop image upload, reorderable, preview
3. **Цены** — retail_price, b2b_price, compare_at_price (input in tenge, stored in tiyn)
4. **Категоризация** — category select (searchable), brand select (searchable)
5. **Физические параметры** — weight, volume, uom, country, supplier
6. **Флаги** — is_active toggle, is_new_arrival toggle

### 3.3 Auth flow

1. Admin opens `admin.paradise.kz` → redirected to login page
2. Login sends `POST /api/auth/login` → receives Sanctum token
3. Token stored in httpOnly cookie or localStorage
4. All subsequent API calls include `Authorization: Bearer {token}`
5. Middleware checks `role:admin|manager`

### 3.4 Tech stack for admin

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| State | zustand |
| HTTP | fetch (native) with wrapper |
| Auth | Laravel Sanctum (token) |
| Icons | @phosphor-icons/react (same as storefront) |

---

## 4. Verification Plan

### Automated Tests

1. **Migration test** — verify `product_external_mappings` table exists, `products` no longer has dropped columns, existing data is preserved
2. **Product API tests** — `php artisan test --filter=AdminProductControllerTest`
   - Create product without ERP mapping → 201
   - List products with pagination → 200
   - Update product → 200
   - Non-admin cannot access → 403
3. **Model tests** — `$product->isErpSynced()` returns correct values
4. **ERP sync regression** — existing `SyncProductsJob` still works after refactor

### Manual Verification

1. Run `admin/` dev server, navigate to product creation
2. Fill form, upload images, submit
3. Verify product appears in public storefront catalog
4. Verify existing МойСклад-synced products still display correctly
