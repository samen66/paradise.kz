import { test, expect } from '@playwright/test';

test('B2B Checkout flow', async ({ page }) => {
  await page.goto('/b2b/checkout');
  await expect(page.locator('body')).toBeVisible();
});
