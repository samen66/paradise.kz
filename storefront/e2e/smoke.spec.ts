import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("homepage loads and has title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Paradise/i);
  });

  test("catalog page loads", async ({ page }) => {
    await page.goto("/catalog");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("404 page renders for unknown route", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
  });
});
