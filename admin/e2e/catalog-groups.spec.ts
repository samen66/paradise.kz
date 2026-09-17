import { test, expect } from "@playwright/test";
import { requireB2bClient } from "./fixtures";
import { ADMIN_SESSION } from "./session";

/**
 * Группа каталога: создать, привязать клиента, отвязать, удалить.
 *
 * Товары в группу здесь не добавляются намеренно: товар в группе пропадает с
 * витрины, а тесты storefront/ идут параллельно на тех же фикстурах. Пустая
 * группа с клиентом ничью видимость не меняет.
 */
test.use({ storageState: ADMIN_SESSION });

test("клиент добавляется в группу и убирается из неё", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());

  const client = requireB2bClient();
  const name = `E2E группа ${Date.now()}`;
  const query = client.company_name ?? client.phone;

  await page.goto("/catalog-groups");
  await page.getByRole("button", { name: "Добавить группу" }).click();
  await page.getByRole("dialog").getByLabel("Название *").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Сохранить" }).click();

  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.getByRole("tab", { name: /Клиенты/ }).click();
  await page.getByLabel("Найти B2B-клиента по компании, БИН, телефону").fill(query);
  await page.getByRole("option").filter({ hasText: query }).first().click();

  const tabpanel = page.getByRole("tabpanel");
  await expect(tabpanel.locator("tbody tr").filter({ hasText: query })).toHaveCount(1);
  await expect(page.getByRole("tab", { name: "Клиенты (1)" })).toBeVisible();

  await tabpanel.locator("tbody tr").filter({ hasText: query }).getByRole("button", { name: "Убрать" }).click();
  await expect(page.getByRole("tab", { name: "Клиенты (0)" })).toBeVisible();

  await page.getByRole("button", { name: "Удалить группу" }).click();
  await expect(page).toHaveURL(/\/catalog-groups$/);
  await expect(page.locator("tbody tr").filter({ hasText: name })).toHaveCount(0);
});
