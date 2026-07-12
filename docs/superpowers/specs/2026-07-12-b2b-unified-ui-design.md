# B2B Unified UI — Reuse B2C Components with Wholesale Pricing & Min Order Qty

## Background

The current B2B portal (`/b2b/`) has its own sidebar layout, a flat product list (`B2BProductRow`), a simplified cart, and no product detail page, checkout form, filters, categories, or pagination. Meanwhile, the B2C storefront (`/[locale]/`) has a polished UI with a full `CatalogView` (filters, sort, pagination), rich `ProductCard`, `ProductGallery`, full cart with server-side validation, and a multi-step checkout form.

**Goal:** Replace the B2B portal's custom UI with the same components B2C uses, so B2B partners get the identical shopping experience — only seeing wholesale prices and respecting minimum order quantities.

## Architecture Decision

**Approach:** Keep `/b2b/` as a separate route group (separate auth, separate middleware), but internally the B2B pages import and render the same shared components as B2C. A React context (`B2BContext`) tells components when to show B2B-specific behavior.

**Why not merge into `/[locale]/`:**
- B2B has its own auth flow (login → approval gate → access)
- B2B middleware checks `laravel_session` cookie, B2C uses `next-intl` middleware
- Separate URLs make it easy to share "partner portal" links
- No SEO/crawling conflict between B2C and B2B catalogs

## Changes

---

### 1. Backend: Add `b2b_min_order_qty` field

#### [NEW] Migration: `add_b2b_min_order_qty_to_products_table`

Adds `b2b_min_order_qty` (unsigned integer, nullable) to `products` table. `null` means "use global default."

```php
$table->unsignedInteger('b2b_min_order_qty')->nullable()
    ->comment('Per-product B2B minimum order qty. null = use global default.');
```

#### [MODIFY] `CatalogSetting` model + migration

Add `b2b_default_min_order_qty` (unsigned integer, default 1) to `catalog_settings` table.

```php
$table->unsignedInteger('b2b_default_min_order_qty')->default(1);
```

Add to `$fillable` and `casts` on the model.

#### [MODIFY] Filament `CatalogSettings` page

Add a new field in the settings form:
```php
TextInput::make('b2b_default_min_order_qty')
    ->label('Минимальное кол-во заказа для B2B (по умолчанию)')
    ->helperText('Применяется ко всем товарам, у которых не указано своё значение.')
    ->numeric()
    ->minValue(1)
    ->default(1)
    ->required(),
```

#### [MODIFY] Filament Product form (`ProductForm.php`)

Add field:
```php
TextInput::make('b2b_min_order_qty')
    ->label('Мин. кол-во для B2B')
    ->helperText('Оставьте пустым, чтобы использовать глобальную настройку.')
    ->numeric()
    ->minValue(1)
    ->nullable(),
```

#### [MODIFY] `Product` model

Add `b2b_min_order_qty` to `$fillable` and `casts`:
```php
'b2b_min_order_qty' => 'integer',
```

Add accessor:
```php
public function effectiveB2bMinOrderQty(): int
{
    return $this->b2b_min_order_qty
        ?? CatalogSetting::current()->b2b_default_min_order_qty
        ?? 1;
}
```

#### [MODIFY] `ProductResource`

Add `b2b_min_order_qty` to the serialized output (always present, resolved to effective value):
```php
'b2b_min_order_qty' => $this->resource->effectiveB2bMinOrderQty(),
```

This field is always returned (both public and B2B endpoints). The frontend only uses it when the user is a B2B partner.

---

### 2. Frontend: B2B Context

#### [NEW] `src/lib/b2b-context.tsx`

A React context that B2B layout provides to all children:

```typescript
interface B2BContextValue {
  isB2B: true;
  token: string;
  user: ApiUser;
}

const B2BContext = createContext<B2BContextValue | null>(null);

export function useB2BContext() {
  return useContext(B2BContext);
}
```

Components check `useB2BContext()` — if non-null, they are in B2B mode. This is how `ProductCard`, `AddToCartButton`, cart, and checkout know to use B2B pricing and min qty logic.

---

### 3. Frontend: B2B Layout Rewrite

#### [MODIFY] `src/app/b2b/layout.tsx`

**Current:** Root layout with sidebar, inline `<html>` tag, no Header/Footer.

**New:** 
- Import and render the same `Header` + `Footer` as B2C `[locale]/layout.tsx`
- Add a `B2BProvider` wrapper that provides `B2BContext`
- Add a small "B2B Партнёр" badge in the Header (via a prop or context)
- Auth guard remains (redirect to `/b2b/login` if not authenticated or not approved)
- The layout fetches categories and settings like B2C layout does
- Uses the same fonts (`Golos_Text`, `Manrope`) as B2C

**Important:** Because B2B routes are NOT under `[locale]`, `next-intl` server functions (`getTranslations`, `setRequestLocale`) are unavailable. B2B pages will either:
- Use client-side `useTranslations` with a hardcoded `ru` locale, OR
- Wrap pages in `NextIntlClientProvider` with manually loaded messages

For MVP, we hardcode `ru` locale for B2B (the primary audience is Kazakh B2B partners who all communicate in Russian).

---

### 4. Frontend: B2B Pages

#### [NEW] `src/app/b2b/catalog/page.tsx` (rewrite)

Server component that renders `CatalogView` — same as B2C catalog, calling the **B2B authenticated endpoint** (`GET /api/products` with B2B token) instead of `GET /api/public/products`.

**Implementation detail:** `CatalogView` currently calls `apiGet("/public/products", ...)`. For B2B, we need it to call `apiGet("/products", { token })`. This means `CatalogView` needs an optional `apiBasePath` and `token` prop.

Alternative: B2B catalog page can fetch products itself and pass them to a `CatalogGrid` component extracted from `CatalogView`. This avoids changing the existing server component API.

**Chosen approach:** Extract a `CatalogGrid` presentational component from `CatalogView` and reuse it in both B2C and B2B catalog pages. Each page fetches data from its own API endpoint.

#### [NEW] `src/app/b2b/catalog/[slug]/page.tsx`

Category page for B2B, mirrors B2C's `[locale]/catalog/[slug]/page.tsx`.

#### [NEW] `src/app/b2b/product/[slug]/page.tsx`

Product detail page for B2B, mirrors B2C's `[locale]/product/[slug]/page.tsx` but:
- Fetches from `GET /api/products/{slug}` with B2B token (returns B2B price via `resolved_price`)
- Shows `min_order_qty` badge if > 1
- `AddToCartButton` starts at `min_order_qty` instead of 1

#### [MODIFY] `src/app/b2b/cart/page.tsx` (rewrite)

Replace the simplified cart with the same rich cart UI from B2C (`[locale]/cart/page.tsx`):
- Same layout (card list + sidebar summary)
- Quantity stepper enforces `min_order_qty` as floor
- Uses `useB2bCart` store (not `useCart`)
- Cart validation calls `POST /api/cart/validate` or equivalent B2B endpoint

#### [NEW] `src/app/b2b/checkout/page.tsx`

Full checkout form, same design as B2C (`[locale]/checkout/page.tsx`):
- Contact info (pre-filled from B2B user)
- Delivery method (pickup / delivery)
- Store selection
- Order summary
- Submits to `POST /api/orders` with B2B token

---

### 5. Frontend: Component Changes

#### [MODIFY] `ProductCard.tsx`

Add awareness of B2B context:
- If B2B context exists, show `b2b_price` label (e.g., "Оптовая цена")
- Show min order qty badge if `b2b_min_order_qty > 1` and context is B2B
- Link paths prefix with `/b2b` when in B2B mode (e.g., `/b2b/product/{slug}`)

Since `ProductCard` is a server component, it will receive an optional `isB2B` prop instead of using context.

#### [MODIFY] `AddToCartButton.tsx`

When in B2B mode (via context or prop):
- Use `useB2bCart.addItem()` instead of `useCart.add()`
- Initial quantity = `product.b2b_min_order_qty` (default 1)
- Cannot reduce quantity below `min_order_qty`

#### [MODIFY] `ProductGallery.tsx`

No changes needed — fully reusable as-is.

#### [MODIFY] `FilterSidebar.tsx`, `SortSelect.tsx`, `Pagination.tsx`

No changes needed — fully reusable. Pagination paths will be relative (already use `pathname` prop).

---

### 6. Frontend: Shared Types

#### [MODIFY] `src/lib/types.ts`

Add `b2b_min_order_qty` to `Product` interface:
```typescript
export interface Product {
  // ... existing fields ...
  b2b_min_order_qty?: number;
}
```

---

### 7. Cleanup

#### [DELETE] `src/components/b2b/B2BProductRow.tsx`

No longer needed — replaced by `ProductCard`.

#### [DELETE] `src/stores/useB2bCart.ts` — KEEP

Actually keep this store. It's already functional and clean. We'll reuse it in the new B2B cart/checkout pages.

---

### 8. Backend: B2B Cart Validation

#### [MODIFY] B2B `ProductController` (existing `app/Http/Controllers/Api/ProductController.php`)

Ensure `b2b_min_order_qty` is included in the response by calling `effectiveB2bMinOrderQty()` via `ProductResource` (already handled by adding the field to `ProductResource`).

#### [MODIFY] `CartController` or order creation validation

When creating orders for B2B users, validate that each line item's quantity >= `product.effectiveB2bMinOrderQty()`. Return validation error if violated.

---

## What We Are NOT Doing

- Not merging B2B and B2C into a single route group
- Not adding i18n (kk locale) to B2B — hardcoded `ru` for MVP
- Not changing B2B auth flow (login/register/pending stays as-is)
- Not changing B2B pricing logic (PricingService already handles this correctly)
- Not adding AI features or marketplace functionality

## Summary of New/Modified Files

### Backend
| Action | File |
|--------|------|
| NEW | Migration: `add_b2b_min_order_qty_to_products_table` |
| NEW | Migration: `add_b2b_default_min_order_qty_to_catalog_settings` |
| MODIFY | `app/Models/Product.php` |
| MODIFY | `app/Models/CatalogSetting.php` |
| MODIFY | `app/Http/Resources/ProductResource.php` |
| MODIFY | `app/Filament/Pages/CatalogSettings.php` |
| MODIFY | `app/Filament/Resources/Products/Schemas/ProductForm.php` |
| MODIFY | Order creation validation (enforce min qty for B2B) |

### Frontend
| Action | File |
|--------|------|
| NEW | `src/lib/b2b-context.tsx` |
| REWRITE | `src/app/b2b/layout.tsx` |
| REWRITE | `src/app/b2b/catalog/page.tsx` |
| NEW | `src/app/b2b/catalog/[slug]/page.tsx` |
| NEW | `src/app/b2b/product/[slug]/page.tsx` |
| REWRITE | `src/app/b2b/cart/page.tsx` |
| NEW | `src/app/b2b/checkout/page.tsx` |
| MODIFY | `src/components/ProductCard.tsx` (add `isB2B` prop) |
| MODIFY | `src/components/AddToCartButton.tsx` (B2B cart + min qty) |
| MODIFY | `src/lib/types.ts` (add `b2b_min_order_qty`) |
| DELETE | `src/components/b2b/B2BProductRow.tsx` |

## Verification Plan

### Automated Tests
```bash
php artisan test --filter=B2B
php artisan test --filter=PricingService
php artisan test --filter=ProductResource
```

### Manual Verification
1. Login as B2B partner → navigate `/b2b/catalog` → verify same grid layout as B2C
2. Click product → verify product detail page shows B2B price
3. Verify min order qty badge shown when > 1
4. Add to cart → verify quantity can't go below min_order_qty
5. Complete checkout → verify order created with B2B pricing
6. Filament admin → set global min_order_qty → verify it reflects on frontend
7. Filament admin → set per-product min_order_qty → verify override works
8. Verify B2C experience is unchanged (no regression)
