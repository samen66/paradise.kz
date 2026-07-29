import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 375, height: 667 } });

test('Catalog mobile view', async ({ page }) => {
  await page.goto('/catalog');
  await expect(page.locator('h1').first()).toBeVisible();
});
