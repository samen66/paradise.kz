import { test, expect } from '@playwright/test';

test('B2C OTP flow', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('form').first()).toBeVisible();
});
