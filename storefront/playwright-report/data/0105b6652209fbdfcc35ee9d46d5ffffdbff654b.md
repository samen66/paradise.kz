# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: comprehensive-ui-ux.spec.ts >> Comprehensive UI/UX and Business Logic Test Suite >> B2B User Flow & UI/UX Evaluation >> should evaluate responsiveness and mobile UX
- Location: e2e/comprehensive-ui-ux.spec.ts:146:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('a[href*="/cart"]').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('a[href*="/cart"]').first()

```

```yaml
- heading "Вход для оптовиков" [level=1]
- text: Номер телефона
- textbox "+7 (___) ___-__-__"
- text: Пароль
- textbox "••••••••"
- button "Войти"
- text: Нет аккаунта?
- link "Зарегистрироваться":
  - /url: /b2b/register
- alert
```

# Test source

```ts
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
  100 |       await products.first().waitFor({ state: 'visible' });
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
> 157 |        await expect(cartIcon).toBeVisible();
      |                               ^ Error: expect(locator).toBeVisible() failed
  158 |     });
  159 |   });
  160 | });
  161 | 
```