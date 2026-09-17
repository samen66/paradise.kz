import { defineConfig, devices } from "@playwright/test";

/**
 * E2E админки менеджера (:3002).
 *
 * Тесты идут поверх состояния, которое оставляет прогон приёмки — сначала
 * `php artisan mvp:acceptance --fresh --fixtures`, потом Playwright. Подробно:
 * docs/e2e-runbook.md.
 *
 * Проект `setup` заходит служебным админом прогона и сохраняет сессию; на неё
 * опираются все остальные тесты.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // HTML-отчёт и локально: в нём снимки экрана каждого теста — `npx playwright show-report`.
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  // Дев-сервер Next компилирует маршрут при первом заходе, и на холодную это
  // заметно дольше дефолтных пяти секунд — отсюда запас в ожиданиях.
  expect: { timeout: 15_000 },
  // По той же причине и на весь тест: три дев-сервера разом плюс докер местами
  // отвечают по 20–30 с на страницу, и дефолтных 30 с не хватало даже входу.
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3002",
    trace: "on-first-retry",
    screenshot: { mode: "on", fullPage: true },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3002",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "Desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /.*\.setup\.ts/,
      dependencies: ["setup"],
    },
  ],
});
