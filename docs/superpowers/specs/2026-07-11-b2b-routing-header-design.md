# B2B Routing and Header Integration

## Purpose
Currently, the B2B routes are placed in a Next.js route group `(b2b)`, which hides the folder from the URL path, making them clash with B2C routes. Additionally, there is no entry point for users to discover the B2B portal from the main site. This design outlines the fix for the routing issue and the integration of a prominent B2B link in the global header.

## Architecture & Routing Fix
1. **Directory Renaming**: 
   Rename `src/app/(b2b)` to `src/app/b2b`.
   *Why*: This explicitly maps the routes to `/b2b/*` (e.g., `/b2b/login`, `/b2b/catalog`), aligning with the checks already present in `middleware.ts`. This prevents route collisions with `next-intl` (which handles B2C routes under `[locale]`) and provides a clean separation of concerns.
2. **Middleware**: 
   The existing `middleware.ts` already bypasses `next-intl` for paths starting with `/b2b` and correctly protects them with session checks. No changes are required here.

## UI / Components
1. **Header Link**:
   In `src/components/Header.tsx`, within the top-most grey utility bar (where "About us", "Delivery", "Contacts" reside), we will add a new link: "Стать партнером" (Become a partner).
2. **Visual Accent**:
   The link will be styled to stand out slightly from the standard text links (e.g., using a bolder font weight or a subtle accent color/icon) to attract wholesale buyers without overwhelming retail customers.
3. **Destination**:
   The link will route directly to `/b2b/login` (the entry point for B2B authentication and registration).

## Error Handling & Edge Cases
- **Existing Bookmarks**: If a user somehow bookmarked `/login` intending to reach B2B, they will now be redirected to the B2C login. This is acceptable as the app is currently in development/MVP phase.
- **Hydration/Navigation**: Since `/b2b` bypasses `next-intl`, the link from the Header (which uses `next-intl/navigation`'s `<Link>`) should ideally be a standard HTML `<a>` tag or a standard `next/link` to avoid locale prefix injection (e.g., preventing `/ru/b2b/login`).

## Testing
- Verify that `localhost:3000/b2b/login` successfully loads the B2B portal without a 404.
- Verify that B2C routes like `localhost:3000/login` correctly redirect to `/ru/login` (B2C).
- Click the "Стать партнером" link in the header and verify it navigates to the B2B login without injecting a locale prefix.
