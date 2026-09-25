import { test, expect } from "@playwright/test";
import { adminApi } from "../adminApi";
import { ADMIN_SESSION } from "../session";
import { createProduct, createReceiptDraft, createStore, receive, uniqueStamp } from "../warehouseApi";

/**
 * Раздел «Склад» на телефоне: вкладки одной строкой, «Склад» внизу
 * подсвечен в любом месте раздела, модалка из липкой шапки не прячется под
 * нижней панелью.
 */
test.use({ storageState: ADMIN_SESSION });

test("«Склад» в нижней панели активен внутри раздела", async ({ page, request }) => {
  // Документ — страница без шапки раздела; это худший случай для подсветки
  // пункта меню (см. warehouse-shell.spec.ts для того же паттерна создания).
  const api = adminApi(request);
  const store = await api.create<{ data: { id: number } }>("/admin/stores", { name: `E2E склад ${Date.now()}`, is_active: false });
  const receipt = await api.create<{ data: { id: number } }>("/admin/goods-receipts", { store_id: store.data.id });

  try {
    await page.goto(`/warehouse/receipts/${receipt.data.id}`);
    const nav = page.getByRole("navigation", { name: "Основное меню" });
    await expect(nav.getByRole("link", { name: "Склад" })).toHaveAttribute("aria-current", "page");
  } finally {
    await api.delete(`/admin/goods-receipts/${receipt.data.id}`);
    await api.delete(`/admin/stores/${store.data.id}`);
  }
});

test("вкладки раздела — одна строка", async ({ page }) => {
  await page.goto("/warehouse/stock");
  const tabs = page.getByRole("navigation", { name: "Разделы склада" }).getByRole("link");
  // Дождаться первой вкладки: сразу после goto экран ещё может показывать
  // ProtectedRoute-заглушку авторизации, и evaluateAll() её не дожидается.
  await expect(tabs.first()).toBeVisible();

  const tops = await tabs.evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
});

test("карточка остатка показывает разбивку по местам хранения", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const product = await createProduct(request, stamp);
  const first = await createStore(request, stamp, " А");
  const second = await createStore(request, stamp, " Б");
  await receive(request, first.id, product.id, 1);
  await receive(request, second.id, product.id, 2);

  await page.goto("/warehouse/stock");
  await page.getByPlaceholder("Название, код или артикул").fill(product.name);

  const card = page.getByRole("listitem").filter({ hasText: product.name });
  await expect(card).toContainText(`${first.name} 1`);
  await expect(card).toContainText(`${second.name} 2`);
});

test("на телефоне товар добавляется из поиска на весь экран, степпер сохраняет", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const product = await createProduct(request, stamp);
  const store = await createStore(request, stamp);
  const receiptId = await createReceiptDraft(request, store.id);

  try {
    await page.goto(`/warehouse/receipts/${receiptId}`);
    await page.getByRole("button", { name: "+ Добавить товар" }).click();
    const dialog = page.getByRole("dialog", { name: "Добавить товар" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Поиск товара").fill(product.name);
    await dialog.getByRole("option").filter({ hasText: product.name }).click();
    await expect(dialog).toBeHidden();

    const card = page.getByTestId("document-line").filter({ hasText: product.name });
    await card.getByRole("button", { name: `Больше: ${product.name}` }).click();
    await expect(card.getByLabel(`Количество: ${product.name}`)).toHaveValue("2");
    await expect(page.getByText("✓ Сохранено")).toBeVisible();

    // Панель «Провести» — над нижней навигацией, а не под ней.
    const post = page.getByRole("button", { name: "Провести" });
    const box = (await post.boundingBox())!;
    const hit = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.textContent?.trim() ?? null,
      [box.x + box.width / 2, box.y + box.height / 2],
    );
    expect(hit).toBe("Провести");
  } finally {
    await adminApi(request).delete(`/admin/goods-receipts/${receiptId}`);
  }
});

test("Подбор на телефоне — на весь экран, «Добавить» над нижней панелью", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const product = await createProduct(request, stamp);
  const store = await createStore(request, stamp);
  const receiptId = await createReceiptDraft(request, store.id);

  try {
    await page.goto(`/warehouse/receipts/${receiptId}`);
    await page.getByRole("button", { name: "☰ Подбор" }).click();
    const picker = page.getByRole("dialog", { name: "Подбор" });
    const box = (await picker.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.round(box.height)).toBe(viewport.height);

    await picker.getByLabel("Поиск в подборе").fill(product.name);
    await picker.getByTestId("picker-row").filter({ hasText: product.name }).getByTestId("picker-pick").click();
    const add = picker.getByRole("button", { name: "Добавить 1 позицию · 1 шт" });
    const addBox = (await add.boundingBox())!;
    const hit = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.textContent?.trim() ?? null,
      [addBox.x + addBox.width / 2, addBox.y + addBox.height / 2],
    );
    expect(hit).toBe("Добавить 1 позицию · 1 шт");
    await add.click();
    await expect(page.getByTestId("document-line").filter({ hasText: product.name })).toHaveCount(1);
  } finally {
    await adminApi(request).delete(`/admin/goods-receipts/${receiptId}`);
  }
});
