import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { adminApi } from "./adminApi";
import { ADMIN_SESSION } from "./session";
import { createProduct, createReceiptDraft, createStore, receive, uniqueStamp } from "./warehouseApi";

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

/** Старая страница списания (до её перевода на «живой документ» в Task 4). */
async function addLine(page: Page, productName: string) {
  await page.getByLabel("Добавить товар: название или код").fill(productName);
  await page.getByRole("option").filter({ hasText: productName }).first().click();
}

/** Черновик на удаление: адрес карточки — /warehouse/…, а API — /admin/goods-receipts|write-offs/{id}. */
function draftPath(page: Page, apiPrefix: "/admin/goods-receipts" | "/admin/write-offs"): string {
  return `${apiPrefix}/${new URL(page.url()).pathname.split("/").pop()}`;
}

/** Строка документа по товару. */
function documentLine(page: Page, productName: string) {
  return page.getByTestId("document-line").filter({ hasText: productName });
}

async function addFromField(page: Page, query: string, productName: string) {
  const field = page.getByLabel("Добавить товар", { exact: true });
  await field.fill(query);
  await expect(page.getByRole("option").filter({ hasText: productName })).toHaveCount(1);
  await field.press("Enter");
  await expect(documentLine(page, productName)).toHaveCount(1);
}

test("живая приёмка: товар из поля, правки сохраняются сами, проведение", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const { productName, storeId, storeName } = await setupProductAndStore(request, stamp);
  const receiptId = await createReceiptDraft(request, storeId);
  drafts.push(`/admin/goods-receipts/${receiptId}`);

  await page.goto(`/warehouse/receipts/${receiptId}`);
  await expect(page.getByTestId("document-fields")).toContainText(storeName);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Список открывается по фокусу, без ввода.
  await page.getByLabel("Добавить товар", { exact: true }).click();
  await expect(page.getByRole("listbox", { name: "Товары" }).getByRole("option").first()).toBeVisible();

  // Поиск строчными находит товар с заглавной.
  await addFromField(page, productName.toLowerCase(), productName);

  const line = documentLine(page, productName);
  const quantity = line.getByLabel(`Количество: ${productName}`);
  const cost = line.getByLabel(`Себестоимость: ${productName}`);
  await expect(quantity).toHaveValue("1");
  await line.getByRole("button", { name: `Больше: ${productName}` }).click();
  await expect(quantity).toHaveValue("2");
  await cost.fill("1500");
  await cost.blur();
  await expect(page.getByText("✓ Сохранено")).toBeVisible();
  await expect(page.getByTestId("document-footer")).toContainText(/2 шт · Итого 3\s000 ₸/);

  // Номер накладной — из шапки на странице, без модалки.
  await page.getByTestId("document-fields").getByRole("button", { name: /Изменить/ }).click();
  await page.getByLabel("Номер накладной").fill(`E2E-${stamp}`);
  await page.getByLabel("Номер накладной").blur();
  await expect(page.getByText("✓ Сохранено")).toBeVisible();

  await page.reload();
  await expect(documentLine(page, productName).getByLabel(`Количество: ${productName}`)).toHaveValue("2");
  await expect(documentLine(page, productName).getByLabel(`Себестоимость: ${productName}`)).toHaveValue("1500");

  await page.getByRole("button", { name: "Провести" }).click();
  await expect(page.getByText(/^Проведена /)).toBeVisible();
  await expect(page.getByRole("button", { name: "Провести" })).toHaveCount(0);

  await page.goto("/warehouse/stock");
  await page.getByPlaceholder("Название, код или артикул").fill(productName);
  const stockRow = page.locator("tbody tr").filter({ hasText: productName });
  await expect(stockRow).toContainText("2");

  await stockRow.getByRole("link", { name: "Движения" }).click();
  const movement = page.locator("tbody tr").filter({ hasText: `Приёмка E2E-${stamp}` });
  await expect(movement).toContainText("Приход");
  await expect(movement).toContainText("+2");
});

test("недавно принятые видны в поле, повторный товар прибавляется, удаление отменяется", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const { productId, productName, storeId } = await setupProductAndStore(request, stamp);
  await receive(request, storeId, productId, 1);
  const receiptId = await createReceiptDraft(request, storeId);
  drafts.push(`/admin/goods-receipts/${receiptId}`);

  await page.goto(`/warehouse/receipts/${receiptId}`);
  await page.getByLabel("Добавить товар", { exact: true }).click();
  const list = page.getByRole("listbox", { name: "Товары" });
  await expect(list).toContainText("Недавно принимали");
  await list.getByRole("option").filter({ hasText: productName }).first().click();
  await expect(documentLine(page, productName).getByLabel(`Количество: ${productName}`)).toHaveValue("1");
  // Себестоимость подставилась из проведённой приёмки (1 000 ₸ в receive()).
  await expect(documentLine(page, productName).getByLabel(`Себестоимость: ${productName}`)).toHaveValue("1000");

  await addFromField(page, productName, productName);
  await expect(documentLine(page, productName)).toHaveCount(1);
  await expect(documentLine(page, productName).getByLabel(`Количество: ${productName}`)).toHaveValue("2");

  await documentLine(page, productName).getByRole("button", { name: `Удалить: ${productName}` }).click();
  await expect(documentLine(page, productName)).toHaveCount(0);
  await page.getByRole("button", { name: "Вернуть" }).click();
  await expect(documentLine(page, productName).getByLabel(`Количество: ${productName}`)).toHaveValue("2");
});

test("неверное количество блокирует проведение и уход без вопроса", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const { productName, storeId } = await setupProductAndStore(request, stamp);
  const receiptId = await createReceiptDraft(request, storeId);
  drafts.push(`/admin/goods-receipts/${receiptId}`);

  await page.goto(`/warehouse/receipts/${receiptId}`);
  await addFromField(page, productName, productName);
  const quantity = documentLine(page, productName).getByLabel(`Количество: ${productName}`);

  await quantity.fill("0");
  await expect(documentLine(page, productName)).toContainText("Количество больше нуля");
  await expect(page.getByRole("button", { name: "Провести" })).toBeDisabled();
  await expect(page.getByTestId("document-footer")).toContainText("Исправьте строки с ошибкой");

  // Уход со страницы спрашивает; отказ оставляет на месте.
  page.removeAllListeners("dialog");
  const questions: string[] = [];
  page.on("dialog", (dialog) => {
    questions.push(dialog.message());
    void dialog.dismiss();
  });
  await page.getByRole("link", { name: "Назад" }).click();
  expect(questions).toEqual(["Уйти без сохранения? Изменения пропадут."]);
  await expect(page).toHaveURL(new RegExp(`/warehouse/receipts/${receiptId}$`));

  await quantity.fill("3");
  await quantity.blur();
  await expect(page.getByText("✓ Сохранено")).toBeVisible();
  await expect(page.getByRole("button", { name: "Провести" })).toBeEnabled();
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
