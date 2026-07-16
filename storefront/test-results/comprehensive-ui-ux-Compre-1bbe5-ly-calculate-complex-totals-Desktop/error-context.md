# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: comprehensive-ui-ux.spec.ts >> Comprehensive UI/UX and Business Logic Test Suite >> B2B User Flow & UI/UX Evaluation >> should stimulate bulk actions and correctly calculate complex totals
- Location: e2e/comprehensive-ui-ux.spec.ts:97:9

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.waitFor: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('article, .product-item').first() to be visible
    - waiting for" http://localhost:3000/b2b/login" navigation to finish...
    - navigated to "http://localhost:3000/b2b/login"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - heading "Вход для оптовиков" [level=1] [ref=e4]
    - generic [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e7]: Номер телефона
        - textbox "+7 (___) ___-__-__" [ref=e8]
      - generic [ref=e9]:
        - generic [ref=e10]: Пароль
        - textbox "••••••••" [ref=e11]
      - button "Войти" [ref=e12]
    - generic [ref=e13]:
      - text: Нет аккаунта?
      - link "Зарегистрироваться" [ref=e14] [cursor=pointer]:
        - /url: /b2b/register
  - alert [ref=e15]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Comprehensive UI/UX and Business Logic Test Suite', () => {
  4   |   test.describe('B2C User Flow & UI/UX Evaluation', () => {
  5   |     test.beforeEach(async ({ page }) => {
  6   |       // Assuming Next-intl redirects to a default locale like /ru
  7   |       await page.goto('/ru'); 
  8   |     });
  9   | 
  10  |     test('should have premium styling and responsive layout on the homepage', async ({ page, isMobile }) => {
  11  |       // 1. Evaluate Visual Hierarchy & Styling (UI)
  12  |       const header = page.locator('header').first();
  13  |       await expect(header).toBeVisible();
  14  |       
  15  |       // Check for sticky header and backdrop-blur (Premium UI practice)
  16  |       const headerClasses = await header.getAttribute('class');
  17  |       expect(headerClasses).toContain('sticky');
  18  |       expect(headerClasses).toContain('backdrop-blur');
  19  | 
  20  |       // Check Typography and Colors
  21  |       const body = page.locator('body');
  22  |       const fontFamily = await body.evaluate((el) => window.getComputedStyle(el).fontFamily);
  23  |       expect(fontFamily).not.toBe('Times New Roman'); // Ensuring modern font is applied
  24  | 
  25  |       // 2. Evaluate User-Friendliness (UX)
  26  |       // Call-to-actions should be accessible and visible
  27  |       const catalogLink = page.getByRole('link', { name: /Каталог/i }).first();
  28  |       if (!isMobile) {
  29  |         await expect(catalogLink).toBeVisible();
  30  |         await expect(catalogLink).toHaveCSS('cursor', 'pointer');
  31  |       }
  32  | 
  33  |       // Check Hover states for interactable elements
  34  |       const cartIcon = page.locator('a[href*="/cart"]').first();
  35  |       await expect(cartIcon).toBeVisible();
  36  |       const cartTransition = await cartIcon.evaluate((el) => window.getComputedStyle(el).transition);
  37  |       expect(cartTransition).toContain('opacity'); // Checking for smooth micro-interactions
  38  |     });
  39  | 
  40  |     test('should correctly simulate B2C shopping flow and calculate totals', async ({ page }) => {
  41  |       // Navigate to Catalog
  42  |       await page.goto('/ru/catalog');
  43  | 
  44  |       // Wait for products to load
  45  |       const productCard = page.locator('article, .group').first();
  46  |       await expect(productCard).toBeVisible();
  47  | 
  48  |       // Ensure product images have proper aspect ratios and object-fit (UI best practice)
  49  |       const image = productCard.locator('img').first();
  50  |       await expect(image).toBeVisible();
  51  |       const objectFit = await image.evaluate((el) => window.getComputedStyle(el).objectFit);
  52  |       expect(['cover', 'contain']).toContain(objectFit);
  53  | 
  54  |       // Extract price
  55  |       const priceText = await productCard.locator('.text-lg.font-bold, [data-testid="product-price"]').first().textContent() || '0';
  56  |       const price = parseInt(priceText.replace(/\D/g, ''), 10);
  57  | 
  58  |       // Add to cart action
  59  |       const addToCartBtn = productCard.getByRole('button', { name: /В корзину|Добавить/i }).first();
  60  |       if (await addToCartBtn.isVisible()) {
  61  |           await addToCartBtn.click();
  62  |           
  63  |           // UX: Check for feedback after action (e.g., toast notification or cart badge update)
  64  |           // (Placeholder: adjust selector based on actual implementation)
  65  |           const cartBadge = page.locator('[data-testid="cart-badge"]');
  66  |           if (await cartBadge.isVisible()) {
  67  |              await expect(cartBadge).not.toBeEmpty();
  68  |           }
  69  |       }
  70  |     });
  71  |   });
  72  | 
  73  |   test.describe('B2B User Flow & UI/UX Evaluation', () => {
  74  |     test.beforeEach(async ({ page }) => {
  75  |       await page.goto('/b2b/catalog');
  76  |     });
  77  | 
  78  |     test('should have a clean, dense layout suitable for B2B wholesale', async ({ page, isMobile }) => {
  79  |       // B2B headers usually have specific tools and dense information
  80  |       const b2bHeader = page.locator('header');
  81  |       await expect(b2bHeader).toBeVisible();
  82  |       await expect(b2bHeader).toContainText('B2B');
  83  | 
  84  |       if (!isMobile) {
  85  |          // Verify desktop navigation layout
  86  |          const nav = b2bHeader.locator('nav');
  87  |          await expect(nav).toBeVisible();
  88  |          await expect(nav.getByRole('link', { name: /Каталог/i })).toBeVisible();
  89  |       }
  90  | 
  91  |       // Verify B2B specific visual design
  92  |       // Expect tabular or dense grid layout for fast ordering
  93  |       const catalogContainer = page.locator('main').first();
  94  |       await expect(catalogContainer).toBeVisible();
  95  |     });
  96  | 
  97  |     test('should stimulate bulk actions and correctly calculate complex totals', async ({ page }) => {
  98  |       // Wait for products
  99  |       const products = page.locator('article, .product-item');
> 100 |       await products.first().waitFor({ state: 'visible' });
      |                              ^ Error: locator.waitFor: Test timeout of 30000ms exceeded.
  101 | 
  102 |       const firstProduct = products.nth(0);
  103 |       const secondProduct = products.nth(1);
  104 | 
  105 |       // In B2B, users often input quantities directly instead of clicking "Add to cart" once
  106 |       const qtyInput1 = firstProduct.locator('input[type="number"]');
  107 |       const qtyInput2 = secondProduct.locator('input[type="number"]');
  108 | 
  109 |       if (await qtyInput1.isVisible() && await qtyInput2.isVisible()) {
  110 |         // UX: Input fields should be easily accessible and large enough
  111 |         const inputHeight = await qtyInput1.evaluate(el => window.getComputedStyle(el).height);
  112 |         expect(parseFloat(inputHeight)).toBeGreaterThanOrEqual(30); // touch target size best practice
  113 | 
  114 |         await qtyInput1.fill('5');
  115 |         await qtyInput2.fill('10');
  116 | 
  117 |         // Extract B2B prices (usually distinct from B2C)
  118 |         const price1Text = await firstProduct.locator('.text-brand, .font-semibold').first().textContent() || '0';
  119 |         const price2Text = await secondProduct.locator('.text-brand, .font-semibold').first().textContent() || '0';
  120 |         
  121 |         const price1 = parseInt(price1Text.replace(/\D/g, ''), 10);
  122 |         const price2 = parseInt(price2Text.replace(/\D/g, ''), 10);
  123 | 
  124 |         // Click Add to Cart or Save Order
  125 |         const addToCartBtn = page.getByRole('button', { name: /В корзину|Добавить/i }).first();
  126 |         if (await addToCartBtn.isVisible()) {
  127 |             await addToCartBtn.click();
  128 |         }
  129 | 
  130 |         // Navigate to cart
  131 |         await page.goto('/b2b/cart');
  132 | 
  133 |         // Business Logic: Check Total Amount Calculation
  134 |         const totalAmountLocator = page.locator('[data-testid="cart-total"], .total-amount').first();
  135 |         if (await totalAmountLocator.isVisible()) {
  136 |            const totalText = await totalAmountLocator.textContent() || '0';
  137 |            const actualTotal = parseInt(totalText.replace(/\D/g, ''), 10);
  138 |            
  139 |            const expectedTotal = (price1 * 5) + (price2 * 10);
  140 |            // Soft assertion to allow test to pass if exact UI match differs, but logs logic check
  141 |            expect(actualTotal).toBe(expectedTotal);
  142 |         }
  143 |       }
  144 |     });
  145 | 
  146 |     test('should evaluate responsiveness and mobile UX', async ({ page }) => {
  147 |        // Set mobile viewport
  148 |        await page.setViewportSize({ width: 375, height: 812 });
  149 |        
  150 |        // Verify hidden desktop elements
  151 |        const desktopNav = page.locator('header nav.hidden.md\\:flex');
  152 |        await expect(desktopNav).toBeHidden();
  153 | 
  154 |        // Check mobile menu trigger (hamburger) or bottom navigation
  155 |        // UX: Mobile interactive elements should be reachable
  156 |        const cartIcon = page.locator('a[href*="/cart"]').first();
  157 |        await expect(cartIcon).toBeVisible();
  158 |     });
  159 |   });
  160 | });
  161 | 
```