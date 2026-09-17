import path from "node:path";
import { test, expect } from "@playwright/test";
import { requireInStockProduct } from "./fixtures";
import { ADMIN_SESSION } from "./session";

/**
 * Вкладки карточки товара: фото и цены по типам. Всё созданное удаляется в
 * конце теста. Тип цены заводится свой, со случайным кодом, — существующие
 * retail/b2b не трогаются, так что цена на витрине не меняется.
 */
test.use({ storageState: ADMIN_SESSION });

test.beforeEach(({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

test("фото загружается в товар и удаляется", async ({ page }) => {
  const product = requireInStockProduct();

  await page.goto(`/products/${product.id}`);
  await page.getByRole("tab", { name: "Фото" }).click();

  const images = page.getByTestId("product-image");
  const before = await images.count();

  await page.getByLabel("Загрузить фото").setInputFiles(path.join(__dirname, "assets/pixel.png"));
  await expect(images).toHaveCount(before + 1);

  await images.last().getByRole("button", { name: "Удалить" }).click();
  await expect(images).toHaveCount(before);
});

test("цена по своему типу добавляется, показывается в ₸ и удаляется", async ({ page }) => {
  const product = requireInStockProduct();
  const stamp = Date.now();
  const typeName = `E2E тип ${stamp}`;
  const dialog = page.getByRole("dialog");

  await page.goto("/price-types");
  await page.getByRole("button", { name: "Добавить тип цены" }).click();
  await dialog.getByLabel("Название *").fill(typeName);
  await dialog.getByLabel("Код *").fill(`e2e_${stamp}`);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();

  await page.goto(`/products/${product.id}`);
  await page.getByRole("tab", { name: "Цены", exact: true }).click();
  await page.getByRole("button", { name: "Добавить цену" }).click();
  await dialog.getByLabel("Тип цены *").selectOption({ label: typeName });
  await dialog.getByLabel("Цена, ₸ *").fill("1234.5");
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  const row = page.getByRole("tabpanel").locator("tbody tr").filter({ hasText: typeName });
  // toLocaleString('ru-RU') разделяет тысячи неразрывным пробелом.
  await expect(row).toContainText(/1\s234,5 ₸/);

  await row.getByRole("button", { name: "Удалить" }).click();
  await expect(row).toHaveCount(0);

  await page.goto("/price-types");
  await page.locator("tbody tr").filter({ hasText: typeName }).getByRole("button", { name: "Удалить" }).click();
  await expect(page.locator("tbody tr").filter({ hasText: typeName })).toHaveCount(0);
});
