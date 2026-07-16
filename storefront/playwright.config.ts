import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000', // Локальный сервер Next.js
    trace: 'on-first-retry',
    browserName: 'chromium',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'Desktop',
      use: { 
        ...devices['Desktop Chrome'], 
        storageState: 'e2e/auth/.auth/user.json' 
      },
      dependencies: ['setup'],
    },
  ],
});
