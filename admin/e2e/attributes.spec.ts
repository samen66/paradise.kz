import { test, expect } from "@playwright/test";
import { ADMIN_SESSION } from "./session";

/**
 * Атрибуты — первый экран на общих компонентах: форма в модалке, клиентская
 * валидация, ошибка сервера под полем, удаление с подтверждением.
 */
test.use({ storageState: ADMIN_SESSION });

test.beforeEach(({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

test("атрибут создаётся, правится и удаляется", async ({ page }) => {
  const slug = `e2e-attr-${Date.now()}`;

  await page.goto("/attributes");
  await page.getByRole("button", { name: "Добавить атрибут" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Название *").fill("E2E цвет");
  await dialog.getByLabel("Slug *").fill("Bad Slug");
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog.getByText("Латиница в нижнем регистре, цифры и дефисы")).toBeVisible();

  await dialog.getByLabel("Slug *").fill(slug);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();

  const row = page.locator("tbody tr").filter({ hasText: slug });
  await expect(row).toContainText("E2E цвет");

  await row.getByRole("button", { name: "Изменить" }).click();
  await dialog.getByLabel("Название *").fill("E2E цвет обивки");
  await dialog.getByLabel("Показывать в фильтрах витрины").check();
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(row).toContainText("E2E цвет обивки");
  await expect(row).toContainText("Да");

  await row.getByRole("button", { name: "Удалить" }).click();
  await expect(page.locator("tbody tr").filter({ hasText: slug })).toHaveCount(0);
});

test("занятый slug возвращается ошибкой под полем", async ({ page }) => {
  const slug = `e2e-dup-${Date.now()}`;
  const dialog = page.getByRole("dialog");

  await page.goto("/attributes");

  for (const attempt of [1, 2]) {
    await page.getByRole("button", { name: "Добавить атрибут" }).click();
    await dialog.getByLabel("Название *").fill(`E2E дубль ${attempt}`);
    await dialog.getByLabel("Slug *").fill(slug);
    await dialog.getByRole("button", { name: "Сохранить" }).click();
  }

  // Вторая попытка: модалка осталась, у поля slug — текст ошибки от Laravel.
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toBeVisible();

  await dialog.getByRole("button", { name: "Отмена" }).click();
  await page.locator("tbody tr").filter({ hasText: slug }).getByRole("button", { name: "Удалить" }).click();
  await expect(page.locator("tbody tr").filter({ hasText: slug })).toHaveCount(0);
});
