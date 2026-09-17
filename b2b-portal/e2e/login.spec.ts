import { test, expect } from "@playwright/test";

/**
 * Вход в портал глазами гостя.
 *
 * Тесты B2B переехали сюда из storefront вместе с самой витриной: там они
 * ходили по /b2b/*, которых в storefront больше нет. Гейт портала тоже другой —
 * не cookie в middleware, а токен в localStorage, который проверяет
 * (portal)/layout.tsx.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("гостя не пускают в каталог и уводят на вход", async ({ page }) => {
  await page.goto("/catalog");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Войти" })).toBeVisible();
});

test("неверный пароль объясняют по-русски, а не пускают внутрь", async ({ page }) => {
  await page.goto("/login");

  await page.locator('input[type="tel"]').fill("+77000000000");
  await page.locator('input[type="password"]').fill("заведомо-неверный");
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page.getByText(/Неверный/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
