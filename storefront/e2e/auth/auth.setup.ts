import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate as B2B user', async ({ page }) => {
  // Mock login: going to the base URL and setting local storage variables
  await page.goto('/');
  
  await page.evaluate(() => {
    localStorage.setItem('auth-token', 'test-token-123');
    localStorage.setItem('user-role', 'b2b');
  });
  
  await page.context().storageState({ path: authFile });
});
