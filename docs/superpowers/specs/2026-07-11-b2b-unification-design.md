# B2B & B2C Unification in Next.js

## Overview
This document outlines the architectural decision to unify the B2B and B2C frontends into a single Next.js (App Router) application. Previously, B2B was planned as a separate Vue 3 SPA (`/frontend`). Moving B2B into the `/storefront` (Next.js) project reduces maintenance overhead and allows sharing UI components (Tailwind) between retail and wholesale portals.

## Architecture & Routing
We will use Next.js Route Groups and explicit paths to separate the experiences while keeping them in one project.

- **B2C (Retail):** Routes like `/`, `/catalog`, `/cart`. Uses `(b2c)/layout.tsx` for a marketing-focused header and footer.
- **B2B (Wholesale):** Routes prefixed with `/b2b`, like `/b2b/login`, `/b2b/catalog`, `/b2b/orders`. Uses `(b2b)/layout.tsx` with a dashboard-style sidebar and compact header.

## Authorization & Protection
- Laravel Sanctum provides token/cookie-based authentication.
- **Next.js Middleware:** `middleware.ts` will intercept requests to `/b2b/*` (except `/b2b/login` and `/b2b/register`).
- If unauthenticated, redirect to `/b2b/login`.
- If authenticated but `is_approved === false`, redirect to `/b2b/pending` (Waiting for moderation).

## State Management & Components
- **Zustand Stores:** We will maintain strict separation for business logic. There will be two distinct cart stores: `useB2cCart` and `useB2bCart`. This prevents mixing retail pricing logic with wholesale pricing/discount rules.
- **Shared Components:** Base UI components (Buttons, Inputs, Modals) in `src/components/ui` will be shared.
- **Specific Components:** Distinct product views will be built. B2C will use large visual product cards. B2B will use compact, table-like rows (`B2BProductRow`) optimized for bulk ordering.

## Migration Path
1. Update `AGENTS.md` rules to reflect the deprecation of the Vue 3 SPA.
2. Delete the `/frontend` directory.
3. Scaffold the `/b2b` route structure within `/storefront/app`.
4. Implement B2B pages (Auth, Catalog, Cart, Orders) consuming the already-completed Laravel B2B API endpoints.
