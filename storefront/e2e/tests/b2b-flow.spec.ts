import { test, expect } from '@playwright/test';
import { B2BCartPage } from '../pages/b2b/B2BCartPage';

test.describe('B2B Bulk Checkout Flow', () => {
  test('Calculates complex cart totals correctly based on bulk inputs', async ({ page }) => {
    await page.goto('/b2b/catalog');
    
    // Simulate bulk add (assuming inputs exist)
    const inputs = page.locator('input[type="number"]');
    
    // Check if there are at least two items to perform bulk logic
    if (await inputs.count() > 1) {
      await inputs.nth(0).fill('10');
      await inputs.nth(1).fill('20');
      
      const price1Text = await page.locator('.text-brand, .font-semibold').nth(0).textContent();
      const price2Text = await page.locator('.text-brand, .font-semibold').nth(1).textContent();

      const price1 = parseInt(price1Text?.replace(/\D/g, '') || '0', 10);
      const price2 = parseInt(price2Text?.replace(/\D/g, '') || '0', 10);
      
      const expectedTotal = (price1 * 10) + (price2 * 20);

      const addButton = page.getByRole('button', { name: /В корзину|Добавить/i }).first();
      if (await addButton.isVisible()) {
          await addButton.click();
      }

      const cartPage = new B2BCartPage(page);
      await cartPage.goto();
      
      const actualTotal = await cartPage.getTotal();
      
      // We expect the B2B portal to accurately multiply and sum the line items.
      // If this fails, there is a severe bug in the business logic layer.
      expect(actualTotal).toBe(expectedTotal);
    }
  });
});
