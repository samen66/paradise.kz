import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { adminApi } from "./adminApi";
import { ADMIN_SESSION } from "./session";
import { createProduct, createStore, receive, uniqueStamp } from "./warehouseApi";

/**
 * Склад: приёмка → остаток → движение; списание с нехваткой; склад с историей.
 *
 * Товар и склад каждый тест заводит сам: товар — выключенным (на витрину не
 * попадёт), склад — неактивным (StoreResolver его не выберет). Общие фикстуры
 * приёмки не трогаются. Проведённые документы удалить нельзя по замыслу, поэтому
 * они остаются в базе с пометкой E2E; черновики убираются в afterEach.
 */
test.use({ storageState: ADMIN_SESSION });

const drafts: string[] = [];

test.beforeEach(({ page }) => {
  drafts.length = 0;
  page.on("dialog", (dialog) => dialog.accept());
});

test.afterEach(async ({ request }) => {
  const api = adminApi(request);
  for (const path of drafts) {
    // A draft that got posted answers 422 here — that's fine, it stays by design.
    await api.delete(path);
  }
});

async function setupProductAndStore(request: APIRequestContext, stamp: number) {
  const product = await createProduct(request, stamp);
  const store = await createStore(request, stamp);
  return { productId: product.id, storeId: store.id, productName: product.name, storeName: store.name };
}

async function addLine(page: Page, productName: string) {
  await page.getByLabel("Добавить товар: название или код").fill(productName);
  await page.getByRole("option").filter({ hasText: productName }).first().click();
}

/** Черновик на удаление: адрес карточки — /warehouse/…, а API — /admin/goods-receipts|write-offs/{id}. */
function draftPath(page: Page, apiPrefix: "/admin/goods-receipts" | "/admin/write-offs"): string {
  return `${apiPrefix}/${new URL(page.url()).pathname.split("/").pop()}`;
}

test("приёмка проводится, остаток растёт, движение видно в журнале", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const { productName, storeName } = await setupProductAndStore(request, stamp);
  const supplierName = `E2E поставщик ${stamp}`;
  const dialog = page.getByRole("dialog");

  await page.goto("/warehouse/suppliers");
  await page.getByRole("button", { name: "Добавить поставщика" }).click();
  await dialog.getByLabel("Название *").fill(supplierName);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.locator("tbody tr").filter({ hasText: supplierName })).toHaveCount(1);

  await page.goto("/warehouse/documents?kind=receipts");
  await page.getByRole("button", { name: /Принять товар/ }).click();
  await dialog.getByLabel("Склад *").selectOption({ label: `${storeName} (выключен)` });
  await dialog.getByLabel("Поставщик").selectOption({ label: supplierName });
  await dialog.getByLabel("Номер").fill(`E2E-${stamp}`);
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  await expect(page).toHaveURL(/\/warehouse\/receipts\/\d+$/);
  drafts.push(draftPath(page, "/admin/goods-receipts"));

  await addLine(page, productName);
  await dialog.getByLabel("Количество *").fill("3");
  await dialog.getByLabel("Себестоимость, ₸ *").fill("1500");
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  // Columns by position: the product name carries a timestamp full of digits.
  const line = page.locator("tbody tr").filter({ hasText: productName });
  await expect(line.locator("td").nth(1)).toHaveText("3");
  await expect(line.locator("td").nth(3)).toHaveText(/4\s500 ₸/);

  await page.getByRole("button", { name: "Провести" }).click();
  await expect(page.getByText(/^Проведена /)).toBeVisible();

  await page.goto("/warehouse/stock");
  await page.getByPlaceholder("Поиск по названию, коду или артикулу...").fill(productName);
  const stockRow = page.locator("tbody tr").filter({ hasText: storeName });
  await expect(stockRow.locator("td").nth(2)).toHaveText("3");

  await stockRow.getByRole("link", { name: "Движения" }).click();
  await expect(page).toHaveURL(/\/warehouse\/movements\?/);
  const movement = page.locator("tbody tr").filter({ hasText: `Приёмка E2E-${stamp}` });
  await expect(movement).toContainText("Приход");
  await expect(movement).toContainText("+3");
});

test("списание больше остатка отклоняется, исправленное проводится", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const { productId, storeId, productName, storeName } = await setupProductAndStore(request, stamp);
  await receive(request, storeId, productId, 2);
  const dialog = page.getByRole("dialog");

  await page.goto("/warehouse/documents?kind=write_offs");
  await page.getByRole("button", { name: "Списать", exact: true }).click();
  await dialog.getByLabel("Склад *").selectOption({ label: `${storeName} (выключен)` });
  await dialog.getByLabel("Причина *").selectOption({ label: "Брак / повреждение" });
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  await expect(page).toHaveURL(/\/warehouse\/write-offs\/\d+$/);
  drafts.push(draftPath(page, "/admin/write-offs"));

  await addLine(page, productName);
  await dialog.getByLabel("Количество *").fill("5");
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  // Columns by position: «Товар», «Количество», «Доступно».
  const line = page.locator("tbody tr").filter({ hasText: productName });
  await expect(line.locator("td").nth(1)).toHaveText("5");
  await expect(line.locator("td").nth(2)).toHaveText("2");

  await page.getByRole("button", { name: "Провести" }).click();
  await expect(page.getByText(`Не хватает: ${productName} — нужно 5, доступно 2.`)).toBeVisible();

  await line.getByRole("button", { name: "Изменить" }).click();
  await dialog.getByLabel("Количество *").fill("1");
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(line.locator("td").nth(1)).toHaveText("1");

  await page.getByRole("button", { name: "Провести" }).click();
  await expect(page.getByText(/^Проведено /)).toBeVisible();
  await expect(page.getByText(/Себестоимость: 1\s000 ₸/)).toBeVisible();
});

test("склад с историей удалить нельзя", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const { productId, storeId, storeName } = await setupProductAndStore(request, stamp);
  await receive(request, storeId, productId, 1);

  await page.goto("/warehouse/stores");
  const row = page.locator("tbody tr").filter({ hasText: storeName });
  await row.getByRole("button", { name: "Удалить" }).click();

  await expect(page.getByText(/У склада есть история/)).toBeVisible();
  await expect(page.locator("tbody tr").filter({ hasText: storeName })).toHaveCount(1);
});
