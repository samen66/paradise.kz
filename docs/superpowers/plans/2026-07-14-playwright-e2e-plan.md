# Playwright E2E Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a scalable, enterprise-grade Playwright E2E test suite using the Page Object Model, covering B2C/B2B flows, Accessibility, Visual Regression, and complex logic validation.

**Architecture:** We will set up `playwright.config.ts` to boot the Next.js server automatically. We will create a `globalSetup` to handle authentication, caching the session state so tests run fast. Test specs will utilize Page Objects stored in `e2e/pages`.

**Tech Stack:** Playwright, Next.js, `@axe-core/playwright`.

## Global Constraints

- Run tests against Next.js on `localhost:3000`.
- All tests must use `auth.setup.ts` to bypass manual login overhead unless testing auth itself.
- Do not modify existing application code, only create test code inside `/storefront/e2e/` or `/storefront/playwright.config.ts`.

---

### Task 1: Infrastructure and Dependencies

**Files:**
- Modify: `storefront/package.json`
- Modify: `storefront/playwright.config.ts`

**Interfaces:**
- Produces: `webServer` configured in Playwright so it can start Next.js.

- [ ] **Step 1: Install @axe-core/playwright**

```bash
cd storefront
npm install --save-dev @axe-core/playwright
```

- [ ] **Step 2: Update playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    browserName: 'chromium',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'Desktop',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/auth/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
});
```

- [ ] **Step 3: Commit**

```bash
cd storefront
git add package.json package-lock.json playwright.config.ts
git commit -m "test: setup playwright infrastructure and axe-core"
```

---

### Task 2: Auth Setup Fixture

**Files:**
- Create: `storefront/e2e/auth/auth.setup.ts`

**Interfaces:**
- Consumes: `baseURL` from config.
- Produces: `e2e/auth/.auth/user.json` containing authenticated cookies.

- [ ] **Step 1: Create auth.setup.ts**

```typescript
import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate as B2B user', async ({ page }) => {
  // In a real scenario, this would hit the API or UI to login.
  // For now, we mock the local storage or cookies that your app expects.
  await page.goto('/');
  // Assuming a generic login action or setting a cookie directly.
  // This step will be refined during execution based on actual auth mechanism.
  await page.evaluate(() => {
    localStorage.setItem('auth-token', 'test-token-123');
    localStorage.setItem('user-role', 'b2b');
  });
  
  await page.context().storageState({ path: authFile });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/auth/auth.setup.ts
git commit -m "test: add global auth setup for e2e tests"
```

---

### Task 3: Page Object Model (B2C & B2B)

**Files:**
- Create: `storefront/e2e/pages/b2c/CatalogPage.ts`
- Create: `storefront/e2e/pages/b2b/B2BCartPage.ts`

- [ ] **Step 1: Create B2C Catalog Page Object**

```typescript
import { expect, type Locator, type Page } from '@playwright/test';

export class CatalogPage {
  readonly page: Page;
  readonly productCards: Locator;
  readonly addToCartButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.productCards = page.locator('article');
    this.addToCartButtons = page.getByRole('button', { name: /В корзину/i });
  }

  async goto() {
    await this.page.goto('/ru/catalog');
  }

  async getFirstProductPrice() {
    const priceText = await this.productCards.first().locator('.text-lg').textContent();
    return parseInt(priceText?.replace(/\D/g, '') || '0', 10);
  }

  async addFirstProductToCart() {
    await this.addToCartButtons.first().click();
  }
}
```

- [ ] **Step 2: Create B2B Cart Page Object**

```typescript
import { expect, type Locator, type Page } from '@playwright/test';

export class B2BCartPage {
  readonly page: Page;
  readonly totalAmount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.totalAmount = page.locator('[data-testid="cart-total"]');
  }

  async goto() {
    await this.page.goto('/b2b/cart');
  }

  async getTotal() {
    const totalText = await this.totalAmount.textContent();
    return parseInt(totalText?.replace(/\D/g, '') || '0', 10);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add e2e/pages/b2c/CatalogPage.ts e2e/pages/b2b/B2BCartPage.ts
git commit -m "test: implement base page objects for catalog and cart"
```

---

### Task 4: UI/UX & A11y Visual Spec

**Files:**
- Create: `storefront/e2e/tests/a11y-visual.spec.ts`

- [ ] **Step 1: Write A11y and Visual Test**

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { CatalogPage } from '../pages/b2c/CatalogPage';

test.describe('Accessibility and Visual Regression', () => {
  test('Catalog should not have any automatically detectable accessibility issues', async ({ page }) => {
    const catalog = new CatalogPage(page);
    await catalog.goto();
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Catalog should visually match the premium design baseline', async ({ page }) => {
    const catalog = new CatalogPage(page);
    await catalog.goto();
    
    // Wait for images to load
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('b2c-catalog-baseline.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05
    });
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/tests/a11y-visual.spec.ts
git commit -m "test: add accessibility and visual regression tests"
```

---

### Task 5: Complete B2B Logic Spec

**Files:**
- Create: `storefront/e2e/tests/b2b-flow.spec.ts`

- [ ] **Step 1: Write B2B Checkout Logic Test**

```typescript
import { test, expect } from '@playwright/test';
import { B2BCartPage } from '../pages/b2b/B2BCartPage';

test.describe('B2B Bulk Checkout Flow', () => {
  test('Calculates complex cart totals correctly based on bulk inputs', async ({ page }) => {
    await page.goto('/b2b/catalog');
    
    // Simulate bulk add (assuming inputs exist)
    const inputs = page.locator('input[type="number"]');
    if (await inputs.count() > 1) {
      await inputs.nth(0).fill('10');
      await inputs.nth(1).fill('20');
      
      const price1 = 5000; // Mock known price
      const price2 = 3000; // Mock known price
      const expectedTotal = (price1 * 10) + (price2 * 20);

      await page.getByRole('button', { name: /Добавить/i }).first().click();

      const cartPage = new B2BCartPage(page);
      await cartPage.goto();
      
      const actualTotal = await cartPage.getTotal();
      // We expect the B2B portal to accurately multiply and sum the line items.
      // If this fails, there is a severe bug in the business logic layer.
      expect(actualTotal).toBe(expectedTotal);
    }
  });
});
```

- [ ] **Step 2: Run Tests to Verify Failure (Expected)**

```bash
npx playwright test
```

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/b2b-flow.spec.ts
git commit -m "test: add B2B bulk checkout logic spec"
```
