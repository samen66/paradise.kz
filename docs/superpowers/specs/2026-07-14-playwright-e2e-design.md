# Playwright E2E Testing Architecture & UI/UX Evaluation Design

## 1. Goal
Implement a comprehensive, enterprise-grade End-to-End (E2E) testing suite for the Paradise.kz storefront using Playwright. The suite will cover B2C and B2B segments, evaluating UI/UX best practices, accessibility (a11y), visual regressions, and complex business logic (e.g., checkout flows and bulk order math).

## 2. Architecture: Page Object Model (POM) + Fixtures
To ensure scalability and maintainability, the test suite will follow the Page Object Model structure.

### 2.1 Directory Structure
```
storefront/e2e/
├── pages/            # Page Object classes (encapsulating locators and actions)
│   ├── b2c/
│   │   ├── CatalogPage.ts
│   │   └── CheckoutPage.ts
│   └── b2b/
│       ├── B2BCatalogPage.ts
│       └── B2BCheckoutPage.ts
├── tests/            # Actual test specs
│   ├── b2c-flow.spec.ts
│   ├── b2b-flow.spec.ts
│   └── a11y-visual.spec.ts
└── auth/             # Global setup and state
    ├── auth.setup.ts
    └── .auth/        # Saved state files (gitignored)
```

## 3. Core Capabilities

### 3.1 Visual & Accessibility (a11y) Testing
- **Visual Regression**: Use Playwright's `expect(page).toHaveScreenshot()` on critical UI components (Product Cards, B2B Tables, Checkout summary) to ensure premium styling is never broken accidentally.
- **Accessibility**: Integrate `@axe-core/playwright` to run `AxeBuilder` checks on catalog and checkout pages to ensure compliance with web accessibility standards (contrast ratios, ARIA labels, semantic HTML).

### 3.2 Authentication State
- Implement `globalSetup` (via `auth.setup.ts`) to programmatically login a test B2C user and a test B2B user.
- Save the session state (cookies/localStorage) so individual tests do not waste time logging in.

### 3.3 B2C Checkout Flow (User-Friendly UI/UX)
- Navigate catalog, apply filters.
- Interact with product cards (check for hover states and modern UI feedback).
- Add to cart and proceed to checkout.
- Validate calculation of standard retail prices.

### 3.4 B2B Bulk Flow (Dense Layout & Math Validation)
- Navigate to B2B catalog.
- Verify B2B specific layouts (tabular data, input fields instead of single buttons).
- Enter bulk quantities for multiple items.
- Assert that the complex calculation logic (`(Item A * Qty A) + (Item B * Qty B)`) precisely matches the rendered total in the B2B cart.
- Verify B2B pricing tier is respected and B2C prices are not shown.

## 4. Execution Pipeline
- Update `playwright.config.ts` to include a `webServer` configuration. This allows Playwright to automatically start Next.js (`npm run dev` or `build/start`) on `localhost:3000` before running the test suite, preventing connection errors.

## 5. Required Dependencies
- `@playwright/test` (Already installed)
- `@axe-core/playwright` (To be installed via npm)
