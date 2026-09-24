import { test, expect } from "@playwright/test";
import { ADMIN_SESSION } from "./session";

/**
 * Пустой список — не серая строка, а блок с заголовком: так видно, что
 * загрузка закончилась и записей правда нет.
 */
test.use({ storageState: ADMIN_SESSION });

test("пустой поиск поставщиков показывает пустое состояние", async ({ page }) => {
  await page.goto("/suppliers");
  await page.getByPlaceholder(/Поиск/).fill(`нет-такого-${Date.now()}`);

  const empty = page.getByTestId("empty-state");
  await expect(empty).toBeVisible();
  await expect(empty).toContainText("Поставщиков нет");
  await expect(page.getByText("Загрузка…", { exact: true })).toBeHidden();
});
