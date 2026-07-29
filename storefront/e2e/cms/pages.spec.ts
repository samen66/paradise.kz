import { test, expect } from '@playwright/test';

test('CMS pages load correctly', async ({ page }) => {
  await page.goto('/promotions');
  await expect(page.locator('body')).toBeVisible();
});
