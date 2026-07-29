import { test, expect } from '@playwright/test';

test('B2B Email login flow', async ({ page }) => {
  await page.goto('/b2b/login');
  await expect(page.locator('form').first()).toBeVisible();
});
