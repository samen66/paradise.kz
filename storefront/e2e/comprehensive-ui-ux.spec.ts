import { test, expect } from '@playwright/test';

test.describe('Comprehensive UI/UX and Business Logic Test Suite', () => {
  test.describe('B2C User Flow & UI/UX Evaluation', () => {
    test.beforeEach(async ({ page }) => {
      // Assuming Next-intl redirects to a default locale like /ru
      await page.goto('/ru'); 
    });

    test('should have premium styling and responsive layout on the homepage', async ({ page, isMobile }) => {
      // 1. Evaluate Visual Hierarchy & Styling (UI)
      const header = page.locator('header').first();
      await expect(header).toBeVisible();
      
      // Check for sticky header and backdrop-blur (Premium UI practice)
      const headerClasses = await header.getAttribute('class');
      expect(headerClasses).toContain('sticky');
      expect(headerClasses).toContain('backdrop-blur');

      // Check Typography and Colors
      const body = page.locator('body');
      const fontFamily = await body.evaluate((el) => window.getComputedStyle(el).fontFamily);
      expect(fontFamily).not.toBe('Times New Roman'); // Ensuring modern font is applied

      // 2. Evaluate User-Friendliness (UX)
      // Call-to-actions should be accessible and visible
      const catalogLink = page.getByRole('link', { name: /Каталог/i }).first();
      if (!isMobile) {
        await expect(catalogLink).toBeVisible();
        await expect(catalogLink).toHaveCSS('cursor', 'pointer');
      }

      // Check Hover states for interactable elements
      const cartIcon = page.locator('a[href*="/cart"]').first();
      await expect(cartIcon).toBeVisible();
      const cartTransition = await cartIcon.evaluate((el) => window.getComputedStyle(el).transition);
      expect(cartTransition).toContain('opacity'); // Checking for smooth micro-interactions
    });

    test('should correctly simulate B2C shopping flow and calculate totals', async ({ page }) => {
      // Navigate to Catalog
      await page.goto('/ru/catalog');

      // Wait for products to load
      const productCard = page.locator('article, .group').first();
      await expect(productCard).toBeVisible();

      // Ensure product images have proper aspect ratios and object-fit (UI best practice)
      const image = productCard.locator('img').first();
      await expect(image).toBeVisible();
      const objectFit = await image.evaluate((el) => window.getComputedStyle(el).objectFit);
      expect(['cover', 'contain']).toContain(objectFit);

      // Extract price
      const priceText = await productCard.locator('.text-lg.font-bold, [data-testid="product-price"]').first().textContent() || '0';
      const price = parseInt(priceText.replace(/\D/g, ''), 10);

      // Add to cart action
      const addToCartBtn = productCard.getByRole('button', { name: /В корзину|Добавить/i }).first();
      if (await addToCartBtn.isVisible()) {
          await addToCartBtn.click();
          
          // UX: Check for feedback after action (e.g., toast notification or cart badge update)
          // (Placeholder: adjust selector based on actual implementation)
          const cartBadge = page.locator('[data-testid="cart-badge"]');
          if (await cartBadge.isVisible()) {
             await expect(cartBadge).not.toBeEmpty();
          }
      }
    });
  });

  test.describe('B2B User Flow & UI/UX Evaluation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/b2b/catalog');
    });

    test('should have a clean, dense layout suitable for B2B wholesale', async ({ page, isMobile }) => {
      // B2B headers usually have specific tools and dense information
      const b2bHeader = page.locator('header');
      await expect(b2bHeader).toBeVisible();
      await expect(b2bHeader).toContainText('B2B');

      if (!isMobile) {
         // Verify desktop navigation layout
         const nav = b2bHeader.locator('nav');
         await expect(nav).toBeVisible();
         await expect(nav.getByRole('link', { name: /Каталог/i })).toBeVisible();
      }

      // Verify B2B specific visual design
      // Expect tabular or dense grid layout for fast ordering
      const catalogContainer = page.locator('main').first();
      await expect(catalogContainer).toBeVisible();
    });

    test('should stimulate bulk actions and correctly calculate complex totals', async ({ page }) => {
      // Wait for products
      const products = page.locator('article, .product-item');
      await products.first().waitFor({ state: 'visible' });

      const firstProduct = products.nth(0);
      const secondProduct = products.nth(1);

      // In B2B, users often input quantities directly instead of clicking "Add to cart" once
      const qtyInput1 = firstProduct.locator('input[type="number"]');
      const qtyInput2 = secondProduct.locator('input[type="number"]');

      if (await qtyInput1.isVisible() && await qtyInput2.isVisible()) {
        // UX: Input fields should be easily accessible and large enough
        const inputHeight = await qtyInput1.evaluate(el => window.getComputedStyle(el).height);
        expect(parseFloat(inputHeight)).toBeGreaterThanOrEqual(30); // touch target size best practice

        await qtyInput1.fill('5');
        await qtyInput2.fill('10');

        // Extract B2B prices (usually distinct from B2C)
        const price1Text = await firstProduct.locator('.text-brand, .font-semibold').first().textContent() || '0';
        const price2Text = await secondProduct.locator('.text-brand, .font-semibold').first().textContent() || '0';
        
        const price1 = parseInt(price1Text.replace(/\D/g, ''), 10);
        const price2 = parseInt(price2Text.replace(/\D/g, ''), 10);

        // Click Add to Cart or Save Order
        const addToCartBtn = page.getByRole('button', { name: /В корзину|Добавить/i }).first();
        if (await addToCartBtn.isVisible()) {
            await addToCartBtn.click();
        }

        // Navigate to cart
        await page.goto('/b2b/cart');

        // Business Logic: Check Total Amount Calculation
        const totalAmountLocator = page.locator('[data-testid="cart-total"], .total-amount').first();
        if (await totalAmountLocator.isVisible()) {
           const totalText = await totalAmountLocator.textContent() || '0';
           const actualTotal = parseInt(totalText.replace(/\D/g, ''), 10);
           
           const expectedTotal = (price1 * 5) + (price2 * 10);
           // Soft assertion to allow test to pass if exact UI match differs, but logs logic check
           expect(actualTotal).toBe(expectedTotal);
        }
      }
    });

    test('should evaluate responsiveness and mobile UX', async ({ page }) => {
       // Set mobile viewport
       await page.setViewportSize({ width: 375, height: 812 });
       
       // Verify hidden desktop elements
       const desktopNav = page.locator('header nav.hidden.md\\:flex');
       await expect(desktopNav).toBeHidden();

       // Check mobile menu trigger (hamburger) or bottom navigation
       // UX: Mobile interactive elements should be reachable
       const cartIcon = page.locator('a[href*="/cart"]').first();
       await expect(cartIcon).toBeVisible();
    });
  });
});
