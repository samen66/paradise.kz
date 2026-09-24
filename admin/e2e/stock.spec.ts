import { test, expect } from "@playwright/test";
import { requireInStockProduct, requireProduct, requireStore } from "./fixtures";
import { ADMIN_SESSION } from "./session";

/**
 * Вкладка «Остатки» раздела «Склад».
 *
 * Остаток здесь только показывают — меняется он приёмками и заказами, через
 * FIFO-журнал. Прогон приёмки уже доказал, что журнал и проекция сходятся;
 * браузеру остаётся доказать, что менеджер видит на экране то же число.
 *
 * Плашка «Нет ни одного активного склада» — вторая половина этой страницы:
 * без активного склада каталог молча показывает нули, а оформление заказа
 * падает. Выключить склад из теста нечем (склады живут в Filament), поэтому
 * ответ API подменяется на лету — проверяется именно реакция экрана на флаг
 * `meta.has_active_store`, который отдаёт StockController.
 */
test.use({ storageState: ADMIN_SESSION });

test("остаток товара виден в таблице вместе со складом", async ({ page }) => {
  const product = requireProduct();
  const store = requireStore();

  await page.goto("/warehouse/stock");
  await page.getByPlaceholder("Поиск по названию, коду или артикулу...").fill(product.article);

  const row = page.locator("tbody tr").filter({ hasText: product.article });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(product.name);
  await expect(row).toContainText(store.name);

  const expectedStock = Number(product.stock_at_store ?? product.stock).toLocaleString("ru-RU");
  await expect(row.locator("td").nth(2)).toHaveText(expectedStock);

  await expect(page.getByText("Нет ни одного активного склада.")).toHaveCount(0);
});

test("товар в наличии виден с тем же остатком, что покупатель видит на витрине", async ({ page }) => {
  const product = requireInStockProduct();
  const store = requireStore();

  // Этот товар браузерные тесты не покупают — остаток ровно тот, что принял прогон.
  expect(product.stock, "прогон должен принять товар «в наличии» ровно на 7 шт").toBe(7);

  await page.goto("/warehouse/stock");
  await page.getByPlaceholder("Поиск по названию, коду или артикулу...").fill(product.article);

  const row = page.locator("tbody tr").filter({ hasText: product.article });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(store.name);
  await expect(row.locator("td").nth(2)).toHaveText(Number(product.stock).toLocaleString("ru-RU"));

  await test.info().attach("склад: товар в наличии", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("без активного склада страница показывает красную плашку", async ({ page }) => {
  // Реальные строки остаются реальными: подменяется только флаг в meta.
  await page.route("**/api/admin/stock*", async (route) => {
    const response = await route.fetch();
    const json = await response.json();

    await route.fulfill({
      response,
      json: { ...json, meta: { ...json.meta, has_active_store: false } },
    });
  });

  await page.goto("/warehouse/stock");

  const banner = page.getByText("Нет ни одного активного склада.");
  await expect(banner).toBeVisible();
  await expect(page.getByRole("link", { name: /Настроить склады/ })).toBeVisible();
});
