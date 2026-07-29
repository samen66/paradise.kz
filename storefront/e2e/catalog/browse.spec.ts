import { test, expect } from '@playwright/test';

test('Catalog browse flow', async ({ page }) => {
  await page.goto('/catalog');
  await expect(page.locator('h1').first()).toBeVisible();
});
