import { test, expect } from "@playwright/test";
import { adminApi } from "../adminApi";
import { ADMIN_SESSION } from "../session";
import { createProduct, createStore, receive, uniqueStamp } from "../warehouseApi";

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

test("модалка из шапки раздела — над нижней панелью", async ({ page }) => {
  await page.goto("/warehouse/stock");
  await page.getByRole("button", { name: /Принять товар/ }).click();

  const dialog = page.getByRole("dialog", { name: "Новая приёмка" });
  await expect(dialog).toBeVisible();

  // Кнопку видно — мало; проверяем, что в её центре именно она, а не нижняя панель.
  const save = dialog.getByRole("button", { name: "Сохранить" });
  const box = (await save.boundingBox())!;
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.textContent?.trim() ?? null,
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  expect(hit).toBe("Сохранить");

  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toBeHidden();
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
