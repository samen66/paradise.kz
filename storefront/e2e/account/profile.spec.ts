import { test, expect } from '@playwright/test';

test('Account profile page', async ({ page }) => {
  await page.goto('/profile');
  await expect(page.locator('body')).toBeVisible();
});
