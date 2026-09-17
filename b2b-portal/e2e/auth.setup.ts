import { test as setup, expect } from "@playwright/test";
import { requireB2bClient } from "./fixtures";
import { B2B_SESSION } from "./session";

/**
 * Вход одобренного оптовика — один раз на прогон, дальше тесты берут сессию из
 * файла. Пароль клиента знает только прогон приёмки, поэтому он приходит из
 * фикстур (см. e2e/fixtures.ts).
 *
 * Портал держит токен в localStorage (zustand persist), а не в cookie, так что
 * storageState обязан сниматься уже после редиректа в каталог — до него
 * persist ещё не записал сессию.
 */
setup("оптовик входит в портал", async ({ page }) => {
  const client = requireB2bClient();

  await page.goto("/login");

  // У полей формы нет id, а label не обёрнут вокруг input — отсюда селекторы по типу.
  await page.locator('input[type="tel"]').fill(client.phone);
  await page.locator('input[type="password"]').fill(client.password);
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page).toHaveURL(/\/catalog$/);

  await page.context().storageState({ path: B2B_SESSION });
});
