import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate as B2B user', async ({ page, context }) => {
  // Next.js middleware checks for 'laravel_session' cookie for B2B routes
  await context.addCookies([
    {
      name: 'laravel_session',
      value: 'test-session-cookie-123',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
    }
  ]);
  
  // Also add some local storage data if the frontend zustand/context needs it
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('user-role', 'b2b');
    localStorage.setItem('auth-token', 'test-token-123');
  });
  
  await page.context().storageState({ path: authFile });
});
