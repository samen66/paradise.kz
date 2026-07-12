# Frontend MVP Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement UI/UX polish, bug fixes, localization corrections, API data fetching for catalog, and auth routing protection for the Paradise.kz storefront MVP.

**Architecture:** Next.js App Router frontend connecting to a Laravel JSON API. We will use Next.js Middleware for Auth protection, create stub static pages for missing routes, and replace mock data with fetch calls to the backend API.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind CSS, next-intl.

## Global Constraints
- Target directory: `storefront`
- Framework: Next.js (App Router)
- Language: TypeScript
- Auth: Next.js Middleware checking for a valid session cookie (e.g. `auth_token`), redirecting to `/login` if absent.
- API Backend: Assumed to be on `http://localhost:8000/api` or configured via `process.env.NEXT_PUBLIC_API_URL`.

---

### Task 1: Add Stub Pages & Fix Breadcrumbs

**Files:**
- Create: `src/app/[locale]/about/page.tsx`
- Create: `src/app/[locale]/delivery/page.tsx`
- Create: `src/app/[locale]/contacts/page.tsx`
- Create: `src/app/[locale]/promotions/page.tsx`
- Modify: `src/app/[locale]/catalog/page.tsx` (breadcrumbs)
- Modify: `src/app/[locale]/search/page.tsx` (breadcrumbs)
- Modify: `src/components/Breadcrumbs.tsx` (if issue is inside component)

**Interfaces:**
- Consumes: `next-intl` for basic translation ("Раздел в разработке" / "Coming Soon").

- [ ] **Step 1: Create Stub Pages**
Create the 4 directories and `page.tsx` files inside `src/app/[locale]/` with a simple container and a text "Раздел в разработке" (or use translation key).

- [ ] **Step 2: Fix Breadcrumbs on Catalog/Search**
Identify why `Главная / Главная` is duplicated. It's likely that `/catalog` page is passing `[{label: 'Главная', href: '/'}, {label: 'Главная', href: '/'}]` to the `Breadcrumbs` component. Fix the array passed in `catalog/page.tsx` and `search/page.tsx`.

---

### Task 2: Auth Middleware & Login Redirect

**Files:**
- Modify: `src/middleware.ts`

**Interfaces:**
- Consumes: Next.js Request cookies to check for `auth_token` or similar session identifier.

- [ ] **Step 1: Protect `/account/*` routes in Middleware**
Update `src/middleware.ts` to intercept requests to `/account` (and subpaths). If the user is unauthenticated, redirect them to `/login`.

---

### Task 3: API Integration (Catalog & Products)

**Files:**
- Modify: `src/app/[locale]/catalog/page.tsx`
- Modify: `src/app/[locale]/product/[id]/page.tsx`
- Modify: `src/components/ProductCard.tsx`
- Modify: `src/components/AddToCartButton.tsx` (or similar)

**Interfaces:**
- Consumes: Laravel API endpoints (e.g. `/api/products`).

- [ ] **Step 1: Fetch Real Products in Catalog**
Replace the static Lorem Ipsum mock array in `catalog/page.tsx` with a `fetch` call to the backend API (`/api/products`).

- [ ] **Step 2: Handle "Out of Stock" State**
In `ProductCard.tsx` and `product/[id]/page.tsx`, check the product's `stock` or `in_stock` property. If false, display "Нет в наличии" and hide the "Добавить в корзину" button (or show "Уведомить о поступлении").

---

### Task 4: Localization & i18n Fixes

**Files:**
- Modify: `src/messages/kk.json`
- Modify: `src/messages/ru.json`
- Modify: `src/components/LocaleSwitcher.tsx`
- Modify: `src/components/BannerCarousel.tsx` (Hero)

- [ ] **Step 1: Fix typos and missing keys**
Update `kk.json` to change "Akmaty" to "Алматы/Almaty".
Add translations for the Hero block text (if missing) and fix the `account.phoneLabel` key to be "Телефон".

- [ ] **Step 2: Fix LocaleSwitcher Active State**
Update `src/components/LocaleSwitcher.tsx` to correctly compare the active locale using `useLocale()` from `next-intl` to determine which tab is bold/active.

---

### Task 5: UI/UX & Forms

**Files:**
- Modify: `src/app/[locale]/account/layout.tsx` or `profile/page.tsx`
- Modify: `src/components/SearchBox.tsx`
- Modify: `src/components/ActiveFilters.tsx`
- Modify: `src/components/ProductGallery.tsx` (or product page layout)
- Modify: Global layout (to remove debug widget)

- [ ] **Step 1: Fix Profile Tabs**
Ensure clicking tabs in `/account/*` correctly navigates and re-renders the page content. (Check if it's using `<Link>` correctly without preventing default).

- [ ] **Step 2: Fix Profile Fields Mapping**
In `profile/page.tsx`, ensure the user's `name` property is bound to the Name input, and `phone` to the Phone input.

- [ ] **Step 3: Search Form Enter Key & Filter Chip**
In `SearchBox.tsx`, add an `onSubmit` handler to the `<form>` or `onKeyDown` to the input to trigger search on `Enter`.
In `ActiveFilters.tsx`, map the query param `q` to display the actual text value instead of "q".

- [ ] **Step 4: Image CSS & Contrast**
Fix the height of the image container in `ProductGallery.tsx`.
Update Tailwind text color classes (e.g., `text-gray-400` to `text-gray-600`) for Hero descriptions and labels to improve contrast.

- [ ] **Step 5: Remove Debug Widget**
Find and remove the "1 Issue" floating widget from `src/app/[locale]/layout.tsx` or similar root layout files.
