# Paradise.kz Frontend MVP Polish Design

## 1. Goal Description
The purpose of this document is to outline the fixes and polish required for the Paradise.kz storefront (Next.js) MVP based on the recent UI/UX audit. This encompasses routing, localization, data integration (auth & catalog), and UI layout fixes to prepare the frontend for production-level usage.

## 2. Scope & Approaches

### 2.1 Routing & Pages (404 Fixes)
- **Problem**: Header and footer links point to non-existent pages (`/about`, `/delivery`, `/contacts`, `/promotions`).
- **Solution**: Create basic stub pages inside `src/app/[locale]/pages/` (or directly under `[locale]`) with static placeholder content ("Раздел в разработке" / "Coming Soon").
- **Breadcrumbs**: Fix the `Главная / Главная` duplication in the Catalog and Search pages breadcrumbs.

### 2.2 Auth Integration (Middleware & Layout)
- **Problem**: `/account/*` routes are fully accessible without a session, confusing users.
- **Solution**: Implement standard Next.js Middleware check (or higher-order layout check) to verify user authentication tokens/cookies. Unauthenticated users will be redirected to `/login`.
- **Note**: This assumes a real backend endpoint for login exists and sets a token/cookie.

### 2.3 API Integration (Catalog & Products)
- **Problem**: The catalog and product pages use "Lorem Ipsum" mock data.
- **Solution**: Connect the Next.js frontend to the real Laravel backend endpoints for products. Remove mock data.
- **Out of stock handling**: Items without stock should display "Нет в наличии" and hide the "Добавить в корзину" button (or change it to "Уведомить о поступлении").

### 2.4 Localization (i18n)
- **Problem**: Mix of Russian/Kazakh on `/kk` route, raw keys in UI, and a typo in the city name.
- **Fixes**:
  - Update `src/messages/kk.json` and `ru.json` to correct "Akmaty" to "Алматы/Almaty".
  - Translate the Hero block title/text on the main page.
  - Fix the raw key `account.phoneLabel` in the profile page.
  - Ensure the Language Switcher component correctly highlights the active language based on the current locale.

### 2.5 UI/UX & Forms
- **Profile Tabs**: Fix state management in `/account/profile` so clicking tabs correctly renders the active section.
- **Profile Fields**: Fix the mapping where the user's phone number is displayed in the "Имя" field.
- **Search Form**: Enable submitting the search query on `Enter` key press, and fix the filter chip on the results page to show the actual query string instead of `q`.
- **Image CSS**: Fix the excessively tall, empty CSS container for product images on the `/product/[id]` page.
- **Debug Widget**: Remove the floating "1 Issue" dev/debug widget (likely from `nextjs-toploader` or similar package).
- **Contrast**: Improve color contrast for gray texts (Hero subtitle, out of stock labels, profile labels) to meet WCAG AA standards.

## 3. Implementation Flow
1. Scaffold missing static pages.
2. Fix localization files and Language Switcher logic.
3. Update Profile components (tabs, fields).
4. Update Search and Layout UI (CSS, floating widgets, enter key).
5. Integrate API for Catalog and Product endpoints.
6. Implement Auth check for Account routes.

## 4. Verification Plan
- **Manual Verification**: Run `npm run dev`, navigate through header links, switch languages, test search with Enter, view product mockless UI, attempt to access `/account` anonymously.
- **Contrast Check**: Inspect updated CSS colors in dev tools.
