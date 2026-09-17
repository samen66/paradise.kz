import { test as setup, expect } from "@playwright/test";
import { requireAdmin } from "./fixtures";
import { ADMIN_SESSION } from "./session";

/**
 * Вход служебным админом прогона — один раз на прогон, дальше тесты берут
 * сессию из файла. Это не посеянный admin@paradise.kz: прогон заводит своего
 * админа с ролью admin, и его пароль известен только из фикстур.
 *
 * Токен живёт в localStorage (`admin_token`), поэтому storageState снимается
 * уже после редиректа в список товаров.
 */
setup("админ входит в панель", async ({ page }) => {
  const admin = requireAdmin();

  await page.goto("/login");

  await page.locator('input[type="email"]').fill(admin.email);
  await page.locator('input[type="password"]').fill(admin.password);
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page).toHaveURL(/\/products$/);

  await page.context().storageState({ path: ADMIN_SESSION });
});
