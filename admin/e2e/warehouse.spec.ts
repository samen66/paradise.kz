import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { adminApi } from "./adminApi";
import { ADMIN_SESSION } from "./session";
import { createProduct, createReceiptDraft, createStore, createWriteOffDraft, receive, uniqueStamp } from "./warehouseApi";

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

test("Подбор: три товара одним нажатием", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const store = await createStore(request, stamp);
  const a = await createProduct(request, stamp, {}, " А");
  const b = await createProduct(request, stamp, {}, " Б");
  const c = await createProduct(request, stamp, {}, " В");
  const receiptId = await createReceiptDraft(request, store.id);
  drafts.push(`/admin/goods-receipts/${receiptId}`);

  await page.goto(`/warehouse/receipts/${receiptId}`);
  await page.getByRole("button", { name: "☰ Подбор" }).click();
  const picker = page.getByRole("dialog", { name: "Подбор" });
  await picker.getByLabel("Поиск в подборе").fill(`E2E товар ${stamp}`);
  const row = (name: string) => picker.getByTestId("picker-row").filter({ hasText: name });
  await expect(row(a.name)).toBeVisible();

  await row(a.name).getByTestId("picker-pick").click();
  await row(b.name).getByTestId("picker-pick").click();
  await row(b.name).getByTestId("picker-pick").click();
  await row(c.name).getByRole("button", { name: `Больше: ${c.name}` }).click();
  await expect(picker).toContainText("Выбрано: 3");

  await picker.getByRole("button", { name: "Добавить 3 позиции · 4 шт" }).click();
  await expect(picker).toBeHidden();
  await expect(page.getByText("Добавлено 3 позиции")).toBeVisible();
  await expect(documentLine(page, a.name).getByLabel(`Количество: ${a.name}`)).toHaveValue("1");
  await expect(documentLine(page, b.name).getByLabel(`Количество: ${b.name}`)).toHaveValue("2");
  await expect(documentLine(page, c.name).getByLabel(`Количество: ${c.name}`)).toHaveValue("1");
});

test("Подбор: закрытие с выбором спрашивает", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const { productName, storeId } = await setupProductAndStore(request, stamp);
  const receiptId = await createReceiptDraft(request, storeId);
  drafts.push(`/admin/goods-receipts/${receiptId}`);

  await page.goto(`/warehouse/receipts/${receiptId}`);
  await page.getByRole("button", { name: "☰ Подбор" }).click();
  const picker = page.getByRole("dialog", { name: "Подбор" });
  await picker.getByLabel("Поиск в подборе").fill(productName);
  await picker.getByTestId("picker-row").filter({ hasText: productName }).getByTestId("picker-pick").click();

  page.removeAllListeners("dialog");
  const questions: string[] = [];
  page.once("dialog", (dialog) => {
    questions.push(dialog.message());
    void dialog.dismiss();
  });
  await picker.getByRole("button", { name: "Закрыть" }).click();
  expect(questions).toEqual(["Отменить подбор? Выбрано 1 товар."]);
  await expect(picker).toContainText("Выбрано: 1");

  page.once("dialog", (dialog) => void dialog.accept());
  await picker.getByRole("button", { name: "Закрыть" }).click();
  await expect(picker).toBeHidden();
  await expect(documentLine(page, productName)).toHaveCount(0);
});

test("списание: подбор ограничен остатком, строка сверх остатка блокирует проведение", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const { productId, storeId, productName } = await setupProductAndStore(request, stamp);
  const empty = await createProduct(request, stamp, {}, " пусто");
  await receive(request, storeId, productId, 2);
  const writeOffId = await createWriteOffDraft(request, storeId);
  drafts.push(`/admin/write-offs/${writeOffId}`);

  await page.goto(`/warehouse/write-offs/${writeOffId}`);
  await page.getByRole("button", { name: "☰ Подбор" }).click();
  const picker = page.getByRole("dialog", { name: "Подбор" });
  await picker.getByLabel("Поиск в подборе").fill(`E2E товар ${stamp}`);
  const row = picker.getByTestId("picker-row").filter({ hasText: productName });
  await expect(row).toBeVisible();
  // Товара без остатка в списании нет.
  await expect(picker.getByTestId("picker-row").filter({ hasText: empty.name })).toHaveCount(0);

  const more = row.getByRole("button", { name: `Больше: ${productName}` });
  await more.click();
  await more.click();
  await expect(more).toBeDisabled();
  await expect(row.getByLabel(`Количество: ${productName}`)).toHaveValue("2");
  await picker.getByRole("button", { name: "Добавить 1 позицию · 2 шт" }).click();

  const line = documentLine(page, productName);
  await expect(line.getByLabel(`Количество: ${productName}`)).toHaveValue("2");
  await expect(line).toContainText("2");

  await line.getByLabel(`Количество: ${productName}`).fill("3");
  await expect(line).toContainText("Больше, чем на складе");
  await expect(page.getByRole("button", { name: "Провести" })).toBeDisabled();

  await line.getByLabel(`Количество: ${productName}`).fill("1");
  await line.getByLabel(`Количество: ${productName}`).blur();
  await expect(page.getByText("✓ Сохранено")).toBeVisible();
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
