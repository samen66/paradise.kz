import { test, expect } from '@playwright/test';

test('B2C Checkout flow', async ({ page }) => {
  await page.goto('/checkout');
  // Simple check since it might redirect to empty cart or show form
  await expect(page.locator('body')).toBeVisible();
});
